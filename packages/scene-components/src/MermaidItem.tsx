import { useEffect, useRef } from 'react'
import type { SceneItem, ThemeTokens } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'mermaid' }>>

let renderQueue: Promise<unknown> = Promise.resolve()
let renderSequence = 0

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task)
  renderQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function themeVariables(theme: ThemeTokens): Record<string, string> {
  return {
    background: 'transparent',
    fontFamily: theme.fontSans,
    primaryColor: theme.backgroundAlt,
    primaryTextColor: theme.foreground,
    primaryBorderColor: theme.accent,
    secondaryColor: theme.accentSoft,
    secondaryTextColor: theme.foreground,
    secondaryBorderColor: theme.accent2,
    tertiaryColor: theme.backgroundAlt,
    tertiaryTextColor: theme.foreground,
    tertiaryBorderColor: theme.border,
    lineColor: theme.muted,
    textColor: theme.foreground,
    mainBkg: theme.backgroundAlt,
    nodeBorder: theme.accent,
    nodeTextColor: theme.foreground,
    clusterBkg: theme.accentSoft,
    clusterBorder: theme.border,
    titleColor: theme.foreground,
    edgeLabelBackground: theme.backgroundAlt,
    actorBkg: theme.backgroundAlt,
    actorBorder: theme.accent,
    actorTextColor: theme.foreground,
    actorLineColor: theme.muted,
    signalColor: theme.foreground,
    signalTextColor: theme.foreground,
    labelBoxBkgColor: theme.backgroundAlt,
    labelBoxBorderColor: theme.accent,
    labelTextColor: theme.foreground,
    loopTextColor: theme.foreground,
    noteBkgColor: theme.accentSoft,
    noteBorderColor: theme.accent,
    noteTextColor: theme.foreground,
    activationBkgColor: theme.accentSoft,
    activationBorderColor: theme.accent,
    sequenceNumberColor: theme.background,
    sectionBkgColor: 'transparent',
    altSectionBkgColor: theme.accentSoft,
    taskBkgColor: theme.accentSoft,
    taskBorderColor: theme.accent,
    taskTextColor: theme.foreground,
    taskTextLightColor: theme.foreground,
    activeTaskBkgColor: theme.accent,
    activeTaskBorderColor: theme.accent,
    doneTaskBkgColor: theme.accentSoft,
    doneTaskBorderColor: theme.border,
    critBkgColor: theme.accent2,
    critBorderColor: theme.accent2,
    todayLineColor: theme.accent3,
    pie1: theme.chart[0]!,
    pie2: theme.chart[1]!,
    pie3: theme.chart[2]!,
    pie4: theme.chart[3]!,
    pie5: theme.chart[4]!,
    pie6: theme.chart[5]!,
    pie7: theme.chart[6]!,
    pie8: theme.chart[7]!,
    pieTitleTextSize: '18px',
    pieSectionTextColor: theme.foreground,
    pieLegendTextColor: theme.foreground,
    attributeBackgroundColorOdd: theme.backgroundAlt,
    attributeBackgroundColorEven: theme.accentSoft,
  }
}

function cleanupMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/\u001b\[[0-9;]*m/g, '').replace(/^Error:\s*/i, '').trim()
}

export function MermaidItem({ item, theme, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let raf = 0

    const run = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        const id = `lz-mermaid-${++renderSequence}`
        const config = {
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          look: 'classic',
          handDrawnSeed: 7,
          fontFamily: theme.fontSans,
          deterministicIds: true,
          deterministicIDSeed: `linkzag-${theme.name}`,
          themeVariables: themeVariables(theme),
          flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: false },
          sequence: { useMaxWidth: false },
          gantt: { useMaxWidth: false },
          journey: { useMaxWidth: false },
          class: { useMaxWidth: false },
          state: { useMaxWidth: false },
          er: { useMaxWidth: false },
          pie: { useMaxWidth: false },
          quadrantChart: { useMaxWidth: false },
        } as Parameters<typeof mermaid.initialize>[0]

        const svg = await enqueue(async () => {
          mermaid.initialize(config)
          const result = await mermaid.render(id, item.code)
          return result.svg
        })
        if (cancelled) return
        host.innerHTML = svg
        host.setAttribute('data-processed', 'true')
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            if (!cancelled) readyRef.current()
          })
        })
      } catch (error) {
        if (!cancelled) errorRef.current(new Error(cleanupMessage(error)))
      }
    }

    void run()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      host.innerHTML = ''
    }
  }, [item.code, theme])

  return <div ref={hostRef} className="lz-mermaid" aria-label="diagram" />
}
