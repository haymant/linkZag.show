import { describe, expect, it } from 'vitest'
import { buildEncodeArgs, videoExtension, type EncodeOptions } from '@linkzag/ffmpeg-engine'

const options = (overrides: Partial<EncodeOptions> = {}): EncodeOptions => ({
  framesDir: '/tmp/linkzag-frames',
  fps: 30,
  width: 1920,
  height: 1080,
  format: 'mp4',
  output: '/tmp/out.mp4',
  ...overrides,
})

describe('ffmpeg command builder', () => {
  it('encodes a YouTube-safe H.264 MP4', () => {
    const args = buildEncodeArgs(options())
    expect(args).toContain('libx264')
    expect(args).toContain('yuv420p')
    expect(args).toContain('+faststart')
    expect(args.join(' ')).toContain('frame-%05d.png')
    expect(args.at(-1)).toBe('/tmp/out.mp4')
    expect(args).not.toContain('-filter_complex')
  })

  it('composites transparent PNGs over a matte for MP4', () => {
    const args = buildEncodeArgs(options({ matte: '#00FF00' }))
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('overlay=shortest=1')
    expect(filter).toContain('format=yuv420p')
    expect(args.join(' ')).toContain('color=c=0x00FF00')
  })

  it('encodes VP9 alpha for WebM', () => {
    const args = buildEncodeArgs(options({ format: 'webm', output: '/tmp/out.webm' }))
    expect(args).toContain('libvpx-vp9')
    expect(args).toContain('yuva420p')
    expect(args).toContain('-auto-alt-ref')
    expect(args.join(' ')).not.toContain('libx264')
  })

  it('encodes ProRes 4444 for MOV', () => {
    const args = buildEncodeArgs(options({ format: 'mov', output: '/tmp/out.mov' }))
    expect(args).toContain('prores_ks')
    expect(args).toContain('4444')
    expect(args).toContain('yuva444p10le')
  })

  it('uses the right file extensions', () => {
    expect(videoExtension('mp4')).toBe('mp4')
    expect(videoExtension('webm')).toBe('webm')
    expect(videoExtension('mov')).toBe('mov')
  })
})
