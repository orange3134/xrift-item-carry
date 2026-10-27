import { Plane, Quaternion, Vector3, type Object3D, type Ray } from 'three'

const UP = new Vector3(0, 1, 0)
export type CarryState = {
  distance: number
  followRay: boolean
  plane: Plane
  anchor: Vector3
  orientation: Quaternion
  heading: number
  lastHeading: number
}

export function horizontalHeading(direction: Vector3, fallback = 0) {
  return direction.x ** 2 + direction.z ** 2 < 1e-8 ? fallback : Math.atan2(-direction.x, -direction.z)
}

export type CarrySample = { ray: Ray; view: Vector3 }
export type CarryStart = CarrySample & { world: Vector3; followRay: boolean }

export function beginCarry(root: Object3D, { world: point, ray, view, followRay }: CarryStart): CarryState {
  root.updateWorldMatrix(true, false)
  const heading = horizontalHeading(view)
  return {
    distance: ray.origin.distanceTo(point), followRay,
    plane: new Plane().setFromNormalAndCoplanarPoint(view, point),
    anchor: root.worldToLocal(point.clone()),
    orientation: root.getWorldQuaternion(new Quaternion()),
    heading, lastHeading: heading,
  }
}

/** Keep the grab anchor at its original ray distance (locked/XR) or view plane (free cursor). */
export function updateCarry(root: Object3D, carry: CarryState, { ray, view }: CarrySample): boolean {
  const target = new Vector3()
  if (carry.followRay) ray.at(carry.distance, target)
  else if (!ray.intersectPlane(carry.plane, target)) return false
  carry.lastHeading = horizontalHeading(view, carry.lastHeading)
  const orientation = new Quaternion().setFromAxisAngle(UP, carry.lastHeading - carry.heading).multiply(carry.orientation)
  root.parent?.updateWorldMatrix(true, false)
  if (root.parent) orientation.premultiply(root.parent.getWorldQuaternion(new Quaternion()).invert())
  root.quaternion.copy(orientation)
  root.updateWorldMatrix(false, false)
  // Recompute the offset after rotating, so an off-centre grab never slips.
  const offset = root.localToWorld(carry.anchor.clone()).sub(root.getWorldPosition(new Vector3()))
  target.sub(offset)
  root.position.copy(root.parent ? root.parent.worldToLocal(target) : target)
  root.updateWorldMatrix(false, true)
  return true
}

export type ItemTransform = { position: [number, number, number]; quaternion: [number, number, number, number] }
export function isItemTransform(value: unknown): value is ItemTransform {
  if (!value || typeof value !== 'object') return false
  const t = value as ItemTransform
  return Array.isArray(t.position) && t.position.length === 3 && t.position.every(Number.isFinite) &&
    Array.isArray(t.quaternion) && t.quaternion.length === 4 && t.quaternion.every(Number.isFinite) &&
    Math.abs(t.quaternion.reduce((sum, n) => sum + n * n, 0) - 1) < 0.01
}

/** A detached snapshot in the object's parent coordinate system. */
export function getItemTransform(root: Object3D): ItemTransform {
  return { position: root.position.toArray(), quaternion: root.quaternion.toArray() }
}
