import { clamp01, defaultItemEnter } from './animation.ts'
import { normalizeEnter } from './schema.ts'
import type { EnterSpec, ResolvedScene, SceneItem } from './schema.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface HeaderLayout {
  rect: Rect
  eyebrow?: { text: string; fontSize: number; lineHeight: number; y: number }
  title?: { text: string; fontSize: number; lineHeight: number; y: number }
  subtitle?: { text: string; fontSize: number; lineHeight: number; y: number }
}

export interface LayoutItem {
  item: SceneItem
  rect: Rect
  enter: EnterSpec
  index: number
  key: string
}

export interface SceneLayout {
  width: number
  height: number
  padding: number
  header: HeaderLayout | null
  content: Rect
  footer: { text: string; rect: Rect; fontSize: number } | null
  items: LayoutItem[]
}

const DEFAULT_HEIGHTS: Record<SceneItem['type'], number> = {
  markdown: 420,
  echarts: 460,
  mermaid: 460,
  xyflow: 500,
  image: 460,
  quote: 360,
  code: 460,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function textLines(text: string, maxWidth: number, fontSize: number): number {
  const averageGlyph = fontSize * 0.54
  const perLine = Math.max(1, Math.floor(maxWidth / averageGlyph))
  return text.split('\n').reduce((total, line) => {
    if (!line.trim()) return total + 1
    return total + Math.max(1, Math.ceil(line.length / perLine))
  }, 0)
}

function buildHeader(scene: ResolvedScene, contentWidth: number): HeaderLayout | null {
  if (scene.variant !== 'slide') return null
  if (!scene.eyebrow && !scene.title && !scene.subtitle) return null

  const titleSize = clamp(scene.width * 0.048, 34, 104)
  const subtitleSize = clamp(titleSize * 0.34, 16, 34)
  const eyebrowSize = clamp(titleSize * 0.2, 12, 21)
  const eyebrowLineHeight = eyebrowSize * 1.25
  const titleLineHeight = titleSize * 1.05
  const subtitleLineHeight = subtitleSize * 1.35

  let y = scene.padding
  let hasEyebrow = false
  let eyebrow: HeaderLayout['eyebrow']
  if (scene.eyebrow) {
    eyebrow = { text: scene.eyebrow, fontSize: eyebrowSize, lineHeight: eyebrowLineHeight, y }
    y += eyebrowLineHeight + titleSize * 0.28
    hasEyebrow = true
  }

  let title: HeaderLayout['title']
  let titleHeight = 0
  if (scene.title) {
    titleHeight = textLines(scene.title, contentWidth, titleSize) * titleLineHeight
    title = { text: scene.title, fontSize: titleSize, lineHeight: titleLineHeight, y }
    y += titleHeight + (scene.subtitle ? subtitleSize * 0.55 : 0)
  }

  let subtitle: HeaderLayout['subtitle']
  let subtitleHeight = 0
  if (scene.subtitle) {
    subtitleHeight = textLines(scene.subtitle, contentWidth, subtitleSize) * subtitleLineHeight
    subtitle = { text: scene.subtitle, fontSize: subtitleSize, lineHeight: subtitleLineHeight, y }
    y += subtitleHeight
  }

  if (!hasEyebrow && !title && !subtitle) return null
  const height = Math.max(eyebrowLineHeight, y - scene.padding)
  return {
    rect: { x: scene.padding, y: scene.padding, width: contentWidth, height },
    eyebrow,
    title,
    subtitle,
  }
}

/**
 * Absolute positions always win. Items without both x and y are flowed top-to-bottom
 * inside the content area; flexible items share the remaining height.
 */
export function buildSceneLayout(scene: ResolvedScene): SceneLayout {
  const contentWidth = Math.max(1, scene.width - scene.padding * 2)
  const header = buildHeader(scene, contentWidth)
  const showFooter = scene.variant === 'slide' && Boolean(scene.footer)
  const footerFontSize = clamp(scene.width * 0.0125, 12, 24)
  const footerHeight = footerFontSize * 1.4
  const footerRect: Rect | null = showFooter
    ? {
        x: scene.padding,
        y: scene.height - scene.padding - footerHeight,
        width: contentWidth,
        height: footerHeight,
      }
    : null

  const contentTop = header
    ? header.rect.y + header.rect.height + clamp(scene.padding * 0.45, 24, 56)
    : scene.padding
  const contentBottom = footerRect
    ? footerRect.y - clamp(scene.padding * 0.3, 18, 40)
    : scene.height - scene.padding
  const contentHeight = Math.max(1, contentBottom - contentTop)

  const content: Rect = {
    x: scene.padding,
    y: contentTop,
    width: contentWidth,
    height: contentHeight,
  }

  const auto = scene.items.filter((item) => item.x === undefined && item.y === undefined)
  const autoIndex = new Map<SceneItem, number>()
  auto.forEach((item, index) => autoIndex.set(item, index))

  const gap = clamp(scene.padding * 0.3, 14, 36)
  const autoHeights = new Map<SceneItem, number>()
  if (auto.length === 1) {
    autoHeights.set(auto[0]!, content.height)
  } else if (auto.length > 1) {
    const fixedTotal = auto.reduce((sum, item) => sum + (item.height ?? 0), 0)
    const flexible = auto.filter((item) => item.height === undefined).length
    const remaining = content.height - fixedTotal - gap * (auto.length - 1)
    const flexibleHeight =
      flexible > 0 && remaining > 0
        ? remaining / flexible
        : Math.max(64, (content.height - gap * (auto.length - 1)) / auto.length)
    for (const item of auto) {
      autoHeights.set(item, item.height ?? flexibleHeight)
    }
  }

  let cursor = content.y
  const items: LayoutItem[] = scene.items.map((item, index) => {
    const isAuto = item.x === undefined && item.y === undefined
    const defaultEnter = defaultItemEnter(index, scene.duration)
    const enter = normalizeEnter(item.enter, defaultEnter)

    if (isAuto) {
      const height = autoHeights.get(item) ?? content.height
      const rect: Rect = {
        x: content.x,
        y: cursor,
        width: item.width ?? content.width,
        height,
      }
      cursor += height + gap
      return {
        item,
        rect,
        enter,
        index,
        key: item.id ?? `item-${index + 1}`,
      }
    }

    const rect: Rect = {
      x: item.x ?? content.x,
      y: item.y ?? content.y,
      width: item.width ?? content.width,
      height: item.height ?? Math.min(content.height, DEFAULT_HEIGHTS[item.type]),
    }
    return {
      item,
      rect,
      enter,
      index,
      key: item.id ?? `item-${index + 1}`,
    }
  })

  return {
    width: scene.width,
    height: scene.height,
    padding: scene.padding,
    header,
    content,
    footer: footerRect && scene.footer
      ? { text: scene.footer, rect: footerRect, fontSize: footerFontSize }
      : null,
    items,
  }
}

export function layoutProgress(enter: EnterSpec, time: number): number {
  return clamp01((time - enter.delay) / Math.max(enter.duration, 0.0001))
}
