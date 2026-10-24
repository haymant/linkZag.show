import { animatedStyle, type EnterSpec } from '@linkzag/scene-types'
import type { HeaderLayout, ThemeTokens } from '@linkzag/scene-types'
import type { CSSProperties } from 'react'

interface Props {
  header: HeaderLayout | null
  time: number
  theme: ThemeTokens
}

const EYEBROW_ENTER: EnterSpec = { type: 'fade', delay: 0.05, duration: 0.6, easing: 'ease-out' }
const TITLE_ENTER: EnterSpec = { type: 'fade-up', delay: 0.12, duration: 0.75, easing: 'ease-out' }
const SUBTITLE_ENTER: EnterSpec = { type: 'fade-up', delay: 0.28, duration: 0.75, easing: 'ease-out' }

function positioned(rect: { x: number; y: number; width: number }, fontSize: number, lineHeight: number): CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    fontSize,
    lineHeight: `${lineHeight}px`,
  }
}

export function SceneHeader({ header, time, theme }: Props) {
  if (!header) return null
  const eyebrowStyle = animatedStyle(EYEBROW_ENTER, time)
  const titleStyle = animatedStyle(TITLE_ENTER, time)
  const subtitleStyle = animatedStyle(SUBTITLE_ENTER, time)

  return (
    <div className="lz-header" aria-hidden="true">
      {header.eyebrow && (
        <div
          className="lz-eyebrow"
          style={{
            ...positioned(
              { x: header.rect.x, y: header.eyebrow.y, width: header.rect.width },
              header.eyebrow.fontSize,
              header.eyebrow.lineHeight,
            ),
            opacity: eyebrowStyle.opacity,
            transform: eyebrowStyle.transform,
          }}
        >
          {header.eyebrow.text}
        </div>
      )}
      {header.title && (
        <div
          className="lz-title"
          style={{
            ...positioned(header.rect, header.title.fontSize, header.title.lineHeight),
            top: header.title.y,
            opacity: titleStyle.opacity,
            transform: titleStyle.transform,
          }}
        >
          {header.title.text}
        </div>
      )}
      {header.subtitle && (
        <div
          className="lz-subtitle"
          style={{
            ...positioned(header.rect, header.subtitle.fontSize, header.subtitle.lineHeight),
            top: header.subtitle.y,
            opacity: subtitleStyle.opacity,
            transform: subtitleStyle.transform,
          }}
        >
          {header.subtitle.text}
        </div>
      )}
    </div>
  )
}
