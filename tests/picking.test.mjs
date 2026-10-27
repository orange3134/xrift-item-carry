import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3 } from 'three'

import { firstVisibleHit, pickItemSurface } from '../dist/picking.js'

function setup(distance = 0.25) {
  const scene = new Scene()
  const panel = new Mesh(new PlaneGeometry(2.7, 1.77), new MeshBasicMaterial())
  panel.position.y = 1.2
  scene.add(panel)
  // Standing close and looking down at a control on the lower toolbar.
  const camera = new PerspectiveCamera(60, 1, 0.01, 100)
  camera.position.set(0, 1.6, distance)
  camera.lookAt(0.45, 0.45, 0)
  camera.updateMatrixWorld()
  const raycaster = new Raycaster()
  raycaster.setFromCamera(new Vector2(), camera)
  const blocker = new Mesh(new PlaneGeometry(0.3, 0.3), new MeshBasicMaterial())
  blocker.position.copy(camera.position).lerp(new Vector3(0.45, 0.45, 0), 0.5)
  scene.add(blocker)
  scene.updateMatrixWorld(true)
  return { scene, panel, camera, raycaster, blocker }
}

test('close, downward toolbar ray ignores a mesh under an invisible avatar group', () => {
  const { scene, panel, camera, raycaster, blocker } = setup()
  const avatar = new Group()
  avatar.visible = false
  scene.add(avatar); avatar.add(blocker); scene.updateMatrixWorld(true)
  // Reproduce the original bug before verifying the fix.
  assert.equal(raycaster.intersectObjects(scene.children, true).find(h => h.object.visible).object, blocker)
  assert.equal(firstVisibleHit(raycaster, scene, camera)?.object, panel)
})

for (const [name, hide] of [
  ['hidden material', mesh => { mesh.material.visible = false }],
  ['transparent helper', mesh => { mesh.material.transparent = true; mesh.material.opacity = 0 }],
  ['depth-only helper', mesh => { mesh.material.colorWrite = false }],
  ['third-person-only avatar', mesh => { mesh.layers.set(10) }],
]) {
  test(`toolbar ignores ${name} at close and normal distances`, () => {
    for (const distance of [0.15, 0.25, 0.5, 3.4]) {
      const { scene, panel, camera, raycaster, blocker } = setup(distance)
      hide(blocker)
      assert.equal(firstVisibleHit(raycaster, scene, camera)?.object, panel)
    }
  })
}

test('visible walls and nearer panels still block interaction', () => {
  const { scene, camera, raycaster, blocker } = setup()
  assert.equal(firstVisibleHit(raycaster, scene, camera)?.object, blocker)
})

test('geometry clipped by the camera does not block the toolbar', () => {
  const { scene, panel, camera, raycaster, blocker } = setup()
  blocker.position.copy(camera.position).addScaledVector(raycaster.ray.direction, 0.001)
  scene.updateMatrixWorld(true)
  assert.equal(firstVisibleHit(raycaster, scene, camera)?.object, panel)
})

test('idle hover only raycasts the panel, even in a complex world', () => {
  const { scene, panel, camera, raycaster, blocker } = setup()
  scene.traverseVisible = () => { throw new Error('hover traversed the world') }
  blocker.raycast = () => { throw new Error('hover raycast an avatar or world mesh') }
  for (let frame = 0; frame < 120; frame++) {
    assert.equal(pickItemSurface(raycaster, panel, scene, camera)?.object, panel)
  }
})

test('clicks missing the panel never scan the world', () => {
  const { scene, panel, camera, raycaster } = setup()
  raycaster.ray.direction.set(0, 1, 0)
  scene.traverseVisible = () => { throw new Error('off-panel click traversed the world') }
  assert.equal(pickItemSurface(raycaster, panel, scene, camera, true), null)
})

test('press still checks visible occluders and restores raycaster limits', () => {
  const { scene, panel, camera, raycaster, blocker } = setup()
  raycaster.far = 50
  raycaster.layers.set(5)
  const mask = raycaster.layers.mask
  assert.equal(pickItemSurface(raycaster, panel, scene, camera, true), null)
  blocker.visible = false
  assert.equal(pickItemSurface(raycaster, panel, scene, camera, true)?.object, panel)
  assert.equal(raycaster.far, 50)
  assert.equal(raycaster.layers.mask, mask)
})

test('invisible avatar materials are rejected before expensive raycasting', () => {
  const { scene, panel, camera, raycaster, blocker } = setup()
  blocker.material.visible = false
  blocker.raycast = () => { throw new Error('raycast hidden avatar geometry') }
  assert.equal(pickItemSurface(raycaster, panel, scene, camera, true)?.object, panel)
})

test('hover respects panel parent visibility and camera clipping', () => {
  const { scene, panel, camera, raycaster } = setup()
  const parent = new Group()
  scene.add(parent); parent.add(panel)
  parent.visible = false
  assert.equal(pickItemSurface(raycaster, panel, scene, camera), null)
  parent.visible = true
  camera.near = 10
  assert.equal(pickItemSurface(raycaster, panel, scene, camera), null)
})
