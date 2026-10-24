import { describe, expect, it } from 'vitest'
import {
  SceneSchema,
  isTransparent,
  normalizeEnter,
  resolveScene,
} from '@linkzag/scene-types'

const minimal = {
  id: 'unit-scene',
  items: [{ type: 'markdown', content: '# Hello' }],
}

describe('scene schema', () => {
  it('applies defaults for a minimal scene', () => {
    const scene = SceneSchema.parse(minimal)
    expect(scene.duration).toBe(8)
    expect(scene.width).toBe(1920)
    expect(scene.height).toBe(1080)
    expect(scene.padding).toBe(96)
    expect(scene.items).toHaveLength(1)
  })

  it('rejects unknown keys so typos fail loudly', () => {
    const result = SceneSchema.safeParse({ ...minimal, durration: 10 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Unrecognized key')
  })

  it('rejects an item without the fields required by its type', () => {
    const result = SceneSchema.safeParse({
      id: 'bad',
      items: [{ type: 'echarts' }],
    })
    expect(result.success).toBe(false)
  })

  it('normalizes shorthand and object enter specs', () => {
    expect(normalizeEnter('fade')).toMatchObject({
      type: 'fade',
      delay: 0,
      duration: 0.7,
      easing: 'ease-out',
    })
    expect(normalizeEnter({ delay: 1.2 }, { type: 'draw', duration: 2 })).toEqual({
      type: 'draw',
      delay: 1.2,
      duration: 2,
      easing: 'ease-out',
    })
  })
})

describe('scene resolution', () => {
  it('defaults standalone items to a transparent background', () => {
    const scene = SceneSchema.parse({ ...minimal, variant: 'item' })
    const resolved = resolveScene(scene)
    expect(resolved.variant).toBe('item')
    expect(resolved.background).toBe('transparent')
    expect(isTransparent(resolved)).toBe(true)
  })

  it('lets explicit scene values beat variant defaults', () => {
    const scene = SceneSchema.parse({
      ...minimal,
      variant: 'item',
      background: 'theme',
      theme: 'light',
    })
    const resolved = resolveScene(scene)
    expect(resolved.background).toBe('theme')
    expect(resolved.theme).toBe('light')
  })

  it('lets render overrides beat scene values', () => {
    const scene = SceneSchema.parse({
      ...minimal,
      theme: 'light',
      background: 'theme',
      width: 1280,
    })
    const resolved = resolveScene(scene, {
      theme: 'dark',
      background: 'transparent',
      width: 1600,
      duration: 4,
    })
    expect(resolved.theme).toBe('dark')
    expect(resolved.background).toBe('transparent')
    expect(resolved.width).toBe(1600)
    expect(resolved.duration).toBe(4)
    expect(resolved.height).toBe(1080)
  })
})
