# Scene Schema

A scene is a YAML, JSON, or Markdown file under `content/`. The loader validates every scene
with Zod, resolves includes relative to the scene file, and rewrites local assets to renderer
URLs before the React runtime sees them.

## Top-level fields

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | string | file slug | Stable scene identifier; also the default output folder. |
| `title` | string | — | Header title in `slide` mode. |
| `eyebrow` | string | — | Small label above the title. |
| `subtitle` | string | — | Supporting line below the title. |
| `footer` | string | — | Footer text plus the LinkZag brand. |
| `duration` | number | `8` | Seconds; the final frame is at exactly this time. |
| `width` | integer | `1920` | Canvas width in CSS pixels. |
| `height` | integer | `1080` | Canvas height in CSS pixels. |
| `padding` | number | `96` | Outer padding for chrome and auto-flowed items. |
| `theme` | `light` \| `dark` | `dark` | Theme tokens and bundled typography. |
| `variant` | `slide` \| `item` | `slide` | `item` removes chrome and defaults to transparency. |
| `background` | `theme` \| `transparent` \| hex \| `image:<url>` | variant default | `theme` uses the theme background, hex values are literal, `image:` draws a semi-transparent image backdrop under the theme veil. |
| `accent` | hex | theme accent | Per-scene accent override. |
| `items` | array | `[]` | Visual items. |
| `meta` | object | — | Free-form metadata; preserved but not rendered. |

### Markdown scenes

A `.md` scene uses frontmatter for the top-level fields and turns the body into a single
markdown item. If no frontmatter `title` exists, the first `# Heading` becomes the title and is
removed from the body.

```md
---
id: markdown-brief
duration: 9
theme: dark
background: theme
title: One file, one scene
---

## Why declarative?

- Portable.
- Reviewable.
- Deterministic.
```

## Item base fields

All items support:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable key for debugging and tests. |
| `x`, `y` | number | Absolute position. If both are omitted the item is auto-flowed vertically. |
| `width`, `height` | positive number | Explicit size. Auto-flowed items share remaining height. |
| `opacity` | `0..1` | Static opacity multiplier. |
| `rotate` | number | Degrees. |
| `zIndex` | integer | Stacking order. |
| `enter` | string or object | Entrance animation. |

### `enter`

```yaml
enter: fade-up
# or
enter:
  type: draw
  delay: 0.6
  duration: 1.1
  easing: ease-out
```

Types: `none`, `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right`, `scale`, `grow`,
`draw`. Easings: `linear`, `ease-out`, `ease-in-out`.

Default: `fade-up`, staggered by item index (`0.3 + index × 0.12`), duration `0.7s`, always
clamped inside the scene duration.

### `markdown`

| Field | Type | Notes |
| --- | --- | --- |
| `content` | string | Inline GFM markdown. |
| `file` | string | Loader include; mutually exclusive with `content`. |
| `align` | `left` \| `center` \| `right` | Text alignment. |
| `size` | `sm` \| `md` \| `lg` | Typographic scale. |

Supports headings, lists, tables, blockquotes, links, images, and fenced code with syntax
highlighting. Capture readiness waits for any inline images to decode.

```yaml
- type: markdown
  x: 96
  y: 420
  width: 880
  height: 360
  content: |
    ## Three changes

    - **Intent is the new code.**
    - **Evidence is the new review.**
```

### `echarts`

| Field | Type | Notes |
| --- | --- | --- |
| `option` | object | Inline ECharts option. |
| `file` | string | Loader include (`.json`, `.yaml`, `.yml`); mutually exclusive with `option`. |
| `chartAnimation` | object | Deterministic animation settings. |

`option.file` is parsed as data. The runtime applies theme text, axis, legend, grid, tooltip,
and series colour defaults while preserving the option's data and structure. SVG rendering is
used for crisp capture.

```yaml
- type: echarts
  x: 96
  y: 380
  width: 1010
  height: 580
  file: ../../assets/charts/bar.json
  chartAnimation:
    mode: values
    delay: 0.65
    duration: 1.3
    easing: ease-out
```

`chartAnimation` fields:

| Field | Type | Notes |
| --- | --- | --- |
| `enabled` | boolean | `false` disables motion. |
| `mode` | `auto` \| `reveal` \| `values` \| `none` | Default `auto`. |
| `delay` | seconds | Default `enter.delay + min(0.24, enter.duration × 0.3)`. |
| `duration` | seconds | Default `1.15`. |
| `easing` | easing | Default `ease-out`. |

Modes:

