import { describe, expect, it } from 'vitest'
import {
  animatedStyle,
  clamp01,
  defaultItemEnter,
  ease,
  enterProgress,
  timedProgress,
  type EnterSpec,
} from '@linkzag/scene-types'

const enter = (overrides: Partial<EnterSpec> = {}): EnterSpec => ({
  type: 'fade-up',
  delay: 1,
  duration: 2,
  easing: 'linear',
  ...overrides,
})

describe('animation primitives', () => {
  it('clamps non-finite and out-of-range progress', () => {
    expect(clamp01(-2)).toBe(0)
    expect(clamp01(0.25)).toBe(0.25)
    expect(clamp01(4)).toBe(1)
    expect(clamp01(Number.NaN)).toBe(0)
  })

  it('implements the documented easings', () => {
    expect(ease(0.25, 'linear')).toBe(0.25)
    expect(ease(0.5, 'ease-in-out')).toBe(0.5)
    expect(ease(0, 'ease-out')).toBe(0)
    expect(ease(1, 'ease-out')).toBe(1)
    expect(ease(0.5, 'ease-out')).toBeGreaterThan(0.5)
  })

  it('derives enter progress only from time', () => {
    expect(enterProgress(enter(), 0)).toBe(0)
    expect(enterProgress(enter(), 1)).toBe(0)
    expect(enterProgress(enter(), 2)).toBe(0.5)
    expect(enterProgress(enter(), 3)).toBe(1)
    expect(enterProgress(enter({ type: 'none' }), 0)).toBe(1)
  })

  it('is frame-seekable and idempotent', () => {
    const spec = enter({ easing: 'ease-out' })
    const at = (time: number) => JSON.stringify(animatedStyle(spec, time))
    expect(at(1.75)).toBe(at(1.75))
    expect(timedProgress(1.75, 1, 2, 'ease-out')).toBe(timedProgress(1.75, 1, 2, 'ease-out'))
  })
})

describe('animated style', () => {
  it('fades and lifts from below', () => {
    expect(animatedStyle(enter(), 0)).toEqual({ opacity: 0, transform: 'translate3d(0, 28px, 0)' })
    expect(animatedStyle(enter(), 3)).toEqual({ opacity: 1, transform: 'translate3d(0, 0px, 0)' })
  })

  it('reveals grow and draw with a horizontal clip', () => {
    const grow = animatedStyle(enter({ type: 'grow' }), 1)
    expect(grow.clipPath).toBe('inset(0 100% 0 0)')
    expect(grow.opacity).toBe(1)
    const draw = animatedStyle(enter({ type: 'draw' }), 1)
    expect(draw.opacity).toBeCloseTo(0.35)
    expect(draw.clipPath).toBe('inset(0 100% 0 0)')
  })

  it('keeps defaults inside the scene duration', () => {
    const spec = defaultItemEnter(9, 3)
    expect(spec.delay).toBeLessThanOrEqual(3 - spec.duration - 0.05)
    expect(spec.delay).toBeGreaterThanOrEqual(0)
  })
})
