import { useEffect, useRef, useState } from 'react'
import type { SceneItem, ThemeTokens } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'quote' }>>

function quoteSize(width: number, height: number, text: string): number {
  const widthBased = width / 17
  const heightBased = height / 6.2
  const lengthFactor = text.length > 260 ? 0.74 : text.length > 150 ? 0.86 : 1
  return Math.max(22, Math.min(58, Math.min(widthBased, heightBased) * lengthFactor))
}

export function QuoteItem({ item, theme, width, height, onReady, onError }: Props) {
  const [avatarReady, setAvatarReady] = useState(!item.avatar)
  const avatarRef = useRef<HTMLImageElement | null>(null)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError

  useEffect(() => {
    if (!item.avatar || !avatarReady) return
    readyRef.current()
  }, [avatarReady, item.avatar])

  useEffect(() => {
    if (!item.avatar) return
    const image = avatarRef.current
    if (image?.complete) {
      if (image.naturalWidth === 0) errorRef.current(new Error(`Quote avatar failed to load: ${item.avatar}`))
      else setAvatarReady(true)
    }
  }, [item.avatar])

  const accent = item.accent ?? theme.accent
  const textSize = quoteSize(width, height, item.text)

  return (
    <div className="lz-quote" style={{ borderColor: accent, ['--lz-quote-accent' as string]: accent }}>
      <div className="lz-quote__mark" aria-hidden="true">
        “
      </div>
      <blockquote className="lz-quote__text" style={{ fontSize: `${textSize}px` }}>
        {item.text}
      </blockquote>
      {(item.author || item.source || item.avatar) && (
        <div className="lz-quote__meta">
          {item.avatar && (
            <img
              ref={avatarRef}
              className="lz-quote__avatar"
              src={item.avatar}
              alt=""
              draggable={false}
              onLoad={() => {
                const image = avatarRef.current
                if (image && typeof image.decode === 'function') {
                  void image.decode().catch(() => undefined).finally(() => setAvatarReady(true))
                } else {
                  setAvatarReady(true)
                }
              }}
              onError={() => errorRef.current(new Error(`Quote avatar failed to load: ${item.avatar}`))}
            />
          )}
          <div>
            {item.author && <div className="lz-quote__author">{item.author}</div>}
            {item.source && <div className="lz-quote__source">{item.source}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