- `auto` — bar, pie, and heatmap series scale values; everything else reveals.
- `reveal` — clip the chart from left to right.
- `values` — scale numeric series values from zero while keeping the axis fixed.
- `none` — render the final chart at every time.

ECharts' wall-clock animation is disabled. The chart state is a pure function of scene time.

### `mermaid`

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | Inline Mermaid source. |
| `file` | string | Loader include; mutually exclusive with `code`. |

The runtime configures Mermaid with `securityLevel: strict`, `theme: base`, `look: classic`, and
a fixed `handDrawnSeed` so repeated renders produce identical SVG paths. Theme variables come
from the scene theme.

```yaml
- type: mermaid
  x: 96
  y: 390
  width: 1120
  height: 470
  file: ../../assets/agent-loop.mmd
  enter:
    type: draw
    delay: 0.45
    duration: 1.1
```

### `xyflow`

| Field | Type | Notes |
| --- | --- | --- |
| `nodes` | array | Inline nodes; mutually exclusive with `file`. |
| `edges` | array | Inline edges; defaults to `[]`. |
| `file` | string | Loader include containing `{ nodes, edges }` or a node array. |
| `layout` | `auto` \| `manual` | `auto` uses Dagre; default `auto`. |
| `direction` | `TB` \| `LR` | Dagre direction; default `LR`. |
| `grid` | boolean | Draw a subtle dot grid. |
| `fitViewPadding` | `0..1` | Fit padding; default `0.12`. |
| `flowAnimation` | object | Deterministic node/edge motion. |

Node fields: `id`, `label`, `sublabel`, `x`, `y`, `width`, `height`, `kind`
(`default`, `accent`, `muted`, `input`, `output`).

Edge fields: `id`, `source`, `target`, `label`, `kind` (`solid`, `dashed`, `accent`).

```yaml
- type: xyflow
  file: ../../assets/agent-architecture.json
  layout: auto
  direction: LR
  grid: true
  fitViewPadding: 0.14
  flowAnimation:
    delay: 0.3
    duration: 0.5
    stagger: 0.07
    edgeDuration: 0.55
    edgeStagger: 0.06
```

`flowAnimation` fields: `enabled`, `delay`, `duration`, `stagger`, `edgeDuration`,
`edgeStagger`. Nodes fade/scale in sequence; edges draw progressively; labels appear near the
end. All values derive from scene time.

### `image`

| Field | Type | Notes |
| --- | --- | --- |
| `src` | string | Local path or `data:` URL. `http(s)` URLs are rejected. |
| `file` | string | Loader include; mutually exclusive with `src`. |
| `alt` | string | Accessible description. |
| `fit` | `contain` \| `cover` \| `fill` | Object fit. |
| `blend` | `normal` \| `screen` \| `lighten` \| `multiply` | Blend mode. |

Local images are rewritten to `/__linkzag/asset?path=…`; capture readiness waits for decode.
Remote URLs are rejected because a capture must not depend on the network.

### `quote`

| Field | Type | Notes |
| --- | --- | --- |
| `text` | string | Quote body. |
| `author` | string | Attribution. |
| `source` | string | Secondary attribution. |
| `avatar` | string | Local path or `data:` URL. |
| `accent` | hex | Per-quote accent. |

### `code`

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | Inline source. |
| `file` | string | Loader include; language and filename are inferred when omitted. |
| `language` | string | One of `typescript`, `javascript`, `python`, `rust`, `go`, `json`, `bash`, `sql`, `yaml`, `text`. |
| `filename` | string | Title bar label. |
| `startLine` | integer | First gutter line number. |
| `highlight` | integer[] | Line numbers to emphasise. |
| `showLineNumbers` | boolean | Gutter visibility. |

## Includes and assets

Any include path is resolved relative to the scene file first, then the project root, content
root, and configured search directories. Every include becomes part of the scene checksum, so
the capture manifest changes when source data changes.

```text
content/scenes/demo/02-evidence.yaml
  file: ../../assets/charts/bar.json
      → content/assets/charts/bar.json
```

Local paths are rewritten to renderer asset URLs. `data:` URLs and paths that are already
`/__linkzag/asset?…` are left unchanged. Remote `http(s)` URLs are rejected so a render never
depends on network state.

## Validation

Scenes are strict: unknown keys, missing required fields, bad colours, and unknown enum values
fail with a path-specific error:

```text
Invalid scene: content/scenes/broken.yaml
  items.0.option: Required
```

Use `npm run render -- --scene broken` or open the renderer URL to see the full error.
