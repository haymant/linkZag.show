import { describe, expect, it } from 'vitest'
import { SceneSchema, buildSceneLayout, resolveScene } from '@linkzag/scene-types'

describe('layout', () => {
  it('builds a header, content area, and footer for a slide', () => {
    const scene = resolveScene(
      SceneSchema.parse({
        id: 'layout',
        title: 'A title',
        eyebrow: 'EYEBROW',
        subtitle: 'A subtitle',
        footer: 'Footer',
        items: [],
      }),
    )
    const layout = buildSceneLayout(scene)
    expect(layout.header?.title?.text).toBe('A title')
    expect(layout.header?.eyebrow?.text).toBe('EYEBROW')
    expect(layout.header?.subtitle?.text).toBe('A subtitle')
    expect(layout.footer?.text).toBe('Footer')
    expect(layout.content.y).toBeGreaterThan(layout.header!.rect.y)
    expect(layout.footer!.rect.y).toBeGreaterThan(layout.content.y)
  })

  it('has no chrome for a standalone item', () => {
    const scene = resolveScene(
      SceneSchema.parse({
        id: 'overlay',
        variant: 'item',
        title: 'Ignored on overlays',
        footer: 'Ignored too',
        items: [{ type: 'markdown', content: 'Overlay' }],
      }),
    )
    const layout = buildSceneLayout(scene)
    expect(layout.header).toBeNull()
    expect(layout.footer).toBeNull()
    expect(layout.content).toEqual({ x: 96, y: 96, width: 1728, height: 888 })
  })

  it('honours absolute positions and sizes', () => {
    const scene = resolveScene(
      SceneSchema.parse({
        id: 'absolute',
        items: [
          {
            type: 'markdown',
            content: 'Pinned',
            x: 100,
            y: 200,
            width: 300,
            height: 150,
          },
        ],
      }),
    )
    const layout = buildSceneLayout(scene)
    expect(layout.items[0]!.rect).toEqual({ x: 100, y: 200, width: 300, height: 150 })
  })

  it('stacks auto-flowed items and shares remaining height', () => {
    const scene = resolveScene(
      SceneSchema.parse({
        id: 'flow',
        items: [
          { type: 'markdown', content: 'One' },
          { type: 'markdown', content: 'Two' },
          { type: 'markdown', content: 'Three', height: 100 },
        ],
      }),
    )
    const layout = buildSceneLayout(scene)
    expect(layout.items).toHaveLength(3)
    const [first, second, third] = layout.items
    expect(first!.rect.y).toBe(layout.content.y)
    expect(second!.rect.y).toBeGreaterThan(first!.rect.y + first!.rect.height)
    expect(third!.rect.height).toBe(100)
    expect(third!.rect.y).toBeGreaterThan(second!.rect.y)
  })

  it('defaults explicit heights by item type', () => {
    const scene = resolveScene(
      SceneSchema.parse({
        id: 'heights',
        items: [
          { type: 'markdown', content: 'M', x: 0, y: 0, width: 200 },
          { type: 'quote', text: 'Q', x: 0, y: 0, width: 200 },
        ],
      }),
    )
    const layout = buildSceneLayout(scene)
    expect(layout.items[0]!.rect.height).toBe(420)
    expect(layout.items[1]!.rect.height).toBe(360)
  })
})
