# Architecture

LinkZag.Show is a small monorepo with one data path and no services. Scenes are authored as
files; the same React runtime powers the studio preview and Playwright capture.

```text
content/scenes/*.yaml|json|md
        │
        ▼
@linkzag/scene-loader ── resolves includes, assets, checksum
        │
        ▼
@linkzag/scene-types ── Zod schema, theme, layout, time math, URL parsing
        │
        ▼
@linkzag/scene-runtime ── SceneStage, ItemFrame, header/footer, fonts, readiness
        │
        ├── @linkzag/scene-components ── markdown, ECharts, Mermaid, XYFlow, image, quote, code
        │
        ├── apps/renderer (URL API, capture surface)
        └── apps/studio   (scene switcher, scrubber, controls)
        │
        ▼
@linkzag/capture-engine ── ephemeral Vite server + Playwright Chromium
        │
        ▼
@linkzag/ffmpeg-engine ── libx264, libvpx-vp9, prores_ks, matte compositing, ffprobe
        │
        ▼
@linkzag/cli ── render, capture, video, segment + manifests
```

## Packages

### `@linkzag/scene-types`

The contract shared by every other package.

- Zod schemas for scenes and all item types.
- `resolveScene()` applies the precedence: CLI/URL override → scene file → variant default →
  global default.
- Theme tokens and CSS variables.
- `buildSceneLayout()` implements absolute positioning and vertical auto-flow.
- `animatedStyle()`, `enterProgress()`, and `timedProgress()` are the only motion primitives.
- `parseRenderQuery()` defines the URL API.

### `@linkzag/scene-loader`

Loads YAML, JSON, and Markdown; parses Markdown frontmatter; resolves relative includes; turns
ECharts/XYFlow data files into options; rewrites local images to renderer asset URLs; computes a
checksum over the scene plus every include; discovers scenes for the studio and CLI.

The Vite plugin adds:

- `/__linkzag/scenes` — discovered scenes and parse errors;
- `/__linkzag/scene?path=…` — one resolved scene;
- `/__linkzag/asset?path=…` — local asset bytes;
- `/__linkzag/health`;
- full reload when a scene, include, or asset changes.

### `@linkzag/scene-runtime`

`SceneStage` owns the exact canvas size, theme variables, backdrop, header/footer, item
positioning, and error overlay. It also implements readiness:

1. wait for bundled fonts;
2. mount items only after fonts are active, so ECharts/Mermaid measure final metrics;
3. each item signals ready after its own async work (chart option, Mermaid render, XYFlow
   fitView, image/avatar/inline-Markdown image decode);
4. wait two animation frames;
5. set `data-linkzag-ready="true"` and update `window.__LINKZAG__`.

This ordering matters: initializing ECharts before fonts settle can produce different axis
layout between a cold and warm font cache, breaking repeat-render determinism.

### `@linkzag/scene-components`

- `MarkdownItem` — react-markdown + GFM + highlight.js.
- `EChartsItem` — SVG renderer, themed defaults, time-driven clip reveal or value scaling.
- `MermaidItem` — serialized render queue, deterministic IDs, classic look, fixed hand-drawn
  seed, theme variables.
- `XyflowItem` — deterministic Dagre layout, custom `lz` edge with progressive draw, staggered
  node reveal.
- `ImageItem` — decode-aware readiness and blend modes.
- `QuoteItem`, `CodeItem` — themed display components.

### `@linkzag/capture-engine`

Starts the real renderer Vite config on an ephemeral port, opens Chromium, waits for readiness,
and captures either one PNG or a frame sequence by calling `window.__LINKZAG__.setTime()` and
waiting for paint.

Determinism measures:

- fixed device scale factor and viewport;
- `--force-color-profile=srgb`;
- software rasterization (`--disable-gpu`, `--disable-gpu-compositing`);
- no LCD subpixel text (`--disable-lcd-text`, `--font-render-hinting=none`);
- no CSS transitions/keyframes in the runtime;
- PNG re-encoded through pngjs after capture, because Chromium's PNG encoder is not byte-stable
  even when every pixel is identical.

### `@linkzag/ffmpeg-engine`

Builds explicit FFmpeg argument lists, encodes, and probes output.

- MP4: libx264, `yuv420p`, `+faststart`, no audio; even dimensions required.
- Transparent MP4: composite the PNG sequence over a matte colour with `overlay`, then encode.
- WebM: libvpx-vp9 with `yuva420p`; ffprobe exposes alpha as `alpha_mode=1`.
- MOV: ProRes 4444 with alpha.
- `probeVideo()` reports codec, dimensions, pixel format, fps, duration, bytes, and alpha.

### `@linkzag/cli`

Thin orchestration over scene resolution, capture, and encoding. It writes manifests and keeps
output naming stable (`output/<id>/<id>-still.png`, `<id>.mp4`, `segment.json`).

## Renderer URL API

```text
/?scene=content/scenes/demo/01-hook.yaml
 &t=2.5
 &theme=dark
 &variant=slide
 &background=theme
 &w=1920&h=1080
 &duration=6
```

- `t` is clamped to `[0, duration]`; omitted `t` means the final frame.
- `w`/`h` change the canvas; authored absolute coordinates are not reflowed.
- `transparent=1` is equivalent to `background=transparent`.

The renderer sets `data-linkzag-ready`, `data-linkzag-error`, `data-scene-id`, `data-theme`,
`data-variant`, and `data-background` for automation.

## Studio

`apps/studio` is a separate Vite app at port `5174`. It fetches the scene list, loads one scene,
and renders the same `SceneStage` under a checkerboard viewport. Controls cover theme,
composition, transparency, time, play/pause, and a renderer link at the current time. Scene
edits trigger a Vite reload; selection uses the scene list API.

## Determinism contract

- Renderer motion is a pure function of `time`.
- ECharts wall-clock animation is disabled; chart motion is computed per frame.
- Mermaid uses deterministic IDs and a fixed hand-drawn seed.
- XYFlow uses fixed layout data or deterministic Dagre layout.
- Fonts are bundled and loaded before measurement.
- Assets are local; no network requests during capture.
- The same scene, options, and time produce byte-identical PNGs on the same machine.
- Golden tests allow a small perceptual tolerance for operating-system font rasterization.

## Testing strategy

| Layer | What it proves |
| --- | --- |
| Unit | Schema, resolution precedence, layout, animation math, URL parsing, loader includes, FFmpeg arguments. |
| Integration | Real Vite renderer, Playwright still/frame capture, transparency, byte-identical repeat render, MP4/WebM/MOV probes. |
| E2E | Renderer URL API, studio interactions, CLI commands, error messages, golden frames. |
| Golden | Light/dark full-frame visual regression with pixel tolerance. |
