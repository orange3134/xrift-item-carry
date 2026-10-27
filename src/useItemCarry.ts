import { useEffect, useRef, type RefObject } from 'react'
import { type Mesh, type Object3D } from 'three'
import { beginCarry, getItemTransform, updateCarry, type CarrySample, type CarryStart, type CarryState, type ItemTransform } from './carry.js'
import { useItemInput, type ItemHit } from './useItemInput.js'

export type ItemCarryOptions = {
  /** The object to move. Its transform is relative to its placement parent. */
  target: RefObject<Object3D | null>
  /** Omit to drive start/update/end from an existing input system. */
  handle?: RefObject<Mesh | null>
  enabled?: boolean
  /** Called only on press. Return false to leave that press to other controls. */
  canStart?: (hit: ItemHit) => boolean
  onStart?: (transform: ItemTransform) => void
  /** Called on each successful movement; throttle networking in this callback. */
  onChange?: (transform: ItemTransform) => void
  /** Also called on interruption (Escape, blur, disabled, lost capture, unmount). */
  onEnd?: (transform: ItemTransform) => void
}

export type ItemCarryController = {
  start: (hit: CarryStart) => boolean
  update: (sample: CarrySample) => boolean
  end: () => void
  /** Reads a ref; does not schedule a React render every frame. */
  isCarrying: () => boolean
}

/** Carry with a free cursor, pointer-lock reticle, or WebXR target ray.
 * The grabbed point stays anchored; camera yaw turns the item without pitch/roll.
 * This hook must be called inside a React Three Fiber Canvas. */
export function useItemCarry(options: ItemCarryOptions): ItemCarryController {
  const current = useRef(options)
  current.current = options
  const active = useRef<{ object: Object3D; carry: CarryState } | null>(null)
  const emptyHandle = useRef<Mesh | null>(null)
  const stopInput = useRef<() => void>(() => {})
  const controller = useRef<ItemCarryController | null>(null)
  if (!controller.current) {
    const end = () => {
      const held = active.current
      if (!held) return
      active.current = null
      stopInput.current()
      current.current.onEnd?.(getItemTransform(held.object))
    }
    controller.current = {
      start(hit) {
        const { target, enabled = true } = current.current
        if (!enabled || active.current || !target.current) return false
        const object = target.current
        active.current = { object, carry: beginCarry(object, hit) }
        current.current.onStart?.(getItemTransform(object))
        return true
      },
      update(sample) {
        const held = active.current
        if (!held) return false
        if (current.current.enabled === false || current.current.target.current !== held.object) {
          end()
          return false
        }
        if (!updateCarry(held.object, held.carry, sample)) return false
        current.current.onChange?.(getItemTransform(held.object))
        return true
      },
      end,
      isCarrying: () => active.current !== null,
    }
  }
  const api = controller.current
  stopInput.current = useItemInput(options.handle ?? emptyHandle, {
    down: hit => current.current.canStart?.(hit) === false ? false : api.start(hit),
    move: api.update,
    up: api.end,
    cancel: api.end,
    isDragging: api.isCarrying,
  }, !!options.handle && options.enabled !== false)
  useEffect(() => {
    if (options.enabled === false) api.end()
  }, [options.enabled, api])
  useEffect(() => () => api.end(), [api])
  return api
}
