import { useRef } from 'react'
import { Group, Mesh } from 'three'
import { useItemCarry, type ItemTransform } from '../src/index.js'

/** Render inside <Canvas>. Only the border of this 2 x 1 panel can be grabbed. */
export function CarryablePanel({ onSave }: { onSave?: (transform: ItemTransform) => void }) {
  const target = useRef<Group>(null)
  const handle = useRef<Mesh>(null)
  useItemCarry({
    target,
    handle,
    canStart: ({ local }) => Math.abs(local.x) > 0.85 || Math.abs(local.y) > 0.35,
    onEnd: onSave,
  })
  return (
    <group ref={target}>
      <mesh ref={handle}>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color="#8ca0b8" />
      </mesh>
      <mesh position={[0, 0, 0.001]} raycast={() => {}}>
        <planeGeometry args={[1.7, 0.7]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  )
}
