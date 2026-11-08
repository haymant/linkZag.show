import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'
import type { SceneItem } from '@linkzag/scene-types'
import { themeChartOption } from './chart-theme'
import { chartMotion, scaleChartSeries } from './chart-animation'

function orientOption(option: any, orientation?: string): any {
  if (orientation !== 'portrait') return option
  const x = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  const y = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
  const isBar = series.some((entry: any) => entry?.type === 'bar')
  if (!isBar || !x || x.type !== 'category' || (y && y.type && y.type !== 'value')) return option
  const data = x.data ?? []
  const values = series
    .flatMap((entry: any) => (Array.isArray(entry?.data) ? entry.data : []))
    .filter((value: any) => typeof value === 'number' && Number.isFinite(value))
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const pad = (hi - lo) * 0.12 || 1
  return {
    ...option,
    xAxis: {
      ...(y ?? { type: 'value' }),
      type: 'value',
      splitNumber: 3,
      min: lo < 0 ? lo - pad : 0,
      max: hi > 0 ? hi + pad : 0,
    },
    yAxis: { ...x, type: 'category', data, axisLabel: { ...(x.axisLabel ?? {}), interval: 0 } },
    series: series.map((entry: any) => ({
      ...entry,
      barMaxWidth: 96,
      label: (() => {
        const negativeOnly = (Array.isArray(entry?.data) ? entry.data : []).every(
          (value: any) => typeof value !== 'number' || value < 0,
        )
        return {
          ...(entry.label ?? {}),
          position: negativeOnly ? 'insideLeft' : 'right',
          ...(negativeOnly ? { color: '#FFFFFF' } : {}),
        }
      })(),
    })),
    grid: { ...(option.grid ?? {}), left: 20, right: 84, top: 32, bottom: 28, containLabel: true },
  }
}

import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'echarts' }>>

export function EChartsItem({ item, theme, scene, time, enter, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ECharts | null>(null)
  const baseOptionRef = useRef<EChartsOption | null>(null)
  const appliedProgressRef = useRef(-1)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError

  const motion = chartMotion(item, time, enter)
  const revealClip =
    motion.mode === 'reveal' && motion.progress < 1
      ? `inset(0 ${(1 - motion.progress) * 100}% 0 0)`
      : undefined

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let chart: ECharts | null = null
    let resizeObserver: ResizeObserver | null = null
    let raf = 0

    chartRef.current = null
    baseOptionRef.current = null
    appliedProgressRef.current = -1

    try {
      const option = themeChartOption(orientOption(item.option as EChartsOption, scene.orientation), theme)
      baseOptionRef.current = option
      chart = echarts.init(host, undefined, {
        renderer: 'svg',
        width: host.clientWidth,
        height: host.clientHeight,
      })
      chartRef.current = chart
      // ECharts' own animation engine is wall-clock driven, so it is always off.
      // Time-seekable motion is applied below through reveal/values.
      chart.setOption(option, { notMerge: true, lazyUpdate: false })

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed && chart) chart.resize()
        })
        resizeObserver.observe(host)
      }

      raf = requestAnimationFrame(() => {
        if (disposed || !chart) return
        chart.resize()
        requestAnimationFrame(() => {
          if (!disposed) readyRef.current()
        })
      })
    } catch (error) {
      errorRef.current(error instanceof Error ? error : new Error(String(error)))
    }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      chart?.dispose()
      chartRef.current = null
      baseOptionRef.current = null
    }
  }, [item.option, theme])

  useEffect(() => {
    const chart = chartRef.current
    const base = baseOptionRef.current
    if (!chart || !base || motion.mode !== 'values') return
    const progress = motion.progress
    if (progress >= 1) {
      if (appliedProgressRef.current === 1) return
      appliedProgressRef.current = 1
      try {
        chart.setOption(base, { notMerge: true, lazyUpdate: false })
      } catch (error) {
        errorRef.current(error instanceof Error ? error : new Error(String(error)))
      }
      return
    }
    if (Math.abs(appliedProgressRef.current - progress) < 0.0001) return
    appliedProgressRef.current = progress
    try {
      chart.setOption(scaleChartSeries(base, progress), { notMerge: false, lazyUpdate: false })
    } catch (error) {
      errorRef.current(error instanceof Error ? error : new Error(String(error)))
    }
  }, [motion.mode, motion.progress, theme])

  return (
    <div
      ref={hostRef}
      className="lz-echart"
      aria-label="chart"
      data-chart-motion={motion.mode}
      data-chart-progress={motion.progress.toFixed(4)}
      style={{ clipPath: revealClip, transformOrigin: 'left center' }}
    />
  )
}
