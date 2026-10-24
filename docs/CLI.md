# CLI Reference

```bash
npm run linkzag -- <command> [options]
# or the command shortcuts
npm run render  -- [options]
npm run capture -- [options]
npm run video   -- [options]
npm run segment -- [options]
```

The `--` after the npm script is required so npm forwards the flags to LinkZag.

## Common options

| Option | Default | Description |
| --- | --- | --- |
| `-s, --scene <path>` | required | Scene path or scene id. |
| `--theme <light\|dark>` | scene | Theme override. |
| `--variant <auto\|slide\|item>` | scene | Composition override. |
| `--background <value>` | scene | `theme`, `transparent`, or a hex colour. |
| `--transparent` | off | Force a transparent canvas. |
| `--width <px>` | scene | Canvas width override. |
| `--height <px>` | scene | Canvas height override. |
| `--project-root <dir>` | auto | Project root for scene discovery and output. |
| `--base-url <url>` | auto | Reuse a running renderer instead of starting one. |
| `--timeout <ms>` | `60000` | Readiness timeout per page. |
| `--quiet` | off | Suppress progress output; errors still print. |

Dimensions change the canvas, not the authored absolute layout. For a different output size,
prefer a scene authored at that size.

Scene ids are matched recursively under `content/scenes`, by file stem or declared `id`. Thus
`demo-overlay` and `content/scenes/demo/04-overlay.yaml` select the same scene.

## `render`

Capture one PNG.

```bash
npm run render -- --scene agentic-coding
npm run render -- --scene content/scenes/demo/01-hook.yaml --time 2 --out .preview/hook.png
```

| Option | Default | Description |
| --- | --- | --- |
| `--time <seconds>` | scene duration | Frame time. Clamped to the scene duration. |
| `--out <file>` | `output/<id>/<id>-still.png` | Output path. |

The output is canonical PNG (RGBA). Capturing the same scene, overrides, and time twice on the
same machine produces byte-identical files.

## `capture`

Capture a deterministic PNG frame sequence plus `manifest.json`.

```bash
npm run capture -- --scene agentic-coding --fps 30
npm run capture -- --scene demo-loop --from 1 --to 3 --fps 12 --out .preview/loop-frames
```

| Option | Default | Description |
| --- | --- | --- |
| `--fps <fps>` | `30` | Frames per second. |
| `--from <seconds>` | `0` | First frame time. |
| `--to <seconds>` | scene duration | End time, clamped to the scene duration. |
| `--out <dir>` | `output/<id>/frames` | Frame directory. |

Frame count is `round((to - from) × fps)`, starting at `from` and excluding `to`. A 10-second
scene at 30 fps produces exactly 300 files at 30 fps. Files are named `frame-00001.png`,
`frame-00002.png`, … and are written in time order.

`manifest.json` records the scene checksum, resolved dimensions/theme/variant/background, fps,
range, frame count, and per-frame time/bytes.

## `video`

Capture frames and encode video. Frames are temporary unless `--keep-frames` is set.

```bash
npm run video -- --scene agentic-coding --format mp4
npm run video -- --scene demo-overlay --format webm
npm run video -- --scene agentic-coding --format mp4,webm --keep-frames
npm run video -- --scene overlay-architecture --format mp4 --matte "#00FF00"
```

| Option | Default | Description |
| --- | --- | --- |
| `--format <list>` | `mp4` | `mp4`, `webm`, `mov`, comma separated. |
| `--fps <fps>` | `30` | Frame rate. |
| `--from <seconds>` | `0` | First frame. |
| `--to <seconds>` | scene duration | End time. |
| `--matte <hex>` | — | Matte colour for transparent MP4. |
| `--crf <value>` | codec default | Quality; lower is better. |
| `--frames <dir>` | — | Encode an existing frame directory instead of capturing. |
| `--keep-frames` | off | Keep captured frames in the output directory. |
| `--out <dir>` | `output/<id>` | Video directory. |

Output names are `<scene-id>.<ext>`.

### Codecs

| Format | Encoder | Pixel format | Notes |
| --- | --- | --- | --- |
| MP4 | `libx264` | `yuv420p` | `+faststart`, no audio, even dimensions required. |
| WebM | `libvpx-vp9` | `yuva420p` | Alpha channel; `alpha_mode=1` in WebM. |
| MOV | `prores_ks` profile 4444 | `yuva444p10le` (ffprobe may report 12-bit) | Alpha channel. |

