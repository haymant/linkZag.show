import { useEffect, useRef } from 'react'
import type { SceneItem } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'image' }>>

export function ImageItem({ item, onReady, onError }: Props) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError

  useEffect(() => {
    const image = imageRef.current
    if (!image) return
    let cancelled = false
    const finish = () => {
      if (!cancelled) readyRef.current()
    }
    if (image.complete) {
      if (image.naturalWidth === 0) {
        errorRef.current(new Error(`Image failed to load: ${item.src}`))
      } else if (typeof image.decode === 'function') {
        void image.decode().catch(() => undefined).finally(finish)
      } else {
        finish()
      }
    }
    return () => {
      cancelled = true
    }
  }, [item.src])

  return (
    <img
      ref={imageRef}
      className="lz-image"
      src={item.src}
      alt={item.alt ?? ''}
      draggable={false}
      loading="eager"
      decoding="sync"
      style={{
        objectFit: item.fit ?? 'contain',
        mixBlendMode: item.blend ?? 'normal',
      }}
      onLoad={() => {
        const image = imageRef.current
        if (!image) return
        if (typeof image.decode === 'function') {
          void image.decode().catch(() => undefined).finally(() => readyRef.current())
        } else {
          readyRef.current()
        }
      }}
      onError={() => errorRef.current(new Error(`Image failed to load: ${item.src}`))}
    />
  )
}
