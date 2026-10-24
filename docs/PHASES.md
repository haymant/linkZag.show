# Implementation Phases & Exit Criteria

Rule: a phase starts only after the previous phase's evidence is recorded here and the
commands passed. Evidence is a command plus its observed result, not a claim.

---

## Phase 1 — Foundation, scene contract, loader

**Entry:** Kickoff and goals aligned; Node, npm, FFmpeg, and Playwright Chromium available.

**Build:**
- npm workspaces, TypeScript/Vite/Vitest/Playwright configuration.
- `scene-types`: Zod schema, resolution, theme tokens, layout, time-based animation math.
- `scene-loader`: YAML/JSON/Markdown loading, relative includes, asset URLs, discovery,
  Vite content middleware, live-reload hook.
- CLI argument/path foundations and unit/integration test harness.

**Exit criteria:**
1. `npm install` succeeds from a clean tree.
2. `npm run typecheck` passes with zero errors.
3. Unit tests cover schema validation, defaults/overrides, themes, layout, animation,
   scene loading, includes, and Markdown scenes.
4. Integration tests prove YAML -> resolved scene, include inlining, and asset rewriting.
5. Invalid scenes fail with a path-specific, actionable error.

**Evidence (2026-10-24; Node 24.22.0, npm 11.19.1):**
- `npm install` completed and linked the npm workspaces.
- `npm run typecheck` → exit 0, zero diagnostics.
- `npm run test` → 8 files, 47 tests passed. Coverage includes schema defaults and strict
  validation, override precedence, layout/auto-flow, animation math, URL parsing, YAML/JSON/
  Markdown loading, includes, asset URL rewriting, checksums, discovery, and nested declared-id
  lookup.
- `tests/unit/loader.test.ts` asserts a missing scene reports `Scene not found`, and a broken
  scene reports `Invalid scene: <absolute path>` with a Zod path such as `items.0`.

---

## Phase 2 — Deterministic runtime and visual components

**Entry:** Phase 1 exit evidence recorded.

**Build:**
- React scene runtime with exact canvas sizing, theme CSS variables, backdrop, header.
- Time-driven entrance animation; no renderer CSS keyframes/timers.
- All seven item components plus ECharts SVG theming, Mermaid deterministic config,
  XYFlow deterministic layout, syntax highlighting, image readiness.
- Readiness protocol (`data-linkzag-ready`, `window.__LINKZAG__`), error protocol.
- Renderer app and example scenes for every component/mode.

**Exit criteria:**
1. Typecheck and production build pass.
2. Each item type renders in light and dark themes without console/page errors.
3. Transparent item scenes produce transparent captures.
4. Readiness protocol resolves only after fonts, images, charts, Mermaid, and XYFlow settle.
5. Visual inspection of rendered slides confirms layout/legibility at 1920x1080.
6. Component/unit integration tests pass.

**Evidence (2026-10-24):**
- `npm run test:all` → typecheck 0 errors; 47 unit/integration tests passed; both production
  builds passed; 18 E2E tests passed in 48.2 s.
- `tests/e2e/scene-gallery.spec.ts` renders all 16 bundled scenes in dark and light (32 renders).
  Every render reached `data-linkzag-ready="true"` with no page or console errors. The set
  exercises all seven item types.
- Transparency and repeatability: an 800×450 overlay capture has corner alpha `0`; two captures
  of the same scene/time are byte-identical.
- Full-runtime determinism: two 1920×1080 `agentic-coding` renders at `t=6` produced the same
  SHA-256 (`1b400cb9…`); two transparent `demo-overlay` renders also matched (`61279491…`).
  This covers ECharts, Mermaid, and XYFlow.
- Readiness waits for bundled fonts before mounting items, then for ECharts, Mermaid, XYFlow
  `fitView`, image/avatar/inline-Markdown decode, and two animation frames.
- Visual pass at 1920×1080 covered `title-card` (image), `the-loop-quote`, `verified-loop`
  (code), `chart-gallery-advanced`, `overlay-chart`, and all four demo stills. No clipping or
  overlap was observed.

---

## Phase 3 — Studio and URL API

**Entry:** Phase 2 exit evidence recorded.

**Build:**
- Renderer URL API: `scene`, `theme`, `t`, `w`, `h`, `variant`, `background`.
- Studio: scene switcher, theme switcher, timeline scrubber, play/pause, variant toggle,
  transparency preview, renderer link, scene errors.
- Live reload for scene/include/asset edits.

**Exit criteria:**
1. Renderer URL combinations produce correct theme, size, time, and variant.
2. Studio e2e test changes scene, theme, time, and composition mode.
3. Playback advances time and can be scrubbed to an exact value.
4. A scene edit triggers browser reload/re-fetch.
5. `npm run build` emits both apps.

**Evidence (2026-10-24):**
- Renderer E2E (6 tests) verifies theme, variant, width/height, time, scene id, the
  `window.__LINKZAG__` API, deterministic seeking, final-frame default, missing/unknown scene
  errors, and a real content-file edit triggering a full reload.
