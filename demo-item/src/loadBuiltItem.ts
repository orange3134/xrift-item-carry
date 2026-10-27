import { type ComponentType } from 'react'
import * as React from 'react'
import * as ReactJSX from 'react/jsx-runtime'
import * as Three from 'three'
import * as Fiber from '@react-three/fiber'
import * as XRift from '@xrift/world-components'

/** Preview the actual ./Item upload bundle against the same host contexts.
 * This module is only reachable from the browser preview, never the upload. */
export async function loadBuiltItem(): Promise<{ default: ComponentType }> {
  // Vite does not watch build output; a fresh URL avoids a cached older entry.
  const url = `/dist/remoteEntry.js?build=${Date.now()}`
  const remote = await import(/* @vite-ignore */ url)
  const modules: Record<string, { version: string; module: unknown }> = {
    react: { version: React.version, module: React },
    'react/jsx-runtime': { version: React.version, module: ReactJSX },
    three: { version: `0.${Three.REVISION}.0`, module: Three },
    '@react-three/fiber': { version: '9.0.0', module: Fiber },
    '@xrift/world-components': { version: '0.53.0', module: XRift },
  }
  remote.init(Object.fromEntries(Object.entries(modules).map(([name, value]) => [
    name, { [value.version]: { get: async () => () => value.module, scope: 'default' } },
  ])))
  const factory = await remote.get('./Item')
  const { Item } = factory()
  if (typeof Item !== 'function') throw new Error('The upload bundle did not expose an Item component')
  return { default: Item }
}
