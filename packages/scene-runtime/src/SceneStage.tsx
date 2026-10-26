import {
  buildSceneLayout,
  getTheme,
  themeCssVars,
  animatedStyle,
  type EnterSpec,
  type ResolvedScene,
} from '@linkzag/scene-types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ItemFrame } from './ItemFrame'
import { SceneHeader } from './SceneHeader'

export interface SceneStageProps {
  scene: ResolvedScene
  time: number
  className?: string
  onReady?: () => void
  onError?: (error: Error) => void
}

const FOOTER_ENTER: EnterSpec = { type: 'fade', delay: 0.55, duration: 0.6, easing: 'ease-out' }

function errorMessage(index: number, type: string, error: Error): string {
  return `items.${index} (${type}): ${error.message}`
}

export function SceneStage({ scene, time, className, onReady, onError }: SceneStageProps) {
  const tokens = useMemo(() => getTheme(scene.theme), [scene.theme])
  const layout = useMemo(() => buildSceneLayout(scene), [scene])
  const [ready, setReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendingRef = useRef<Set<number>>(new Set(layout.items.map((_, index) => index)))
  const fontsReadyRef = useRef(false)
  const readySentRef = useRef(false)
  const errorRef = useRef<string | null>(null)
  const rafRef = useRef(0)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  onReadyRef.current = onReady
  onErrorRef.current = onError

  const maybeReady = useCallback(() => {
    if (errorRef.current || readySentRef.current) return
    if (!fontsReadyRef.current || pendingRef.current.size > 0) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (errorRef.current || readySentRef.current) return
        readySentRef.current = true
        setReady(true)
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.linkzagReady = 'true'
        }
        onReadyRef.current?.()
      })
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined

    const load = async () => {
      if (!fonts) return
      const families = ['Inter Variable', 'Space Grotesk Variable', 'JetBrains Mono']
      await Promise.all(
        families.flatMap((family) =>
          [400, 500, 600, 700].map((weight) => fonts.load(`${weight} 16px "${family}"`)),
        ),
      )
      await fonts.ready
    }

    void load()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return
        fontsReadyRef.current = true
        setFontsReady(true)
        maybeReady()
      })
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [maybeReady])

  const markItemReady = useCallback(
    (index: number) => {
      pendingRef.current.delete(index)
      maybeReady()
    },
    [maybeReady],
  )

  const reportError = useCallback((message: string) => {
    if (errorRef.current) return
    errorRef.current = message
    cancelAnimationFrame(rafRef.current)
    setError(message)
    setReady(false)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.linkzagError = message
      document.documentElement.dataset.linkzagReady = 'false'
    }
    onErrorRef.current?.(new Error(message))
  }, [])

  const markItemError = useCallback(
    (index: number, itemError: Error) => {
      const type = layout.items.find((entry) => entry.index === index)?.item.type ?? 'unknown'
      reportError(errorMessage(index, type, itemError))
    },
    [layout.items, reportError],
  )

  const scale = Math.min(1.35, Math.max(0.72, scene.width / 1920))
  const imageBackground = scene.background.startsWith('image:')
  const imageUrl = imageBackground ? scene.background.slice('image:'.length) : null
  const background =
    scene.background === 'transparent'
      ? 'transparent'
      : scene.background === 'theme' || imageBackground
        ? tokens.background
        : scene.background

  const rootStyle = {
    width: scene.width,
    height: scene.height,
    backgroundColor: background,
    colorScheme: tokens.isDark ? 'dark' : 'light',
    ...themeCssVars(tokens),
    '--lz-text-scale': String(scale),
    ...(scene.accent ? { '--lz-accent': scene.accent } : {}),
  } as CSSProperties

  const footerStyle = layout.footer
    ? {
        ...animatedStyle(FOOTER_ENTER, time),
        left: layout.footer.rect.x,
        top: layout.footer.rect.y,
        width: layout.footer.rect.width,
        height: layout.footer.rect.height,
        fontSize: layout.footer.fontSize,
      }
    : null

  return (
    <div
      className={['lz-scene', className].filter(Boolean).join(' ')}
      style={rootStyle}
      data-linkzag-ready={ready ? 'true' : 'false'}
      data-linkzag-error={error ?? undefined}
      data-scene-id={scene.id}
      data-theme={scene.theme}
      data-variant={scene.variant}
      data-background={scene.background}
      aria-label={scene.title ?? scene.id}
    >
      {scene.background !== 'transparent' && (
        <div
          className={[
            'lz-backdrop',
            scene.background === 'theme' || imageBackground
              ? 'lz-backdrop--theme'
              : 'lz-backdrop--solid',
          ].join(' ')}
          style={
            scene.background === 'theme' || imageBackground
              ? undefined
              : { backgroundColor: scene.background }
          }
        />
      )}
      {imageUrl && (
        <>
          <div
            className="lz-backdrop lz-backdrop--image"
            style={{ backgroundImage: `url("${imageUrl}")` }}
          />
          <div className="lz-backdrop lz-backdrop--veil" />
        </>
      )}

      <SceneHeader header={layout.header} time={time} theme={tokens} />

      {fontsReady &&
        layout.items.map((layoutItem) => (
          <ItemFrame
            key={`${layoutItem.index}-${layoutItem.item.id ?? layoutItem.item.type}`}
            layoutItem={layoutItem}
            scene={scene}
            theme={tokens}
            time={time}
            onItemReady={markItemReady}
            onItemError={markItemError}
          />
        ))}

      {layout.footer && footerStyle && (
        <div className="lz-footer" style={footerStyle}>
          <span>{layout.footer.text}</span>
          <span className="lz-footer__brand">LINKZAG.SHOW</span>
        </div>
      )}

      {error && (
        <div className="lz-error-overlay" role="alert">
          <div className="lz-error-overlay__title">Scene render error</div>
          {error}
        </div>
      )}
    </div>
  )
}
