import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Vector3 } from 'three'

/** Minimal preview navigation. The uploaded item uses XRift's native controls. */
export function PreviewNavigation() {
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())
  useEffect(() => {
    const canvas = gl.domElement
    const button = document.getElementById('start-navigation')!
    const enter = () => {
      camera.position.set(0, 1.99, 3.4)
      camera.rotation.set(0, 0, 0)
      void canvas.requestPointerLock()
    }
    const look = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      rotation.y -= event.movementX * 0.002
      rotation.x = Math.max(-1.5, Math.min(1.5, rotation.x - event.movementY * 0.002))
      camera.quaternion.setFromEuler(rotation)
    }
    const down = (event: KeyboardEvent) => keys.current.add(event.code)
    const up = (event: KeyboardEvent) => keys.current.delete(event.code)
    const clear = () => keys.current.clear()
    button.addEventListener('click', enter)
    document.addEventListener('mousemove', look)
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('blur', clear); document.addEventListener('pointerlockchange', clear)
    return () => {
      button.removeEventListener('click', enter)
      document.removeEventListener('mousemove', look)
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear); document.removeEventListener('pointerlockchange', clear)
    }
  }, [camera, gl])
  useFrame((_state, delta) => {
    if (document.pointerLockElement !== gl.domElement) return
    const forward = camera.getWorldDirection(new Vector3()); forward.y = 0; forward.normalize()
    const right = new Vector3().crossVectors(forward, camera.up).normalize()
    const speed = Math.min(delta, 0.1) * 1.2
    camera.position.addScaledVector(forward, (Number(keys.current.has('KeyW')) - Number(keys.current.has('KeyS'))) * speed)
    camera.position.addScaledVector(right, (Number(keys.current.has('KeyD')) - Number(keys.current.has('KeyA'))) * speed)
  })
  return null
}
