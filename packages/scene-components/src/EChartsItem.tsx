import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'
import type { SceneItem } from '@linkzag/scene-types'
import { themeChartOption } from './chart-theme'
import { chartMotion, scaleChartSeries } from './chart-animation'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'echarts' }>>

export function EChartsItem({ item, theme, time, enter, onReady, onError }: Props) {
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
      const option = themeChartOption(item.option as EChartsOption, theme)
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
