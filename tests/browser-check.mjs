// Run `npm run dev -- --host 127.0.0.1`, then `npm run test:browser`.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
const errors = []
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
page.on('pageerror', error => errors.push(error.message))
const url = process.env.CARRY_URL || 'http://127.0.0.1:5181/examples/'
const events = () => page.evaluate(() => window.carryDemo.events)
async function reset() {
  await page.goto(url)
  await page.waitForFunction(() => window.carryDemo?.ready)
  await page.waitForTimeout(150)
}
async function grab() {
  // y=235 is in the upper border of the 2 x 1 panel.
  await page.mouse.move(500, 235)
  await page.mouse.down()
  await page.mouse.move(550, 260)
  await page.waitForTimeout(80)
  assert.equal((await events()).filter(e => e.kind === 'start').length, 1)
}
try {
  await reset()
  await page.mouse.move(500, 400)
  await page.mouse.down()
  await page.mouse.move(550, 420)
  await page.mouse.up()
  assert.equal((await events()).length, 0, 'content area must not start a carry')
  await grab()
  await page.mouse.up()
  let log = await events()
  assert.equal(log.filter(e => e.kind === 'end').length, 1)
  assert.ok(log.at(-1).transform.position[0] > 0.1, 'border drag must move target')
  assert.equal(log.at(-1).transform.position[2], 0, 'free cursor must retain depth')

  for (const [name, interrupt] of [
    ['end()', () => page.evaluate(() => window.carryDemo.end())],
    ['Escape', () => page.keyboard.press('Escape')],
    ['blur', () => page.evaluate(() => window.dispatchEvent(new Event('blur')))],
    ['pointercancel', () => page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })))],
    ['lostcapture', () => page.evaluate(() => document.querySelector('canvas').releasePointerCapture(1))],
    ['disabled', () => page.evaluate(() => window.carryDemo.setEnabled(false))],
    ['unmount', () => page.evaluate(() => window.carryDemo.setMounted(false))],
  ]) {
    await reset()
    await grab()
    await interrupt()
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => document.querySelector('canvas').hasPointerCapture(1)), false, `${name} must release pointer capture`)
    await page.mouse.up()
    log = await events()
    assert.equal(log.filter(e => e.kind === 'end').length, 1, `${name} must finish exactly once`)
    const length = log.length
    await page.mouse.move(700, 300)
    await page.waitForTimeout(80)
    assert.equal((await events()).length, length, `${name} must stop movement`)
  }
  await reset()
  await grab()
  await page.evaluate(() => window.carryDemo.rerender())
  await page.waitForTimeout(100)
  assert.equal((await events()).filter(e => e.kind === 'end').length, 0, 'rerender must not interrupt carry')
  await page.mouse.up()
  log = await events()
  assert.equal(log.at(-1).revision, 1, 'onEnd must use the latest callback')
  assert.deepEqual(errors, [])
  console.log('PASS: useItemCarry automatic input, region filtering, drag, end(), six interruptions, latest callbacks')
} finally {
  await browser.close()
}
