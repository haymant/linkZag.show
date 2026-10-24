# LinkZag.Show

Deterministic React scenes → PNG frames → YouTube-ready video segments.

LinkZag.Show is a local, file-driven scene renderer for technical commentary videos. A scene
is YAML, JSON, or Markdown. The runtime renders it in React, Playwright captures exact frames,
and FFmpeg turns those frames into H.264 MP4 or alpha-capable overlays. No cloud renderer, no
generative image pipeline, and no hidden timers.

```text
scene.yaml / scene.json / scene.md
        ↓
React scene runtime  (charts, diagrams, markdown, code, images)
        ↓
Playwright capture   (still PNG or deterministic PNG sequence)
        ↓
FFmpeg               (MP4 · WebM VP9 alpha · ProRes 4444)
        ↓
output/<scene>/
```

## Requirements

- Node.js 22.22.2 or newer
- npm 10 or newer
- FFmpeg and ffprobe on `PATH` for video output
- Chromium for Playwright (`npx playwright install chromium`)

## Install

```bash
npm install
npx playwright install chromium
```

## Quick start

```bash
# Showcase scene → reusable segment package
npm run segment -- --scene content/scenes/agentic-coding.yaml

# Full demo: stills, MP4, transparent overlay, and metadata
open DEMO.md

# Studio (scene switcher, scrubber, theme/composition controls)
npm run dev

# Renderer only (URL-driven preview)
npm run dev:renderer
```

`npm run dev` starts the studio at `http://127.0.0.1:5174`; its preview is self-contained. Run
`npm run dev:renderer` in another terminal to use the studio's “Open renderer” link at
`http://127.0.0.1:5173`.

## CLI

All commands accept a scene path or a scene id from `content/scenes`.

```bash
npm run render  -- --scene agentic-coding --time 4 --out preview.png
npm run capture -- --scene agentic-coding --fps 30
npm run video   -- --scene agentic-coding --format mp4 --out videos
npm run segment -- --scene content/scenes/demo/04-overlay.yaml --format png,webm
```

`segment` produces:

```text
output/agentic-coding/
  agentic-coding-still.png
  agentic-coding.mp4
  segment.json
```

See [docs/CLI.md](docs/CLI.md) for every flag, manifest schema, and failure mode.

## Scene format

```yaml
id: demo-hook
duration: 6
width: 1920
height: 1080
theme: dark
background: theme
eyebrow: DEMO · 01 / THE SHIFT
title: The bottleneck moved
subtitle: From typing code to specifying, verifying, and integrating it.

items:
  - type: markdown
    x: 96
    y: 420
    width: 880
    height: 360
    content: |
      ## Three changes

      - **Intent is the new code.**
      - **Evidence is the new review.**
      - **Loops are the new tools.**
    enter:
      type: fade-up
      delay: 0.35
      duration: 0.8
```

Supported item types: `markdown`, `echarts`, `mermaid`, `xyflow`, `image`, `quote`, `code`.
Absolute layout (`x`, `y`, `width`, `height`) is optional; omitted coordinates flow vertically.

See [docs/SCENES.md](docs/SCENES.md) for the complete schema reference.

### Motion

All renderer motion is a pure function of `time`:

- entrance styles use `enter` specs (`fade-up`, `grow`, `draw`, …);
- ECharts either reveals left-to-right or scales values from zero;
- Mermaid uses deterministic IDs, the classic look, and a fixed hand-drawn seed;
- XYFlow staggers nodes and progressively draws edges;
- no CSS keyframes, `setTimeout`, or requestAnimationFrame-driven scene state.

The same scene and time produce byte-identical PNGs on the same machine.

## Composition modes

| Mode | Default background | Chrome | Use |
| --- | --- | --- | --- |
| `slide` | theme | eyebrow / title / subtitle / footer | Full video page |
| `item` | transparent | none | Overlay on footage |

```bash
npm run render -- --scene overlay-architecture --variant item --transparent
```

## Output formats

| Format | Codec | Alpha | Use |
| --- | --- | --- | --- |
| PNG | RGBA | Yes | Stills, transparent cutouts |
| MP4 | H.264 / yuv420p | No | YouTube, opaque segments |
| WebM | VP9 (alpha_mode=1) | Yes | Animated overlays in editors |
| MOV | ProRes 4444 | Yes | ProRes editing workflows |

H.264 cannot carry alpha. Rendering a transparent scene to MP4 without `--matte` fails with
guidance instead of silently flattening the overlay. Add `--matte "#00FF00"` to composite and
chroma-key it later, or use WebM/MOV.

## Renderer URL API

```text
http://127.0.0.1:5173/?scene=content/scenes/agentic-coding.yaml&t=4&theme=dark&w=1920&h=1080
```

| Parameter | Meaning |
| --- | --- |
| `scene` | Scene path relative to the project root, or a scene id |
| `t` | Time in seconds; defaults to the final frame |
| `theme` | `light` or `dark` |
| `variant` | `slide`, `item`, or `auto` |
| `background` | `theme`, `transparent`, or a hex colour |
| `transparent` | `1` or `true` |
| `w`, `h` | Canvas size override |
| `duration` | Duration override used by capture |

The page sets `data-linkzag-ready="true"` when fonts, images, charts, Mermaid, and XYFlow have
settled. `window.__LINKZAG__` exposes `setTime()` and `getTime()` for frame capture.

## Tests

```bash
npm run typecheck
npm run test          # unit + integration (loader, PNG, FFmpeg)
npm run build         # both apps
npm run test:e2e      # renderer, studio, CLI, golden snapshots
npm run test:all      # all of the above
npm run goldens:update  # intentionally regenerate tests/goldens after a visual change
```

Golden frames live in `tests/goldens` and compare with a small perceptual tolerance for OS font
rasterisation. Repeat-render determinism is asserted exactly on the same machine.

## Repository layout

```text
apps/
  renderer/            URL-driven scene runtime
  studio/              preview, scene switcher, timeline
packages/
  scene-types/         schema, themes, layout, animation, URL parsing
  scene-loader/        YAML/JSON/Markdown loading, includes, Vite middleware
  scene-components/    seven renderers + chart theming and animation
  scene-runtime/       scene stage, item frames, fonts, readiness protocol
  capture-engine/      Vite server + Playwright still/frame capture
  ffmpeg-engine/       encode, matte, probe
  cli/                 render, capture, video, segment
content/
  scenes/              showcase and demo scenes
  assets/              charts, Mermaid, XYFlow, code, images
tests/
  unit/ integration/ e2e/ goldens/
docs/
  GOALS.md PHASES.md SCENES.md CLI.md ARCHITECTURE.md Kickoff.md
```

## Documentation

- [DEMO.md](DEMO.md) — end-to-end CLI walkthrough with the bundled demo scenes
- [docs/SCENES.md](docs/SCENES.md) — scene and item schema
- [docs/CLI.md](docs/CLI.md) — command and manifest reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — packages, data flow, determinism
- [docs/PHASES.md](docs/PHASES.md) — phase exit criteria and evidence

## License

MIT. See [LICENSE](LICENSE).
