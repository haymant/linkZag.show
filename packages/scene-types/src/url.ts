import { BackgroundSchema, SCENE_VARIANTS, THEME_NAMES } from './schema.ts'
import type { BackgroundSpec, RenderOverrides, SceneVariant, ThemeName } from './schema.ts'

export interface ParsedRenderQuery {
  scene?: string
  time?: number
  overrides: RenderOverrides
  warnings: string[]
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/** Parse the documented URL API: ?scene=…&theme=…&t=…&w=…&h=… */
export function parseRenderQuery(search: string): ParsedRenderQuery {
  const params = new URLSearchParams(search)
  const warnings: string[] = []
  const overrides: RenderOverrides = {}

  const scene = params.get('scene')?.trim() || undefined

  const theme = params.get('theme')
  if (theme) {
    if ((THEME_NAMES as readonly string[]).includes(theme)) {
      overrides.theme = theme as ThemeName
    } else {
      warnings.push(`Unknown theme "${theme}" (expected light or dark)`)
    }
  }

  const variant = params.get('variant')
  if (variant && variant !== 'auto') {
    if ((SCENE_VARIANTS as readonly string[]).includes(variant)) {
      overrides.variant = variant as SceneVariant
    } else {
      warnings.push(`Unknown variant "${variant}" (expected slide or item)`)
    }
  } else if (variant === 'auto') {
    overrides.variant = 'auto'
  }

  const background = params.get('background')
  if (background) {
    const parsed = BackgroundSchema.safeParse(background)
    if (parsed.success) overrides.background = parsed.data
    else warnings.push(`Invalid background "${background}"`)
  }

  if (params.get('transparent') === '1' || params.get('transparent') === 'true') {
    overrides.transparent = true
  }

  const width = parsePositiveNumber(params.get('w'))
  const height = parsePositiveNumber(params.get('h'))
  const duration = parsePositiveNumber(params.get('duration'))
  if (width) overrides.width = Math.round(width)
  if (height) overrides.height = Math.round(height)
  if (duration) overrides.duration = duration

  const time = parsePositiveNumber(params.get('t'))
  if (params.has('t') && time === undefined) warnings.push('Invalid t; expected a non-negative number')

  return { scene, time, overrides, warnings }
}

export type { BackgroundSpec }
