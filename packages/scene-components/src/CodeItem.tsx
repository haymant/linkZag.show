import { useEffect, useMemo } from 'react'
import hljs from 'highlight.js/lib/common'
import type { SceneItem, ThemeTokens } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'code' }>>

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlight(code: string, language: string): string {
  if (language === 'text') return escapeHtml(code)
  try {
    if (!hljs.getLanguage(language)) return escapeHtml(code)
    return hljs.highlight(code, { language, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(code)
  }
}

function codeMetrics(height: number, lines: number): { fontSize: number; lineHeight: number } {
  const available = Math.max(80, height - (height > 340 ? 84 : 48))
  const fontSize = Math.max(11, Math.min(22, available / Math.max(lines, 1) / 1.6))
  return { fontSize, lineHeight: Math.round(fontSize * 1.65) }
}

export function CodeItem({ item, height, onReady, onError }: Props) {
  const language = item.language ?? 'text'
  const code = item.code.replace(/\r\n/g, '\n').replace(/\n$/, '')
  const lines = code.split('\n')
  const startLine = item.startLine ?? 1
  const showLineNumbers = item.showLineNumbers ?? true
  const metrics = codeMetrics(height, lines.length)
  const html = useMemo(() => highlight(code, language), [code, language])

  useEffect(() => {
    try {
      onReady()
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }, [onReady, onError])

  const highlights = new Set(item.highlight ?? [])

  return (
    <div className="lz-code" style={{ fontFamily: 'var(--lz-font-mono)' }}>
      {(item.filename || language !== 'text') && (
        <div className="lz-code__header">
          <span className="lz-code__dot" />
          <span className="lz-code__filename">{item.filename ?? language}</span>
          <span className="lz-code__language">{language}</span>
        </div>
      )}
      <div className="lz-code__body">
        {showLineNumbers && (
          <div className="lz-code__gutter" style={{ fontSize: metrics.fontSize, lineHeight: `${metrics.lineHeight}px` }}>
            {lines.map((_, index) => (
              <div key={index}>{startLine + index}</div>
            ))}
          </div>
        )}
        <pre className="lz-code__pre" style={{ fontSize: metrics.fontSize, lineHeight: `${metrics.lineHeight}px` }}>
          {[...highlights].map((line) =>
            line >= startLine && line < startLine + lines.length ? (
              <span
                key={`hl-${line}`}
                className="lz-code__band"
                style={{
                  top: (line - startLine) * metrics.lineHeight + (item.filename || language !== 'text' ? 0 : 18),
                  height: metrics.lineHeight,
                }}
              />
            ) : null,
          )}
          <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </div>
  )
}
