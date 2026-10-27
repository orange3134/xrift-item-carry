import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useInstanceStateContext, useItem, usePlacementState } from '@xrift/world-components'
import { CanvasTexture, Group, LinearFilter, Mesh, SRGBColorSpace } from 'three'
import { isItemTransform, useItemCarry, type ItemTransform } from 'xrift-item-carry'
import { isWindowHandle, paintWindow, PANEL } from './windowPanel'

/** Upload entry: the XRift host provides Canvas, ItemProvider and state transport. */
export function Item() {
  const { id } = useItem()
  const { mode } = usePlacementState()
  const { states, sendState } = useInstanceStateContext()
  const target = useRef<Group>(null)
  const handle = useRef<Mesh>(null)
  const lastSend = useRef(0)
  const observed = useRef<unknown>(undefined)
  const [holding, setHolding] = useState(false)
  const key = `item-carry-demo:${id}:transform`
  const save = (transform: ItemTransform) => {
    sendState(key, transform)
    lastSend.current = performance.now()
  }
  const carry = useItemCarry({
    target,
    handle,
    enabled: mode === 'placed',
    canStart: ({ local }) => isWindowHandle(local),
    onStart: () => setHolding(true),
    onChange: transform => {
      if (performance.now() - lastSend.current >= 100) save(transform)
    },
    onEnd: transform => { save(transform); setHolding(false) },
  })
  useFrame(() => {
    if (carry.isCarrying() || !target.current) return
    const incoming = states.get(key)
    if (incoming === observed.current) return
    observed.current = incoming
    if (isItemTransform(incoming)) {
      target.current.position.fromArray(incoming.position)
      target.current.quaternion.fromArray(incoming.quaternion).normalize()
    }
  })
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = PANEL.pixelsX; canvas.height = PANEL.pixelsY
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is required for the carry demo')
    paintWindow(context, false)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    result.minFilter = LinearFilter
    result.generateMipmaps = false
    return result
  }, [])
  useEffect(() => {
    const context = (texture.image as HTMLCanvasElement).getContext('2d')!
    paintWindow(context, holding)
    texture.needsUpdate = true
  }, [texture, holding])
  useEffect(() => () => texture.dispose(), [texture])
  return <group ref={target}>
    <mesh position={[0, PANEL.centerY, -0.036]}>
      <boxGeometry args={[PANEL.width, PANEL.height, 0.06]} />
      <meshBasicMaterial color="#8c9eb7" />
    </mesh>
    <mesh ref={handle} position={[0, PANEL.centerY, 0]}>
      <planeGeometry args={[PANEL.width, PANEL.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  </group>
}
