import test from 'node:test'
import assert from 'node:assert/strict'
import { Object3D, Quaternion, Ray, Vector3 } from 'three'
import { beginCarry, updateCarry, isItemTransform, getItemTransform } from '../dist/carry.js'
const near = (a, b) => assert.ok(a.distanceTo(b) < 1e-6, `${a.toArray()} != ${b.toArray()}`)
const UP = new Vector3(0, 1, 0)
function setup(parent = new Object3D()) {
  const root = new Object3D(); parent.add(root); parent.updateMatrixWorld(true)
  const point = root.localToWorld(new Vector3(0.9, 1.9, 0))
  const ray = new Ray(point.clone().add(new Vector3(0, 0, 3)), new Vector3(0, 0, -1))
  return { root, point, ray, carry: beginCarry(root, { world: point, ray, view: ray.direction, followRay: true }) }
}
test('walking forward and back carries the panel at the grabbed distance', () => {
  const { root, ray, carry } = setup()
  for (const z of [2, 4, 1, 3]) {
    ray.origin.z = z
    updateCarry(root, carry, { ray, view: ray.direction })
    near(root.localToWorld(carry.anchor.clone()), ray.at(carry.distance, new Vector3()))
    assert.ok(Math.abs(root.position.z - (z - 3)) < 1e-6)
  }
})
test('yaw rotates the panel and retains an off-centre grab through a full turn', () => {
  const { root, ray, carry } = setup()
  for (const yaw of [0.4, 1.8, 3.12, -3.12, -1.8, 0]) {
    const q = new Quaternion().setFromAxisAngle(UP, yaw)
    ray.direction.set(0, 0, -1).applyQuaternion(q)
    updateCarry(root, carry, { ray, view: ray.direction })
    near(root.localToWorld(carry.anchor.clone()), ray.at(carry.distance, new Vector3()))
    assert.ok(root.quaternion.angleTo(q) < 1e-6)
    near(new Vector3(0, 1, 0).applyQuaternion(root.quaternion), UP)
  }
})
test('looking up/down changes position but never pitches or rolls the panel', () => {
  const { root, ray, carry } = setup()
  for (const pitch of [-1, 0.4, 1.2]) {
    ray.direction.set(0, Math.sin(pitch), -Math.cos(pitch))
    updateCarry(root, carry, { ray, view: ray.direction })
    near(new Vector3(0, 1, 0).applyQuaternion(root.quaternion), UP)
    near(root.localToWorld(carry.anchor.clone()), ray.at(carry.distance, new Vector3()))
  }
})
test('rotated and scaled placement parents preserve the world grab anchor', () => {
  const parent = new Object3D(); parent.rotation.set(0.1, 0.8, 0.2); parent.scale.setScalar(1.7); parent.position.set(3, 2, -4)
  const { root, ray, carry } = setup(parent)
  const expected = new Quaternion().setFromAxisAngle(UP, 0.6).multiply(carry.orientation)
  ray.direction.set(0, 0, -1).applyAxisAngle(UP, 0.6)
  ray.origin.add(new Vector3(1, 0.3, -2))
  updateCarry(root, carry, { ray, view: ray.direction })
  near(root.localToWorld(carry.anchor.clone()), ray.at(carry.distance, new Vector3()))
  assert.ok(root.getWorldQuaternion(new Quaternion()).angleTo(expected) < 1e-6)
})
test('free mouse retains the initial view plane without depth drift', () => {
  const { root, point, ray } = setup()
  const carry = beginCarry(root, { world: point, ray, view: ray.direction, followRay: false })
  ray.direction.set(0.2, -0.1, -1).normalize()
  updateCarry(root, carry, { ray, view: new Vector3(0, 0, -1) })
  assert.ok(Math.abs(root.position.z) < 1e-6)
})
test('network transform validates both position and rotation atomically', () => {
  assert.equal(isItemTransform({ position: [1, 2, 3], quaternion: [0, 0, 0, 1] }), true)
  assert.equal(isItemTransform({ position: [1, 2, 3], quaternion: [0, 0, 0, 0] }), false)
  assert.equal(isItemTransform({ position: [NaN, 2, 3], quaternion: [0, 0, 0, 1] }), false)
})

test('parentless items can be carried and snapshots never alias the live transform', () => {
  const root = new Object3D()
  const ray = new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1))
  const carry = beginCarry(root, { world: new Vector3(), ray, view: ray.direction, followRay: true })
  ray.origin.x = 2
  assert.equal(updateCarry(root, carry, { ray, view: ray.direction }), true)
  const snapshot = getItemTransform(root)
  assert.deepEqual(snapshot.position, [2, 0, 0])
  root.position.x = 4
  assert.deepEqual(snapshot.position, [2, 0, 0])
})
test('rays parallel to the free-cursor plane leave the transform unchanged', () => {
  const { root, point, ray } = setup()
  const carry = beginCarry(root, { world: point, ray, view: ray.direction, followRay: false })
  const before = getItemTransform(root)
  ray.direction.set(1, 0, 0)
  assert.equal(updateCarry(root, carry, { ray, view: new Vector3(0, 0, -1) }), false)
  assert.deepEqual(getItemTransform(root), before)
})
test('looking straight up retains the previous horizontal heading', () => {
  const { root, ray, carry } = setup()
  const view = new Vector3(0, 0, -1).applyAxisAngle(UP, 0.8)
  updateCarry(root, carry, { ray, view })
  const orientation = root.quaternion.clone()
  updateCarry(root, carry, { ray, view: new Vector3(0, 1, 0) })
  assert.ok(root.quaternion.angleTo(orientation) < 1e-6)
})
