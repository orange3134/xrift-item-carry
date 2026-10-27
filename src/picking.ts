import { Vector3, type Camera, type Material, type Mesh, type Object3D, type Raycaster } from 'three'

function materialCanBlock(material: Material) {
  return material.visible && material.colorWrite && !(material.transparent && material.opacity <= 0)
}

/** Picking must follow rendered visibility, not just the hit mesh's own flag.
 * XRift can keep hidden avatar groups and invisible helper meshes in the scene. */
export function firstVisibleHit(raycaster: Raycaster, scene: Object3D, camera: Camera, maxDistance = Infinity) {
  const candidates: Object3D[] = []
  scene.traverseVisible(object => {
    if (!object.layers.test(camera.layers)) return
    const material = (object as Mesh).material as Material | Material[] | undefined
    // Reject invisible helpers BEFORE raycasting their (possibly skinned) geometry.
    if (material && !(Array.isArray(material) ? material.some(materialCanBlock) : materialCanBlock(material))) return
    candidates.push(object)
  })
  const previousMask = raycaster.layers.mask
  const previousFar = raycaster.far
  raycaster.layers.mask = camera.layers.mask
  raycaster.far = Math.min(previousFar, maxDistance)
  try {
    const cameraPosition = camera.getWorldPosition(new Vector3())
    const cameraDirection = camera.getWorldDirection(new Vector3())
    const clip = camera as Camera & { near?: number; far?: number }
    return raycaster.intersectObjects(candidates, false).find(hit => {
      const materials = (hit.object as Mesh).material as Material | Material[] | undefined
      const material = Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials
      if (material && !materialCanBlock(material)) return false
      // A camera-clipped avatar surface is not an occluder, even when the ray
      // starts inside the avatar. Camera clipping is measured along view Z.
      const depth = hit.point.clone().sub(cameraPosition).dot(cameraDirection)
      return depth >= (clip.near ?? 0) && depth <= (clip.far ?? Infinity)
    })
  } finally {
    raycaster.layers.mask = previousMask
    raycaster.far = previousFar
  }
}

/** Hover never scans the world. The cursor is a depth-tested mesh, so visible
 * walls/avatars already hide it when they obscure the item. Only a new press
 * needs an explicit world-occlusion check, and only after hitting this item. */
export function pickItemSurface(raycaster: Raycaster, surface: Mesh, scene: Object3D, camera: Camera, checkOcclusion = false) {
  for (let object: Object3D | null = surface; object; object = object.parent) {
    if (!object.visible) return null
  }
  if (!surface.layers.test(camera.layers)) return null
  const previousMask = raycaster.layers.mask
  raycaster.layers.mask = camera.layers.mask
  let hit
  try {
    hit = raycaster.intersectObject(surface, false)[0]
  } finally {
    raycaster.layers.mask = previousMask
  }
  if (!hit) return null
  const depth = hit.point.clone().sub(camera.getWorldPosition(new Vector3())).dot(camera.getWorldDirection(new Vector3()))
  const clip = camera as Camera & { near?: number; far?: number }
  if (depth < (clip.near ?? 0) || depth > (clip.far ?? Infinity)) return null
  if (checkOcclusion && firstVisibleHit(raycaster, scene, camera, hit.distance + 1e-5)?.object !== surface) return null
  return hit
}
