import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Matrix4, Mesh, Plane, Raycaster, Vector2, Vector3, type Ray } from 'three'
import { pickItemSurface } from './picking.js'

export type ItemHit = { local: Vector3; world: Vector3; ray: Ray; view: Vector3; followRay: boolean }
export type ItemInputHandlers = {
  down: (hit: ItemHit) => boolean | void; move: (hit: ItemHit) => void
  up: () => void; cancel: () => void
  hover?: (hit: ItemHit | null) => void; isDragging: () => boolean
}

/** Free cursor, pointer-lock reticle, and XR target rays share one gesture path. */
export function useItemInput(surface: RefObject<Mesh | null>, handlers: ItemInputHandlers, enabled = true) {
  const { gl, camera, scene } = useThree()
  const current = useRef(handlers)
  current.current = handlers
  const active = useRef<{ pointer?: number; source?: XRInputSource } | null>(null)
  const raycaster = useRef(new Raycaster()).current
  const dragPlane = useRef(new Plane()).current
  const pointer = useRef(new Vector2()).current
  const hitPoint = useRef(new Vector3()).current
  const normal = useRef(new Vector3()).current
  const matrix = useRef(new Matrix4()).current
  const pointerInside = useRef(false)
  const lastHit = useRef<ItemHit | null>(null)
  const hoverAt = useRef(0)
  const finishInput = useRef<() => void>(() => {})
  const stopInput = useRef(() => finishInput.current()).current
  const sampleRay = () => ({
    ray: raycaster.ray.clone(), view: camera.getWorldDirection(new Vector3()),
    followRay: !!document.pointerLockElement || gl.xr.isPresenting,
  })
  const hit = (start: boolean, checkOcclusion = false): ItemHit | null => {
    const mesh = surface.current
    if (!mesh) return null
    mesh.updateWorldMatrix(true, false)
    if (start) {
      const first = pickItemSurface(raycaster, mesh, scene, camera, checkOcclusion)
      if (!first) return null
      normal.copy(first.face?.normal ?? new Vector3(0, 0, 1)).transformDirection(mesh.matrixWorld)
      if (raycaster.ray.direction.dot(normal) >= 0) return null
      dragPlane.setFromNormalAndCoplanarPoint(normal, first.point)
    }
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return null
    const local = mesh.worldToLocal(hitPoint.clone())
    return { local, world: hitPoint.clone(), ...sampleRay() }
  }
  const moveHit = () => current.current.isDragging() && lastHit.current
    ? { ...lastHit.current, ...sampleRay() } : hit(false)
  const setPointerRay = (event?: PointerEvent) => {
    if (document.pointerLockElement) pointer.set(0, 0)
    else if (event) {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    }
    camera.updateWorldMatrix(true, false)
    raycaster.setFromCamera(pointer, camera)
  }
  const setXRRay = (frame: XRFrame, source: XRInputSource) => {
    const reference = gl.xr.getReferenceSpace()
    const pose = reference && frame.getPose(source.targetRaySpace, reference)
    if (!pose) return false
    matrix.fromArray(pose.transform.matrix)
    raycaster.ray.origin.setFromMatrixPosition(matrix)
    raycaster.ray.direction.set(0, 0, -1).transformDirection(matrix)
    if (camera.parent) {
      camera.parent.updateWorldMatrix(true, false)
      raycaster.ray.origin.applyMatrix4(camera.parent.matrixWorld)
      raycaster.ray.direction.transformDirection(camera.parent.matrixWorld)
    }
    return true
  }
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const finish = () => {
      if (!active.current) return
      const pointerId = active.current.pointer
      active.current = null
      current.current.up()
      if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    }
    finishInput.current = finish
    const down = (event: PointerEvent) => {
      if (active.current || event.button !== 0 || gl.xr.isPresenting) return
      if (!document.pointerLockElement && event.target !== canvas) return
      setPointerRay(event)
      const result = hit(true, true)
      if (!result) return
      if (current.current.down(result) === false) return
      // Keep compatibility mousemove available to XRift's look controls.
      if (!document.pointerLockElement) event.preventDefault()
      event.stopImmediatePropagation()
      active.current = { pointer: event.pointerId }
      lastHit.current = result
      if (!document.pointerLockElement) canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      pointerInside.current = event.target === canvas
      if (!active.current) {
        if (pointerInside.current || document.pointerLockElement) {
          // Record the newest ray; hover is sampled once by the frame loop.
          // High-polling-rate mice must not trigger extra scene picking.
          setPointerRay(event)
        } else current.current.hover?.(null)
        return
      }
      if (active.current.pointer !== event.pointerId) return
      setPointerRay(event)
      const result = moveHit()
      if (result) current.current.move(result)
      if (!current.current.isDragging()) current.current.hover?.(result)
      if (!document.pointerLockElement) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    const up = (event: PointerEvent) => {
      if (active.current?.pointer !== event.pointerId) return
      setPointerRay(event)
      const result = moveHit()
      if (result) current.current.move(result)
      finish()
    }
    const cancel = () => { finish(); pointerInside.current = false; current.current.hover?.(null); current.current.cancel() }
    const leave = () => { if (!active.current) { pointerInside.current = false; current.current.hover?.(null) } }
    const lostCapture = (event: PointerEvent) => { if (active.current?.pointer === event.pointerId) finish() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    const lockChange = () => { if (!document.pointerLockElement) finish() }
    let session: XRSession | null = null
    const xrStart = (event: XRInputSourceEvent) => {
      if (active.current || !setXRRay(event.frame, event.inputSource)) return
      const result = hit(true, true)
      if (!result) return
      if (current.current.down(result) === false) return
      active.current = { source: event.inputSource }
      lastHit.current = result
    }
    const xrEnd = (event: XRInputSourceEvent) => { if (active.current?.source === event.inputSource) finish() }
    const sourcesChanged = (event: XRInputSourcesChangeEvent) => {
      if (active.current?.source && Array.from(event.removed).includes(active.current.source)) finish()
    }
    const detachSession = () => {
      session?.removeEventListener('inputsourceschange', sourcesChanged)
      session?.removeEventListener('selectstart', xrStart)
      session?.removeEventListener('selectend', xrEnd)
      session?.removeEventListener('end', cancel)
      session = null; finish()
    }
    const attachSession = () => {
      detachSession(); session = gl.xr.getSession()
      session?.addEventListener('inputsourceschange', sourcesChanged)
      session?.addEventListener('selectstart', xrStart)
      session?.addEventListener('selectend', xrEnd)
      session?.addEventListener('end', cancel)
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', move, true)
    canvas.addEventListener('lostpointercapture', lostCapture)
    canvas.addEventListener('pointerleave', leave)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    document.addEventListener('pointerlockchange', lockChange)
    gl.xr.addEventListener('sessionstart', attachSession)
    gl.xr.addEventListener('sessionend', detachSession)
    attachSession()
    return () => {
      detachSession()
      finishInput.current = () => {}
      current.current.hover?.(null)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', move, true)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      canvas.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
      document.removeEventListener('pointerlockchange', lockChange)
      gl.xr.removeEventListener('sessionstart', attachSession)
      gl.xr.removeEventListener('sessionend', detachSession)
    }
    // Handlers are fresh through a ref; don't reset listeners during a gesture.
  }, [gl, camera, scene, enabled])
  useFrame((_state, _delta, frame) => {
    const gesture = active.current
    if (!enabled) return
    if (!gesture) {
      if (performance.now() - hoverAt.current < 1000 / 30) return
      hoverAt.current = performance.now()
      if (!current.current.hover) return
      if (gl.xr.isPresenting && frame) {
        const source = gl.xr.getSession()?.inputSources[0]
        if (!source || !setXRRay(frame, source)) { current.current.hover?.(null); return }
      } else if (pointerInside.current || document.pointerLockElement) setPointerRay()
      else { current.current.hover?.(null); return }
      current.current.hover?.(hit(true))
      return
    }
    if (gesture.source) {
      if (!frame || !setXRRay(frame, gesture.source)) return
    } else setPointerRay()
    const result = moveHit()
    if (result) current.current.move(result)
    if (!current.current.isDragging()) current.current.hover?.(result)
  })
  return stopInput
}
