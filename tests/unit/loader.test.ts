import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SceneError,
  discoverScenes,
  loadScene,
} from '@linkzag/scene-loader'

const projectRoot = process.cwd()

describe('scene loader', () => {
  it('loads YAML scenes and resolves included assets', () => {
    const loaded = loadScene('agentic-coding', { projectRoot })
    expect(loaded.scene.id).toBe('agentic-coding')
    expect(loaded.scene.items).toHaveLength(3)
    expect(loaded.relativePath).toBe('content/scenes/agentic-coding.yaml')
    expect(loaded.sources.some((file) => file.endsWith('agent-loop.mmd'))).toBe(true)
    expect(loaded.sources.some((file) => file.endsWith('line.json'))).toBe(true)

    const mermaid = loaded.scene.items.find((item) => item.type === 'mermaid')
    expect(mermaid && mermaid.type === 'mermaid' && mermaid.code).toContain('flowchart')

    const chart = loaded.scene.items.find((item) => item.type === 'echarts')
    expect(chart && chart.type === 'echarts' && chart.option.series).toBeTruthy()
  })

  it('loads Markdown frontmatter and turns the body into a markdown item', () => {
    const loaded = loadScene('markdown-brief', { projectRoot })
    expect(loaded.scene.id).toBe('markdown-brief')
    expect(loaded.scene.title).toBe('One file, one scene')
    expect(loaded.scene.accent).toBe('#34D399')
    expect(loaded.scene.items[0]?.type).toBe('markdown')
    expect(loaded.relativePath.endsWith('.md')).toBe(true)
  })

  it('loads a standalone overlay scene with transparent defaults', () => {
    const loaded = loadScene('content/scenes/demo/04-overlay.yaml', { projectRoot })
    expect(loaded.scene.variant).toBe('item')
    expect(loaded.scene.background).toBe('transparent')
  })

  it('loads JSON scene documents', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkzag-json-'))
    const file = path.join(dir, 'json-card.json')
    fs.writeFileSync(
      file,
      JSON.stringify({
        id: 'json-card',
        title: 'JSON scene',
        items: [{ type: 'markdown', content: 'Loaded from JSON.' }],
      }),
    )
    try {
      const loaded = loadScene(file, { projectRoot })
      expect(loaded.scene.id).toBe('json-card')
      expect(loaded.scene.items[0]?.type).toBe('markdown')
      expect(loaded.sources).toEqual([file])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('discovers every bundled scene without parse errors', () => {
    const result = discoverScenes({ projectRoot })
    expect(result.errors).toEqual([])
    expect(result.scenes.length).toBeGreaterThanOrEqual(13)
    for (const scene of result.scenes) {
      expect(scene.id.length).toBeGreaterThan(0)
      expect(scene.duration).toBeGreaterThan(0)
      expect(path.isAbsolute(scene.absolutePath)).toBe(true)
    }
  })

  it('reports a useful error for a missing scene', () => {
    expect(() => loadScene('does-not-exist', { projectRoot })).toThrow(SceneError)
    try {
      loadScene('does-not-exist', { projectRoot })
    } catch (error) {
      expect((error as SceneError).message).toContain('Scene not found')
    }
  })

  it('fails an invalid scene with path-specific details', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkzag-invalid-'))
    const file = path.join(dir, 'broken.yaml')
    fs.writeFileSync(file, 'id: broken\nitems:\n  - type: echarts\n')
    try {
      try {
        loadScene(file, { projectRoot })
        expect.unreachable('expected loadScene to fail')
      } catch (error) {
        expect(error).toBeInstanceOf(SceneError)
        const sceneError = error as SceneError
        expect(sceneError.message).toContain('Invalid scene')
        expect(sceneError.message).toContain(file)
        expect(sceneError.details?.join('\n')).toContain('items.0')
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('resolves a scene by id from a nested demo folder by path', () => {
    const loaded = loadScene('content/scenes/demo/01-hook.yaml', { projectRoot })
    expect(loaded.scene.id).toBe('demo-hook')
  })

  it('resolves a scene by its declared id in a nested folder', () => {
    const loaded = loadScene('demo-overlay', { projectRoot })
    expect(loaded.scene.id).toBe('demo-overlay')
    expect(loaded.relativePath).toBe('content/scenes/demo/04-overlay.yaml')
  })

  it('resolves a scene by a nested file stem', () => {
    const loaded = loadScene('01-hook', { projectRoot })
    expect(loaded.scene.id).toBe('demo-hook')
    expect(loaded.relativePath).toBe('content/scenes/demo/01-hook.yaml')
  })
})
