import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { SceneItem } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'markdown' }>>

const components: Components = {
  a: ({ children }) => <span className="lz-md-link">{children}</span>,
  img: ({ src, alt }) => <img className="lz-md-image" src={src} alt={alt ?? ''} />,
}

function imageReady(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    if (image.naturalWidth === 0) {
      return Promise.reject(new Error(`Markdown image failed to load: ${image.src}`))
    }
    return typeof image.decode === 'function'
      ? image.decode().catch(() => undefined)
      : Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error(`Markdown image failed to load: ${image.src}`))
    }
    const cleanup = () => {
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', failed)
    }
    image.addEventListener('load', loaded, { once: true })
    image.addEventListener('error', failed, { once: true })
  })
}

export function MarkdownItem({ item, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    const images = [...host.querySelectorAll('img')]
    void Promise.all(images.map(imageReady))
      .then(() => {
        if (!cancelled) onReady()
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error : new Error(String(error)))
      })
    return () => {
      cancelled = true
    }
  }, [item.content, onReady, onError])

  return (
    <div
      ref={hostRef}
      className={[
        'lz-markdown',
        `lz-markdown--${item.size ?? 'md'}`,
        `lz-align-${item.align ?? 'left'}`,
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {item.content}
      </ReactMarkdown>
    </div>
  )
}
