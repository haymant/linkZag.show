import type { EChartsOption } from 'echarts'
import type { ThemeTokens } from '@linkzag/scene-types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneOption<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Options are declarative data; the JSON fallback keeps rendering robust.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function mergeDefaults(value: unknown, defaults: UnknownRecord): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => (isRecord(entry) ? mergeDefaults(entry, defaults) : entry))
  }
  if (isRecord(value)) {
    const merged: UnknownRecord = { ...defaults }
    for (const [key, entry] of Object.entries(value)) {
      const fallback = defaults[key]
      merged[key] = isRecord(fallback) && isRecord(entry) ? mergeDefaults(entry, fallback) : entry
    }
    return merged
  }
  return defaults
}

function themedAxis(axis: unknown, theme: ThemeTokens): unknown {
  const defaults = {
    axisLine: { lineStyle: { color: theme.border } },
    axisTick: { lineStyle: { color: theme.border } },
    axisLabel: { color: theme.muted, fontFamily: theme.fontSans, fontSize: 14 },
    splitLine: { lineStyle: { color: theme.grid } },
    nameTextStyle: { color: theme.muted, fontFamily: theme.fontSans },
  }
  if (Array.isArray(axis)) return axis.map((entry) => mergeDefaults(entry, defaults))
  if (isRecord(axis)) return mergeDefaults(axis, defaults)
  return axis
}

function themedSeries(series: unknown, theme: ThemeTokens): unknown {
  if (Array.isArray(series)) return series.map((entry) => themedSeries(entry, theme))
  if (!isRecord(series)) return series

  const copy: UnknownRecord = { ...series, animation: false }
  const lineStyle = isRecord(copy.lineStyle) ? { width: 3, ...copy.lineStyle } : { width: 3 }
  if (copy.type === 'line') copy.lineStyle = lineStyle
  if (copy.type === 'bar') {
    copy.itemStyle = isRecord(copy.itemStyle)
      ? { borderRadius: [4, 4, 0, 0], ...copy.itemStyle }
      : { borderRadius: [4, 4, 0, 0] }
  }
  if (copy.type === 'candlestick') {
    copy.itemStyle = isRecord(copy.itemStyle)
      ? { color: theme.accent3, color0: theme.chart[4], borderColor: theme.accent3, borderColor0: theme.chart[4], ...copy.itemStyle }
      : { color: theme.accent3, color0: theme.chart[4], borderColor: theme.accent3, borderColor0: theme.chart[4] }
  }
  if (copy.type === 'sankey') {
    copy.label = isRecord(copy.label) ? { color: theme.foreground, ...copy.label } : { color: theme.foreground }
    copy.lineStyle = isRecord(copy.lineStyle) ? { color: 'gradient', opacity: 0.32, ...copy.lineStyle } : { color: 'gradient', opacity: 0.32 }
  }
  if (copy.type === 'graph') {
    copy.label = isRecord(copy.label) ? { color: theme.foreground, ...copy.label } : { color: theme.foreground }
    copy.lineStyle = isRecord(copy.lineStyle) ? { color: theme.muted, ...copy.lineStyle } : { color: theme.muted }
  }
  if (copy.type === 'treemap' || copy.type === 'pie') {
    copy.label = isRecord(copy.label) ? { color: theme.foreground, ...copy.label } : { color: theme.foreground }
  }
  if (copy.type === 'heatmap') {
    copy.label = isRecord(copy.label)
      ? { color: '#FFFFFF', fontSize: 13, textShadowColor: 'rgba(2, 6, 23, 0.65)', textShadowBlur: 3, ...copy.label }
      : { color: '#FFFFFF', fontSize: 13, textShadowColor: 'rgba(2, 6, 23, 0.65)', textShadowBlur: 3 }
  }
  return copy
}

/**
 * Apply the LinkZag visual language to any ECharts option. Deterministic rendering
 * requires animation to be off; everything else is a theme-aware default that the
 * scene can override explicitly.
 */
export function themeChartOption(input: EChartsOption, theme: ThemeTokens): EChartsOption {
  const option = cloneOption(input) as UnknownRecord

  option.animation = false
  option.animationDuration = 0
  option.animationDurationUpdate = 0
  option.animationEasing = 'linear'
  option.backgroundColor = 'transparent'
  option.color = option.color ?? theme.chart
  option.textStyle = {
    fontFamily: theme.fontSans,
    color: theme.foreground,
    ...(isRecord(option.textStyle) ? option.textStyle : {}),
  }

  if (option.title !== undefined) {
    option.title = mergeDefaults(option.title, {
      textStyle: { color: theme.foreground, fontFamily: theme.fontDisplay, fontWeight: 600 },
      subtextStyle: { color: theme.muted, fontFamily: theme.fontSans },
    })
  }

  if (option.legend !== undefined) {
    option.legend = mergeDefaults(option.legend, {
      textStyle: { color: theme.muted, fontFamily: theme.fontSans, fontSize: 14 },
      itemWidth: 14,
      itemHeight: 9,
      icon: 'roundRect',
    })
  }

  if (option.grid === undefined) {
    option.grid = { left: 20, right: 28, top: 30, bottom: 18, containLabel: true }
  } else {
    option.grid = mergeDefaults(option.grid, { containLabel: true })
  }

  option.xAxis = themedAxis(option.xAxis, theme)
  option.yAxis = themedAxis(option.yAxis, theme)
  option.radiusAxis = themedAxis(option.radiusAxis, theme)
  option.angleAxis = themedAxis(option.angleAxis, theme)

  if (option.tooltip !== undefined) {
    option.tooltip = mergeDefaults(option.tooltip, {
      backgroundColor: theme.backgroundAlt,
      borderColor: theme.border,
      textStyle: { color: theme.foreground, fontFamily: theme.fontSans },
    })
  }

  if (option.visualMap !== undefined) {
    option.visualMap = mergeDefaults(option.visualMap, {
      textStyle: { color: theme.muted, fontFamily: theme.fontSans },
    })
  }

  option.series = themedSeries(option.series, theme)
  return option as EChartsOption
}
