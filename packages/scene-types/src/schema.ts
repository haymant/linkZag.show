import { z } from 'zod'

export const THEME_NAMES = ['light', 'dark'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export const SCENE_VARIANTS = ['slide', 'item'] as const
export type SceneVariant = (typeof SCENE_VARIANTS)[number]

export const ENTER_TYPES = [
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'slide-left',
  'slide-right',
  'scale',
  'grow',
  'draw',
] as const
export type EnterType = (typeof ENTER_TYPES)[number]

export const EASINGS = ['linear', 'ease-out', 'ease-in-out'] as const
export type Easing = (typeof EASINGS)[number]

export interface EnterSpec {
  type: EnterType
  delay: number
  duration: number
  easing: Easing
}

export interface EnterInput {
  type?: EnterType
  delay?: number
  duration?: number
  easing?: Easing
}

export const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const BackgroundSchema = z.union([
  z.literal('theme'),
  z.literal('transparent'),
  z.string().regex(HEX_COLOR_RE, 'Expected "theme", "transparent", or a hex colour such as #0B1020'),
  z.string().regex(/^image:\S+$/, 'Expected image:<url> for an image backdrop'),
])
export type BackgroundSpec = z.infer<typeof BackgroundSchema>

const zHex = z.string().regex(HEX_COLOR_RE, 'Expected a hex colour such as #38BDF8')
const zFiniteNumber = z.number().finite()

export const zEnter = z.union([
  z.enum(ENTER_TYPES),
  z
    .object({
      type: z.enum(ENTER_TYPES).optional(),
      delay: zFiniteNumber.min(0).optional(),
      duration: zFiniteNumber.positive().optional(),
      easing: z.enum(EASINGS).optional(),
    })
    .strict(),
])

export const ChartAnimationSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(['auto', 'reveal', 'values', 'none']).optional(),
    delay: zFiniteNumber.min(0).optional(),
    duration: zFiniteNumber.positive().optional(),
    easing: z.enum(EASINGS).optional(),
  })
  .strict()

export const FlowAnimationSchema = z
  .object({
    enabled: z.boolean().optional(),
    delay: zFiniteNumber.min(0).optional(),
    duration: zFiniteNumber.positive().optional(),
    stagger: zFiniteNumber.min(0).optional(),
    edgeDuration: zFiniteNumber.positive().optional(),
    edgeStagger: zFiniteNumber.min(0).optional(),
  })
  .strict()

const base = {
  id: z.string().min(1).optional(),
  x: zFiniteNumber.optional(),
  y: zFiniteNumber.optional(),
  width: zFiniteNumber.positive().optional(),
  height: zFiniteNumber.positive().optional(),
  opacity: zFiniteNumber.min(0).max(1).optional(),
  rotate: zFiniteNumber.optional(),
  zIndex: zFiniteNumber.int().optional(),
  enter: zEnter.optional(),
}

export const MarkdownItemSchema = z
  .object({
    ...base,
    type: z.literal('markdown'),
    content: z.string(),
    align: z.enum(['left', 'center', 'right']).optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
  })
  .strict()

export const EChartsItemSchema = z
  .object({
    ...base,
    type: z.literal('echarts'),
    option: z.record(z.string(), z.unknown()),
    chartAnimation: ChartAnimationSchema.optional(),
  })
  .strict()

export const MermaidItemSchema = z
  .object({
    ...base,
    type: z.literal('mermaid'),
    code: z.string(),
  })
  .strict()

export const XyflowNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    sublabel: z.string().optional(),
    x: zFiniteNumber.optional(),
    y: zFiniteNumber.optional(),
    width: zFiniteNumber.positive().optional(),
    height: zFiniteNumber.positive().optional(),
    kind: z.enum(['default', 'accent', 'muted', 'input', 'output', 'place', 'transition']).optional(),
    token: z.boolean().optional(),
  })
  .strict()

export const XyflowEdgeSchema = z
  .object({
    id: z.string().min(1).optional(),
    source: z.string().min(1),
    target: z.string().min(1),
    label: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'accent']).optional(),
  })
  .strict()

