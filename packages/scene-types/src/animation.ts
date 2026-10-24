import type { Easing, EnterSpec } from './schema.ts'

export const DEFAULT_ENTER_DURATION = 0.7

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function ease(value: number, easing: Easing = 'ease-out'): number {
  const t = clamp01(value)
  switch (easing) {
    case 'linear':
      return t
    case 'ease-in-out':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'ease-out':
    default:
      return 1 - Math.pow(1 - t, 3)
  }
}

export function enterProgress(enter: EnterSpec, time: number): number {
  if (enter.type === 'none') return 1
  const raw = (time - enter.delay) / Math.max(enter.duration, 0.0001)
  return ease(raw, enter.easing)
}

/**
 * Progress for any time-driven reveal. The renderer never uses wall-clock
 * animations, so the same time always produces the same chart/diagram state.
 */
export function timedProgress(
  time: number,
  delay: number,
  duration: number,
  easing: Easing = 'ease-out',
): number {
  return ease((time - delay) / Math.max(duration, 0.0001), easing)
}

export interface AnimatedStyle {
  opacity: number
  transform: string
  clipPath?: string
  transformOrigin?: string
}

/**
 * The single source of truth for entrance motion. Given the same enter spec and
 * time, this returns exactly the same style — in preview, capture, and video.
 */
export function animatedStyle(enter: EnterSpec, time: number): AnimatedStyle {
  const t = enterProgress(enter, time)
  switch (enter.type) {
    case 'none':
      return { opacity: 1, transform: 'none' }
    case 'fade':
      return { opacity: t, transform: 'none' }
    case 'fade-up':
      return { opacity: t, transform: `translate3d(0, ${(1 - t) * 28}px, 0)` }
    case 'fade-down':
      return { opacity: t, transform: `translate3d(0, ${(1 - t) * -24}px, 0)` }
    case 'slide-left':
      return { opacity: t, transform: `translate3d(${(1 - t) * -48}px, 0, 0)` }
    case 'slide-right':
      return { opacity: t, transform: `translate3d(${(1 - t) * 48}px, 0, 0)` }
    case 'scale':
      return { opacity: t, transform: `scale(${0.94 + t * 0.06})` }
    case 'grow':
      return {
        opacity: 1,
        transform: 'none',
        clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
        transformOrigin: 'left center',
      }
    case 'draw':
      return {
        opacity: Math.min(1, 0.35 + t * 0.65),
        transform: 'none',
        clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
        transformOrigin: 'left center',
      }
    default:
      return { opacity: t, transform: 'none' }
  }
}

export function defaultItemEnter(index: number, sceneDuration: number): EnterSpec {
  const maxDelay = Math.max(0, Math.min(0.7, sceneDuration - DEFAULT_ENTER_DURATION - 0.05))
  return {
    type: 'fade-up',
    delay: Math.min(0.3 + index * 0.12, maxDelay),
    duration: DEFAULT_ENTER_DURATION,
    easing: 'ease-out',
  }
}
