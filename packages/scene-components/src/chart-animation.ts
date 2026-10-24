import type { EChartsOption } from 'echarts'
import { timedProgress } from '@linkzag/scene-types'
import type { ChartAnimation, EnterSpec, SceneItem } from '@linkzag/scene-types'

type UnknownRecord = Record<string, unknown>
type ChartItem = Extract<SceneItem, { type: 'echarts' }>

export type ChartMotionMode = 'reveal' | 'values' | 'none'

export interface ChartMotion {
  mode: ChartMotionMode
  progress: number
  delay: number
  duration: number
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function seriesList(option: UnknownRecord): UnknownRecord[] {
  const series = option.series
  if (Array.isArray(series)) return series.filter(isRecord)
  if (isRecord(series)) return [series]
  return []
}

function inferMode(option: EChartsOption, config?: ChartAnimation): ChartMotionMode {
  if (config?.enabled === false || config?.mode === 'none') return 'none'
  if (config?.mode === 'reveal' || config?.mode === 'values') return config.mode
  const types = seriesList(option as UnknownRecord)
    .map((series) => series.type)
    .filter((type): type is string => typeof type === 'string')
  if (types.length === 0) return 'reveal'
  if (types.every((type) => type === 'bar' || type === 'pie' || type === 'heatmap')) {
    return 'values'
  }
  return 'reveal'
}

export function chartMotion(item: ChartItem, time: number, enter: EnterSpec): ChartMotion {
  const config = item.chartAnimation
  const mode = inferMode(item.option as EChartsOption, config)
  const delay = config?.delay ?? enter.delay + Math.min(0.24, enter.duration * 0.3)
  const duration = config?.duration ?? 1.15
  const progress = mode === 'none' ? 1 : timedProgress(time, delay, duration, config?.easing)
  return { mode, progress, delay, duration }
}

function scaleDataValue(value: unknown, progress: number): unknown {
  if (typeof value === 'number') return value * progress
  if (isRecord(value) && typeof value.value === 'number') {
    return { ...value, value: value.value * progress }
  }
  return value
}

/**
 * Scale numeric series values from zero to their target. The chart keeps its
 * layout and axis scale, so growth reads as focus instead of a rescaling jitter.
 */

function numericExtent(series: UnknownRecord[]): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const visit = (value: unknown): void => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      min = Math.min(min, value)
      max = Math.max(max, value)
      return
    }
    if (isRecord(value) && typeof value.value === 'number' && Number.isFinite(value.value)) {
      min = Math.min(min, value.value)
      max = Math.max(max, value.value)
      return
    }
    if (Array.isArray(value) && value.length >= 3 && typeof value[2] === 'number') {
      visit(value[2])
    }
  }
  for (const entry of series) {
    if (Array.isArray(entry.data)) {
      for (const value of entry.data) visit(value)
    }
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
}

function pinValueAxis(axis: unknown, extent: { min: number; max: number }): unknown {
  if (!isRecord(axis)) return axis
  if (axis.type !== undefined && axis.type !== 'value') return axis
  if (axis.max !== undefined || axis.min !== undefined) return axis
  return { ...axis, min: extent.min >= 0 ? 0 : extent.min, max: extent.max }
}

export function scaleChartSeries(option: EChartsOption, progress: number): EChartsOption {
  const source = option as UnknownRecord
  const series = source.series
  if (!Array.isArray(series)) return option

  const scaled = series.map((entry) => {
    if (!isRecord(entry) || !Array.isArray(entry.data)) return entry
    if (entry.type === 'bar' || entry.type === 'pie') {
      return { ...entry, data: entry.data.map((value) => scaleDataValue(value, progress)) }
    }
    if (entry.type === 'heatmap') {
      return {
        ...entry,
        data: entry.data.map((value) =>
          Array.isArray(value) && typeof value[2] === 'number'
            ? [value[0], value[1], value[2] * progress]
            : scaleDataValue(value, progress),
        ),
      }
    }
    return entry
  })

  const extent = numericExtent(series.filter(isRecord))
  const axes = source.yAxis
  const pinnedYAxis = extent
    ? Array.isArray(axes)
      ? axes.map((axis) => pinValueAxis(axis, extent))
      : axes !== undefined
        ? pinValueAxis(axes, extent)
        : { type: 'value', min: extent.min >= 0 ? 0 : extent.min, max: extent.max }
    : axes
  return { series: scaled, ...(pinnedYAxis !== undefined ? { yAxis: pinnedYAxis } : {}) } as EChartsOption
}