export const XyflowItemSchema = z
  .object({
    ...base,
    type: z.literal('xyflow'),
    nodes: z.array(XyflowNodeSchema),
    edges: z.array(XyflowEdgeSchema).default([]),
    layout: z.enum(['auto', 'manual']).optional(),
    direction: z.enum(['TB', 'LR']).optional(),
    grid: z.boolean().optional(),
    fitViewPadding: zFiniteNumber.min(0).max(1).optional(),
    flowAnimation: FlowAnimationSchema.optional(),
  })
  .strict()

export const ImageItemSchema = z
  .object({
    ...base,
    type: z.literal('image'),
    src: z.string().min(1),
    alt: z.string().optional(),
    fit: z.enum(['contain', 'cover', 'fill']).optional(),
    blend: z.enum(['normal', 'screen', 'lighten', 'multiply']).optional(),
  })
  .strict()

export const QuoteItemSchema = z
  .object({
    ...base,
    type: z.literal('quote'),
    text: z.string().min(1),
    author: z.string().optional(),
    source: z.string().optional(),
    avatar: z.string().optional(),
    accent: zHex.optional(),
  })
  .strict()

export const CODE_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'json',
  'bash',
  'sql',
  'yaml',
  'text',
] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export const CodeItemSchema = z
  .object({
    ...base,
    type: z.literal('code'),
    code: z.string(),
    language: z.enum(CODE_LANGUAGES).optional(),
    filename: z.string().optional(),
    startLine: zFiniteNumber.int().min(1).optional(),
    highlight: z.array(zFiniteNumber.int().min(1)).optional(),
    showLineNumbers: z.boolean().optional(),
  })
  .strict()

export const SceneItemSchema = z.discriminatedUnion('type', [
  MarkdownItemSchema,
  EChartsItemSchema,
  MermaidItemSchema,
  XyflowItemSchema,
  ImageItemSchema,
  QuoteItemSchema,
  CodeItemSchema,
])
export type SceneItem = z.infer<typeof SceneItemSchema>
export type ItemType = SceneItem['type']

export const SceneSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    eyebrow: z.string().optional(),
    subtitle: z.string().optional(),
    footer: z.string().optional(),
    duration: zFiniteNumber.positive().default(8),
    width: zFiniteNumber.int().positive().default(1920),
    height: zFiniteNumber.int().positive().default(1080),
    padding: zFiniteNumber.min(0).default(96),
    theme: z.enum(THEME_NAMES).optional(),
    variant: z.enum(SCENE_VARIANTS).optional(),
    background: BackgroundSchema.optional(),
    accent: zHex.optional(),
    items: z.array(SceneItemSchema).default([]),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export type Scene = z.infer<typeof SceneSchema>
export type ChartAnimation = z.infer<typeof ChartAnimationSchema>
export type FlowAnimation = z.infer<typeof FlowAnimationSchema>

export interface RenderOverrides {
  theme?: ThemeName
  variant?: SceneVariant | 'auto'
  background?: BackgroundSpec
  width?: number
  height?: number
  duration?: number
  padding?: number
  transparent?: boolean
}

export interface ResolvedScene extends Omit<Scene, 'theme' | 'variant' | 'background'> {
  theme: ThemeName
  variant: SceneVariant
  background: BackgroundSpec
  width: number
  height: number
  duration: number
  padding: number
}

export const DEFAULT_SCENE = {
  duration: 8,
  width: 1920,
  height: 1080,
  padding: 96,
  theme: 'dark' as ThemeName,
  variant: 'slide' as SceneVariant,
  background: 'theme' as BackgroundSpec,
}

export function normalizeEnter(value: unknown, defaults?: Partial<EnterSpec>): EnterSpec {
  const fallback: EnterSpec = {
    type: 'fade-up',
    delay: 0,
    duration: 0.7,
    easing: 'ease-out',
    ...defaults,
  }
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string' && (ENTER_TYPES as readonly string[]).includes(value)) {
    return { ...fallback, type: value as EnterType }
  }
  if (typeof value === 'object') {
    const input = value as EnterInput
    return {
      type: input.type ?? fallback.type,
      delay: input.delay ?? fallback.delay,
      duration: input.duration ?? fallback.duration,
      easing: input.easing ?? fallback.easing,
    }
  }
  return fallback
}
