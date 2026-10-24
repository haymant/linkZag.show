import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

const run = promisify(execFile)
const root = process.cwd()
const cli = path.join(root, 'node_modules', '.bin', 'tsx')
const baseUrl = 'http://127.0.0.1:4317'

async function linkzag(args: string[], expectFailure = false): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await run(cli, ['packages/cli/src/index.ts', ...args], {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    })
    return result
  } catch (error) {
    if (!expectFailure) throw error
    const failed = error as { stdout?: string; stderr?: string }
    return { stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' }
  }
}

test.describe('CLI', () => {
  test('render writes a still PNG', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkzag-cli-still-'))
    const out = path.join(dir, 'still.png')
    await linkzag([
      'render',
      '--scene',
      'content/scenes/demo/01-hook.yaml',
      '--base-url',
      baseUrl,
      '--time',
      '2',
      '--width',
      '640',
      '--height',
      '360',
      '--out',
      out,
      '--quiet',
    ])
    const png = PNG.sync.read(await fs.readFile(out))
    expect(png.width).toBe(640)
    expect(png.height).toBe(360)
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('segment writes a manifest, still, and transparent WebM', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkzag-cli-segment-'))
    const out = path.join(dir, 'segment')
    await linkzag([
      'segment',
      '--scene',
      'content/scenes/demo/04-overlay.yaml',
      '--base-url',
      baseUrl,
      '--format',
      'png,webm',
      '--fps',
      '5',
      '--width',
      '320',
      '--height',
      '180',
      '--crf',
      '40',
      '--out',
      out,
      '--quiet',
    ])
    const manifest = JSON.parse(
      await fs.readFile(path.join(out, 'segment.json'), 'utf8'),
    ) as {
      kind: string
      options: { transparent: boolean }
      files: Array<{ format: string; transparent: boolean; width: number; height: number }>
    }
    expect(manifest.kind).toBe('linkzag-segment')
    expect(manifest.options.transparent).toBe(true)
    expect(manifest.files.map((file) => file.format)).toEqual(['png', 'webm'])
    expect(manifest.files[0]?.transparent).toBe(true)
    expect(manifest.files[1]?.transparent).toBe(true)
    expect(manifest.files[1]?.width).toBe(320)

    const still = PNG.sync.read(await fs.readFile(path.join(out, 'demo-overlay-still.png')))
    expect(still.data[3]).toBe(0)
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('transparent MP4 fails with an actionable matte message', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkzag-cli-matte-'))
    const result = await linkzag(
      [
        'video',
        '--scene',
        'content/scenes/demo/04-overlay.yaml',
        '--base-url',
        baseUrl,
        '--format',
        'mp4',
        '--width',
        '320',
        '--height',
        '180',
        '--out',
        path.join(dir, 'out'),
        '--quiet',
      ],
      true,
    )
    expect(result.stderr).toContain('MP4/H.264 cannot carry an alpha channel')
    expect(result.stderr).toContain('--matte')
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('a missing scene fails with a scene-not-found message', async () => {
    const result = await linkzag(
      ['render', '--scene', 'missing-scene', '--base-url', baseUrl, '--quiet'],
      true,
    )
    expect(result.stderr).toContain('Scene not found')
  })
})
