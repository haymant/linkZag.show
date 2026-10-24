import { describe, expect, it } from 'vitest'
import { parseRenderQuery } from '@linkzag/scene-types'

describe('URL API', () => {
  it('parses scene, time, dimensions, and overrides', () => {
    const parsed = parseRenderQuery(
      '?scene=content/scenes/demo/01-hook.yaml&t=2.5&w=1600&h=900&theme=light&variant=item&transparent=1',
    )
    expect(parsed.scene).toBe('content/scenes/demo/01-hook.yaml')
    expect(parsed.time).toBe(2.5)
    expect(parsed.overrides).toEqual({
      width: 1600,
      height: 900,
      theme: 'light',
      variant: 'item',
      transparent: true,
    })
    expect(parsed.warnings).toEqual([])
  })

  it('reports bad values and ignores them', () => {
    const parsed = parseRenderQuery('?theme=neon&variant=diagonal&t=nope&w=wide&background=red')
    expect(parsed.time).toBeUndefined()
    expect(parsed.overrides).toEqual({})
    expect(parsed.warnings).toHaveLength(4)
    expect(parsed.warnings.join('\n')).toContain('Unknown theme')
    expect(parsed.warnings.join('\n')).toContain('Invalid t')
  })

  it('accepts a literal background and auto variant', () => {
    const parsed = parseRenderQuery('?background=%23112233&variant=auto')
    expect(parsed.overrides.background).toBe('#112233')
    expect(parsed.overrides.variant).toBe('auto')
  })
})
