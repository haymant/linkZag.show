# LinkZag.Show — Goal Alignment

## Product

LinkZag.Show turns declarative scene files into deterministic, broadcast-quality visual
segments for commentary videos. A scene is data; React renders it; Playwright captures it;
FFmpeg encodes it. No generative AI, no cloud rendering, no manual editing.

## Primary user journey

```bash
npm run segment -- \
  --scene content/scenes/agentic-coding.yaml \
  --theme dark \
  --format png,mp4
```

Produces a reusable segment package:

```text
output/agentic-coding/
  agentic-coding-still.png
  agentic-coding.mp4
  segment.json
```

A still or video can also be produced independently:

```bash
npm run render  -- --scene content/scenes/the-loop-quote.yaml --theme light
npm run capture -- --scene content/scenes/agentic-coding.yaml --fps 30
npm run video   -- --scene content/scenes/agentic-coding.yaml --theme dark
```

## Two composition modes

| Mode | CLI | Behaviour |
| --- | --- | --- |
| Whole slide | `--variant slide` | Theme background, optional eyebrow/title/subtitle/footer, and visual items. |
| Standalone visual | `--variant item` | No slide chrome. Transparent background by default for compositing over commentary. |

`--variant auto` uses the scene's `variant`, and otherwise chooses `slide`. An explicit
`--background` always wins. `--transparent` forces a transparent background.

## Output formats

| Format | Use | Alpha |
| --- | --- | --- |
| PNG | Static slides, thumbnails, overlay cutouts | Yes, when background is transparent |
| MP4 / H.264 | YouTube upload, opaque slide segments | No (H.264 limitation) |
| WebM / VP9 | Animated overlays in editors | Yes |
| MOV / ProRes 4444 | Animated overlays in pro editors | Yes |

MP4 + transparent background requires an explicit `--matte '#00ff00'` (or similar) so the
overlay can be chroma-keyed. Without a matte the CLI fails with an actionable message
rather than silently flattening alpha to black.

## Deterministic contract

- All motion is a pure function of `time`. No CSS keyframes, `setTimeout`, or RAF-driven
  renderer state.
- ECharts animation is disabled; SVG renderer is used for crisp captures.
- Mermaid uses deterministic IDs and bundled fonts.
- React Flow uses fixed positions or deterministic Dagre layout.
- Fonts are bundled (`@fontsource`), not fetched from the network.
- Themes, assets, chart options, markdown, Mermaid, and diagram data resolve locally.
- Re-capturing the same scene/options produces byte-identical PNG frames.
- Golden snapshots cover light and dark themes.

## Deliverables

1. npm-workspaces monorepo matching the Kickoff layout.
2. `apps/renderer` URL API (`scene`, `theme`, `t`, `w`, `h`, `variant`, `background`).
3. `apps/studio` with scene switcher, theme switcher, timeline scrubber, play/pause, and
   live reload.
4. Scene components: markdown, ECharts, Mermaid, XYFlow, image, quote, code.
5. Capture engine (Playwright Chromium), FFmpeg engine, and one CLI with
   `render`, `capture`, `video`, and `segment` commands.
6. YAML/JSON/Markdown scene loading, relative includes, and asset URL rewriting.
7. Unit, integration, end-to-end, determinism, and golden snapshot tests.
8. Example scenes covering every component and both composition modes.
9. Working success-criteria video at 1920x1080, 30 fps, H.264/yuv420p.
10. README, scene schema reference, CLI reference, phase/evidence log, and CI workflow.

## Explicit non-goals (for this MVP)

- Uploading to YouTube or any network service.
- AI storyboard generation, TTS/narration, automatic captions, podcast transcription.
- Video editing, timeline compositing across multiple scenes, transitions, audio muxing.
- Editing scenes through a GUI. Studio is a preview/debug tool only.
- Pixel-level cross-platform guarantees. Determinism is guaranteed per machine/run;
  golden tests use a small perceptual tolerance for OS font rasterisation differences.

These are future extensions. The data model and CLI boundaries leave room for them
without changing the scene runtime.
