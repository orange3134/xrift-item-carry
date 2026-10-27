import { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { ItemProvider, PlacementStateProvider, XRiftProvider } from '@xrift/world-components'
import { isItemTransform } from 'xrift-item-carry'
import { Item } from './Item'
import { PreviewNavigation } from './PreviewNavigation'
import { useDemoSync } from './devSync'
import { loadBuiltItem } from './loadBuiltItem'
import './preview.css'

const BuiltItem = lazy(loadBuiltItem)

function Preview() {
  const sync = useDemoSync()
  const params = new URLSearchParams(window.location.search)
  const id = params.get('item') || 'window'
  const mode = params.get('placement') === 'preview' ? 'preview' : 'placed'
  const WindowItem = params.has('built') ? BuiltItem : Item
  const transform = sync.states.get(`item-carry-demo:${id}:transform`)
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const change = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', change)
    return () => document.removeEventListener('pointerlockchange', change)
  }, [])
  return <main>
    <header className="preview-header">
      <h1>item-carry</h1>
      <button id="start-navigation">視点操作を開始</button>
    </header>
    <Canvas style={{ touchAction: 'none' }} camera={{ position: [0, 1.35, 3.4], fov: 40, near: 0.01 }} onCreated={({ camera, size }) => {
      // Keep the complete window visible on a narrow browser viewport too.
      camera.position.z = Math.max(3.4, 2.4 / (2 * Math.tan(20 * Math.PI / 180) * size.width / size.height) * 1.15)
      camera.lookAt(0, 1.35, 0)
    }}>
      <color attach="background" args={['#e7edf6']} />
      <gridHelper args={[40, 40, '#bcc9db', '#d1dbea']} raycast={() => {}} />
      <PreviewNavigation />
      <XRiftProvider baseUrl="/" instanceStateImplementation={sync}>
        <PlacementStateProvider mode={mode}><ItemProvider id={id}><Suspense fallback={null}><WindowItem /></Suspense></ItemProvider></PlacementStateProvider>
      </XRiftProvider>
    </Canvas>
    {locked && <div className="reticle" aria-hidden="true">+</div>}
    <footer className="preview-footer">
      <output id="transform" data-transform={isItemTransform(transform) ? JSON.stringify(transform) : ''}>
        {isItemTransform(transform) ? `位置 ${transform.position.map(n => n.toFixed(2)).join(', ')} m` : 'まだ動かしていません'}
      </output>
    </footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
