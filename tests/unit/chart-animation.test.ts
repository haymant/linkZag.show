import { describe, expect, it } from 'vitest'
import { SceneSchema } from '@linkzag/scene-types'
import { chartMotion, scaleChartSeries } from '@linkzag/scene-components'

const enter = { type: 'fade-up' as const, delay: 0.2, duration: 0.8, easing: 'ease-out' as const }

function chart(option: Record<string, unknown>, chartAnimation?: Record<string, unknown>) {
  return SceneSchema.parse({
    id: 'chart',
    items: [
      {
        type: 'echarts',
        option,
        ...(chartAnimation ? { chartAnimation } : {}),
      },
    ],
  }).items[0] as Extract<ReturnType<typeof SceneSchema.parse>['items'][number], { type: 'echarts' }>
}

describe('chart motion', () => {
  it('defaults bar charts to value scaling', () => {
    const motion = chartMotion(chart({ series: [{ type: 'bar', data: [1, 2] }] }), 10, enter)
    expect(motion.mode).toBe('values')
    expect(motion.progress).toBe(1)
  })

  it('defaults line charts to a left-to-right reveal', () => {
    const motion = chartMotion(chart({ series: [{ type: 'line', data: [1, 2] }] }), 10, enter)
    expect(motion.mode).toBe('reveal')
  })

  it('can disable animation explicitly', () => {
    const motion = chartMotion(
      chart({ series: [{ type: 'bar', data: [1, 2] }] }, { enabled: false }),
      0,
      enter,
    )
    expect(motion.mode).toBe('none')
    expect(motion.progress).toBe(1)
  })

  it('uses explicit timing and clamps to the scene time', () => {
    const item = chart({ series: [{ type: 'bar', data: [1] }] }, {
      mode: 'values',
      delay: 1,
      duration: 2,
      easing: 'linear',
    })
    expect(chartMotion(item, 0, enter).progress).toBe(0)
    expect(chartMotion(item, 2, enter).progress).toBe(0.5)
    expect(chartMotion(item, 5, enter).progress).toBe(1)
  })
})

describe('chart value scaling', () => {
  const option = {
    series: [
      { type: 'bar', data: [100, { value: 50, name: 'B' }, 'label'] },
      { type: 'pie', data: [{ value: 10, name: 'A' }] },
      { type: 'heatmap', data: [[0, 0, 8], [1, 0, 4]] },
      { type: 'line', data: [1, 2, 3] },
    ],
  }

  it('scales bars, pies, objects, and heatmap values', () => {
    const scaled = scaleChartSeries(
      option as unknown as Parameters<typeof scaleChartSeries>[0],
      0.5,
    ) as unknown as typeof option
    expect(scaled.series[0]!.data).toEqual([50, { value: 25, name: 'B' }, 'label'])
    expect(scaled.series[1]!.data).toEqual([{ value: 5, name: 'A' }])
    expect(scaled.series[2]!.data).toEqual([[0, 0, 4], [1, 0, 2]])
    expect(scaled.series[3]!.data).toEqual([1, 2, 3])
  })

  it('restores the original values at full progress without mutating the input', () => {
    const copy = structuredClone(option)
    const scaled = scaleChartSeries(
      option as unknown as Parameters<typeof scaleChartSeries>[0],
      1,
    ) as unknown as typeof option
    expect(scaled.series[0]!.data).toEqual(copy.series[0]!.data)
    expect(option).toEqual(copy)
  })
})
