export const PANEL = {
  width: 2.4,
  height: 1.55,
  centerY: 1.35,
  pixelsX: 1440,
  pixelsY: 930,
  titleHeight: 108,
  frameWidth: 36,
} as const

/** Handle coordinates are local to the panel mesh, independent of placement. */
export function isWindowHandle(local: { x: number; y: number }) {
  const x = (local.x / PANEL.width + 0.5) * PANEL.pixelsX
  const y = (0.5 - local.y / PANEL.height) * PANEL.pixelsY
  return x >= 0 && x <= PANEL.pixelsX && y >= 0 && y <= PANEL.pixelsY &&
    (y <= PANEL.titleHeight || x <= PANEL.frameWidth || x >= PANEL.pixelsX - PANEL.frameWidth || y >= PANEL.pixelsY - PANEL.frameWidth)
}

export function paintWindow(ctx: CanvasRenderingContext2D, holding: boolean) {
  const { pixelsX: w, pixelsY: h } = PANEL
  const font = '"Yu Gothic UI", "Hiragino Kaku Gothic ProN", sans-serif'
  ctx.fillStyle = '#bcc9db'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#f5f8fc'; ctx.fillRect(10, 10, w - 20, h - 20)
  ctx.fillStyle = holding ? '#2454b9' : '#3267dc'; ctx.fillRect(10, 10, w - 20, 98)
  ctx.strokeStyle = '#f5f8fc'; ctx.lineWidth = 3
  ctx.strokeRect(39, 38, 36, 32); ctx.beginPath(); ctx.moveTo(39, 48); ctx.lineTo(75, 48); ctx.stroke()
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.font = `600 32px ${font}`; ctx.fillText('item-carry', 98, 58)
  // Same four-way path glyph used by the whiteboard; no icon-font dependency.
  ctx.save()
  ctx.translate(w - 62, 58)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-24, 0); ctx.lineTo(24, 0)
  ctx.moveTo(0, -24); ctx.lineTo(0, 24)
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(-8, -16); ctx.lineTo(0, -24); ctx.lineTo(8, -16)
    ctx.rotate(Math.PI / 2)
  }
  ctx.stroke(); ctx.restore()
  ctx.textAlign = 'left'; ctx.fillStyle = '#192d47'; ctx.font = `700 78px ${font}`
  ctx.fillText('デモアイテム', 105, 250)
  ctx.font = `30px ${font}`; ctx.fillStyle = '#52657e'
  ctx.fillText('タイトルバーと外枠をつかんで動かせます。', 108, 340)
  ctx.strokeStyle = '#d7e0ed'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(108, 410); ctx.lineTo(w - 108, 410); ctx.stroke()
  ctx.textAlign = 'center'; ctx.fillStyle = '#192d47'; ctx.font = `32px ${font}`
  ctx.fillText('移動・回転は他のユーザーにも同期されます。', w / 2, 570)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#e6edf7'; ctx.fillRect(36, h - 104, w - 72, 68)
  ctx.fillStyle = '#52657e'; ctx.font = `24px ${font}`; ctx.fillText('中央の内容部分はつかめません', 65, h - 69)
}