`ffprobe` reports VP9 alpha as `pix_fmt=yuv420p` plus `TAG:alpha_mode=1`; this is the standard
WebM way to signal the separate alpha plane. The CLI manifest marks such files transparent.

### Transparent MP4

H.264 cannot carry alpha. A transparent scene + MP4 without `--matte` fails before capture:

```text
MP4/H.264 cannot carry an alpha channel, but this scene is transparent.
Choose one of:
  - add --matte "#00FF00" and chroma-key the result, or
  - use --format webm for VP9 alpha, or
  - use --format mov for ProRes 4444 alpha, or
  - make the background opaque with --background theme.
```

With `--matte`, transparent frames are composited over a solid colour first:

```bash
npm run video -- --scene demo-overlay --format mp4 --matte "#00FF00"
```

## `segment`

Produce a reusable segment package with a still, one or more videos, and `segment.json`.

```bash
npm run segment -- --scene agentic-coding
npm run segment -- --scene demo-overlay --format png,webm,mov
npm run segment -- --scene demo-hook --format png --still-time 2
```

| Option | Default | Description |
| --- | --- | --- |
| `--format <list>` | `png,mp4` | Any of `png`, `mp4`, `webm`, `mov`. |
| `--still-time <seconds>` | scene duration | Still frame time. |
| `--fps <fps>` | `30` | Video frame rate. |
| `--matte <hex>` | — | Matte colour for transparent MP4. |
| `--crf <value>` | codec default | Quality. |
| `--keep-frames` | off | Keep frames under `<out>/frames`. |
| `--out <dir>` | `output/<id>` | Package directory. |

Example package:

```text
output/demo-overlay/
  demo-overlay-still.png
  demo-overlay.webm
  segment.json
```

`segment.json`:

```json
{
  "version": 1,
  "kind": "linkzag-segment",
  "scene": {
    "id": "demo-overlay",
    "path": "content/scenes/demo/04-overlay.yaml",
    "checksum": "…",
    "width": 1600,
    "height": 900,
    "duration": 6,
    "theme": "dark",
    "variant": "item",
    "background": "transparent"
  },
  "options": {
    "fps": 30,
    "transparent": true,
    "matte": null,
    "formats": ["png", "webm"]
  },
  "files": [
    {
      "format": "png",
      "path": "output/demo-overlay/demo-overlay-still.png",
      "bytes": 123456,
      "width": 1600,
      "height": 900,
      "time": 6,
      "transparent": true
    },
    {
      "format": "webm",
      "path": "output/demo-overlay/demo-overlay.webm",
      "bytes": 234567,
      "width": 1600,
      "height": 900,
      "duration": 6,
      "fps": 30,
      "codec": "vp9",
      "pixelFormat": "yuv420p",
      "transparent": true
    }
  ]
}
```

`generatedAt` is also written. Video entries are probed with ffprobe after encoding; a failed
probe fails the command.

## Scene discovery

A scene can be addressed by path or id:

```bash
npm run render -- --scene content/scenes/agentic-coding.yaml
npm run render -- --scene agentic-coding
```

Ids resolve against `content/scenes/**` (including subdirectories) by file slug. If a name is
ambiguous, the CLI lists the candidates. Paths are resolved relative to the current directory,
project root, `content/scenes`, `content/examples`, and `content`.

## Renderer reuse

The CLI starts an ephemeral Vite renderer by default. To reuse a running server:

```bash
npm run dev:renderer -- --host 127.0.0.1 --port 5180 --strictPort
npm run render -- --scene demo-hook --base-url http://127.0.0.1:5180
```

Studio runs on port `5174`; its preview is a separate Vite app, not the capture renderer.

## Environment

| Variable | Purpose |
| --- | --- |
| `FFMPEG_PATH` | Override the `ffmpeg` binary. |
| `FFPROBE_PATH` | Override the `ffprobe` binary. |

FFmpeg and ffprobe are checked before any video work. Missing binaries produce installation
guidance (`brew install ffmpeg` on macOS, distro package on Linux).

## Exit codes

- `0` — success.
- `1` — validation, render, probe, or FFmpeg failure. Errors print to stderr with a
  `LinkZag error:` prefix and any structured details.
