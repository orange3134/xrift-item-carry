import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Group, Mesh } from 'three'
import { useItemCarry, type ItemTransform } from '../src/index.js'

declare global {
  interface Window {
    carryDemo: {
      events: { kind: string; transform: ItemTransform; revision: number }[]
      setEnabled: (enabled: boolean) => void
      setMounted: (mounted: boolean) => void
      rerender: () => void
      end: () => void
      ready: boolean
    }
  }
}

function Panel({ enabled, revision }: { enabled: boolean; revision: number }) {
  const target = useRef<Group>(null)
  const handle = useRef<Mesh>(null)
  const record = (kind: string, transform: ItemTransform) => window.carryDemo.events.push({ kind, transform, revision })
  const carry = useItemCarry({
    target, handle, enabled,
    canStart: ({ local }) => Math.abs(local.x) > 0.85 || Math.abs(local.y) > 0.35,
    onStart: transform => record('start', transform),
    onChange: transform => record('change', transform),
    onEnd: transform => record('end', transform),
  })
  window.carryDemo.end = carry.end
  useEffect(() => { window.carryDemo.ready = true }, [])
  return <group ref={target}>
    <mesh ref={handle}>
      <planeGeometry args={[2, 1]} />
      <meshBasicMaterial color="#8ca0b8" />
    </mesh>
    <mesh position={[0, 0, 0.001]} raycast={() => {}}>
      <planeGeometry args={[1.7, 0.7]} />
      <meshBasicMaterial color="white" />
    </mesh>
  </group>
}

function Demo() {
  const [enabled, setEnabled] = useState(true)
  const [mounted, setMounted] = useState(true)
  const [revision, setRevision] = useState(0)
  window.carryDemo ??= { events: [], ready: false, setEnabled, setMounted, rerender: () => setRevision(n => n + 1), end: () => {} }
  return <>
    <div style={{ position: 'absolute', zIndex: 1, padding: 16, fontFamily: 'sans-serif' }}>Drag the blue border to carry the panel.</div>
    <Canvas style={{ width: '100vw', height: '100vh', touchAction: 'none' }} camera={{ position: [0, 0, 3], fov: 40 }}>
      {mounted && <Panel enabled={enabled} revision={revision} />}
    </Canvas>
  </>
}

createRoot(document.getElementById('root')!).render(<Demo />)