- Studio E2E (5 tests) verifies the scene list, final-frame preview, scene switching, theme and
  composition overrides, transparent checkerboard preview, scrubbing, playback/pause, and the
  renderer link at the current time.
- `npm run build` emits both `apps/renderer/dist` and `apps/studio/dist`.

---

## Phase 4 — Capture, FFmpeg, segment CLI

**Entry:** Phase 3 exit evidence recorded.

**Build:**
- Playwright capture engine (still, frame sequence, transparent backgrounds).
- FFmpeg engine (MP4/H.264, WebM/VP9 alpha, ProRes 4444 MOV alpha, matte keying).
- CLI commands `render`, `capture`, `video`, `segment`; manifests, progress, errors.
- Deterministic frame naming and output directories matching the Kickoff.

**Exit criteria:**
1. Static PNG exists with requested dimensions/theme/time.
2. Frame sequence has exactly `duration * fps` ordered files.
3. MP4 is H.264/yuv420p, correct dimensions/fps/duration, fast-start, no audio.
4. Transparent PNG has a genuinely transparent pixel region.
5. WebM carries VP9 alpha (`alpha_mode=1`); MOV reports ProRes 4444 alpha.
6. MP4 + transparent without `--matte` fails with actionable guidance; with matte succeeds.
7. Two renders of the same still are byte-identical.
8. `segment.json` lists verified files and metadata.

**Evidence (2026-10-24; FFmpeg/ffprobe 9.0.2, Playwright 1.64.1):**
- Vitest integration: 800×450 still has the requested size; a transparent overlay has alpha `0`
  in the corner; repeat captures are byte-identical; a 0–0.3 s sequence at 10 fps produces
  exactly 3 ordered frames and encodes to MP4, VP9 WebM, and ProRes 4444.
- CLI E2E: `render` writes a PNG; `segment` writes a manifest, still, and transparent WebM;
  transparent MP4 without `--matte` fails with the documented guidance; a missing scene fails
  with `Scene not found`.
- `npm run capture … --fps 12 --from 0 --to 1` produced 12 files plus `manifest.json`, with the
  last frame at `0.916667 s`.
- `videos/agentic-coding.mp4` probes as H.264, 1920×1080, `yuv420p`, 30/1 fps, 300 frames,
  10.000 s, 468,333 bytes. `moov` precedes `mdat` (fast-start) and there are zero audio streams.
- VP9 alpha is reported by this ffprobe as `pix_fmt=yuv420p` plus `TAG:alpha_mode=1`; the probe
  treats that as alpha. MOV reports ProRes 4444 with an alpha pixel format.
- H.264 cannot carry alpha, so transparent MP4 requires `--matte` and the CLI refuses to flatten
  it silently.

---

## Phase 5 — Golden tests, success criteria, docs, CI, publish

**Entry:** Phase 4 exit evidence recorded.

**Build:**
- Golden PNG snapshots for light/dark.
- Full success-criteria scene and video (`content/scenes/agentic-coding.yaml` ->
  `videos/agentic-coding.mp4`).
- README, scene schema, CLI, architecture docs, CI workflow, license/gitignore.
- Git repository initialized and pushed to the requested remote when credentials permit.

**Exit criteria:**
1. All unit/integration/e2e/golden tests pass in one run.
2. `npm run build` and typecheck pass.
3. Success video generated at 1920x1080/30 fps/10 s and verified by ffprobe.
4. The video contains charts, a diagram, markdown, and animation (frame samples inspected).
5. Clean-room commands in README reproduce the success video.
6. CI workflow is syntactically valid and mirrors local checks.
7. Commit exists; push attempted; result recorded.

**Evidence (2026-10-24; Node 24.22.0, npm 11.19.1, FFmpeg 9.0.2):**
- `npm run test:all` → typecheck 0 errors; 47 unit/integration tests passed; renderer and
  studio builds passed; 18 E2E/golden tests passed in 48.2 s. `playwright-report` and
  `test-results/.last-run.json` report `passed`.
- `videos/agentic-coding.mp4` → H.264, 1920×1080, `yuv420p`, 30 fps, 300 frames, 10.000 s,
  468,333 bytes. `moov` at byte 36 precedes `mdat` at byte 4,411 and there are no audio streams.
- Extracted frames at 0.5 s, 3.0 s, 8.0 s, and 9.97 s show the header/markdown, ECharts reveal,
  Mermaid diagram, and the completed final composition.
- `README.md`, `DEMO.md`, and the docs contain the clean-room install, preview, render, capture,
  video, segment, manifest, URL API, and troubleshooting commands.
- `.github/workflows/ci.yml` parses as YAML with a `verify` job; its steps mirror typecheck, unit/
  integration tests, build, E2E/golden tests, and failure-artifact upload.
- Git commit `6590b28984aed65fa4f05c0e055f8c78914a4216` contains 125 files. Remote
  `origin` is `https://github.com/haymant/linkZag.show.git`.
- `git push -u origin main` succeeded; `git ls-remote --heads origin` reports
  `04e2f5a6a3f95f788be33ffe2bf92470a5c9ce92 refs/heads/main`, and `main` tracks `origin/main`.
