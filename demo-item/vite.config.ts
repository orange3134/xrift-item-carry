import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import federation from '@originjs/vite-plugin-federation'

/** Federation emits unused host-dependency chunks even with generate:false.
 * Keep only the exposed item's graph in the actual XRift upload payload. */
function itemPayloadOnly(): Plugin {
  return {
    name: 'carry-demo-item-payload',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const entry = bundle['remoteEntry.js']
        if (!entry || entry.type !== 'chunk' || entry.code.includes('${__federation_expose_')) {
          throw new Error('The XRift ./Item remote entry was not resolved')
        }
        const keep = new Set<string>()
        const visit = (name: string) => {
          if (keep.has(name) || !bundle[name]) return
          keep.add(name)
          const file = bundle[name]
          if (file.type === 'chunk') [...file.imports, ...file.dynamicImports, ...file.referencedFiles].forEach(visit)
        }
        visit('remoteEntry.js')
        for (const [name, file] of Object.entries(bundle)) {
          if (file.type === 'chunk' && file.name.startsWith('__federation_expose_Item')) visit(name)
        }
        for (const name of Object.keys(bundle)) if (!keep.has(name)) delete bundle[name]
        // Include display metadata in the content hash, so description-only
        // updates can create a new XRift version instead of reusing an ACTIVE one.
        const { item } = JSON.parse(readFileSync(new URL('./xrift.json', import.meta.url), 'utf8'))
        this.emitFile({
          type: 'asset',
          fileName: 'item-info.json',
          source: JSON.stringify({ name: item.title, description: item.description, license: 'MIT' }, null, 2) + '\n',
        })
      },
    },
  }
}

export default defineConfig({
  plugins: [federation({
    name: 'xrift_item_carry_demo',
    filename: 'remoteEntry.js',
    exposes: { './Item': './src/index.tsx' },
    // Production always uses the host's React/Fiber/context instances.
    shared: Object.fromEntries([
      'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
      'three', '@react-three/fiber', '@xrift/world-components',
      '@react-three/drei', '@react-three/rapier', '@react-three/uikit', '@pmndrs/uikit',
    ].map(name => [name, { import: false, generate: false, requiredVersion: '*' }])),
  }), itemPayloadOnly()],
  resolve: {
    // Use the current library source in this repo, with the demo's host peers.
    alias: { 'xrift-item-carry': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@xrift/world-components'],
  },
  build: {
    target: 'esnext',
    minify: false,
    assetsDir: '',
    // The dev page, navigation controls and tab-sync transport never ship.
    rollupOptions: { input: fileURLToPath(new URL('./src/upload.ts', import.meta.url)) },
  },
})
