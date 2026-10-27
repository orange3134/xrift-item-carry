import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type InstanceStateContextValue } from '@xrift/world-components'

/** Browser preview only. XRift supplies its own instance-state implementation. */
export function useDemoSync(): InstanceStateContextValue {
  const [states, setStates] = useState(new Map<string, unknown>())
  const channel = useRef<BroadcastChannel | null>(null)
  const latest = useRef(states)
  latest.current = states
  useEffect(() => {
    const bus = new BroadcastChannel('xrift-item-carry-demo')
    channel.current = bus
    bus.onmessage = ({ data }) => {
      if (data.kind === 'join') bus.postMessage({ kind: 'snapshot', entries: [...latest.current] })
      else if (data.kind === 'snapshot') setStates(previous => new Map([...data.entries, ...previous]))
      else if (data.kind === 'update') setStates(previous => new Map(previous).set(data.key, data.value))
    }
    bus.postMessage({ kind: 'join' })
    return () => { channel.current = null; bus.close() }
  }, [])
  const sendState = useCallback((key: string, value: unknown) => {
    setStates(previous => new Map(previous).set(key, value))
    channel.current?.postMessage({ kind: 'update', key, value })
  }, [])
  return useMemo(() => ({ states, sendState }), [states, sendState])
}
