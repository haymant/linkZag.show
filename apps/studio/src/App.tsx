import { resolveScene, type RenderOverrides, type Scene, type SceneVariant, type ThemeName } from '@linkzag/scene-types'
import { SceneStage } from '@linkzag/scene-runtime'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface SceneSummary {
  id: string
  title?: string
  duration: number
  path: string
  absolutePath: string
  theme?: string
  variant?: string
  itemCount: number
}

interface SceneResponse {
  scene: Scene
  path: string
  checksum: string
  sources: string[]
}

type ThemeChoice = 'scene' | ThemeName
type VariantChoice = 'auto' | SceneVariant

const RENDERER_URL = import.meta.env.VITE_RENDERER_URL ?? 'http://127.0.0.1:5173'

function seconds(value: number): string {
  return `${value.toFixed(2)}s`
}

export default function App() {
  const [scenes, setScenes] = useState<SceneSummary[]>([])
  const [sceneErrors, setSceneErrors] = useState<Array<{ path: string; error: string }>>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [scene, setScene] = useState<Scene | null>(null)
  const [sceneMeta, setSceneMeta] = useState<SceneResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeChoice>('scene')
  const [variant, setVariant] = useState<VariantChoice>('auto')
  const [transparent, setTransparent] = useState(false)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [stageReady, setStageReady] = useState(false)
  const timeRef = useRef(0)
  timeRef.current = time
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1200, height: 700 })

  const resolved = useMemo(() => {
    if (!scene) return null
    const overrides: RenderOverrides = { variant }
    if (theme !== 'scene') overrides.theme = theme
    if (transparent) overrides.transparent = true
    return resolveScene(scene, overrides)
  }, [scene, theme, variant, transparent])

  const stageKey = resolved
    ? `${resolved.id}-${resolved.theme}-${resolved.variant}-${resolved.background}-${resolved.width}x${resolved.height}-${transparent}`
    : 'empty'

  useEffect(() => {
    setStageReady(false)
  }, [stageKey])

  useEffect(() => {
    let cancelled = false
    void fetch('/__linkzag/scenes')
      .then(async (response) => {
        const payload = (await response.json()) as {
          scenes: SceneSummary[]
          errors: Array<{ path: string; error: string }>
        }
        if (cancelled) return
        setScenes(payload.scenes)
        setSceneErrors(payload.errors)
        setSelectedPath(
          (current) =>
            current ??
            payload.scenes.find((entry) => entry.id === 'agentic-coding')?.path ??
            payload.scenes[0]?.path ??
            null,
        )
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPath) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSceneMeta(null)
    setStageReady(false)
    setPlaying(false)
    void fetch(`/__linkzag/scene?path=${encodeURIComponent(selectedPath)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as SceneResponse | { error: string }
        if (!response.ok || 'error' in payload) {
          throw new Error('error' in payload ? payload.error : `HTTP ${response.status}`)
        }
        setScene(payload.scene)
        setSceneMeta(payload)
        setTime(payload.scene.duration ?? 0)
        setLoading(false)
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [selectedPath])

  useEffect(() => {
    if (!viewportRef.current) return
    const element = viewportRef.current
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      setViewport({ width: Math.max(1, rect.width - 48), height: Math.max(1, rect.height - 48) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !resolved) return
    const duration = resolved.duration
    const startedAt = performance.now()
    const from = timeRef.current >= duration - 0.01 ? 0 : timeRef.current
    if (from === 0) setTime(0)
    let frame = 0
    const tick = (now: number) => {
      const next = from + (now - startedAt) / 1000
      if (next >= duration) {
        setTime(duration)
        setPlaying(false)
        return
      }
      setTime(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, resolved])

  const togglePlay = useCallback(() => {
    if (!resolved) return
    if (!playing && timeRef.current >= resolved.duration - 0.01) setTime(0)
    setPlaying((value) => !value)
  }, [playing, resolved])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      event.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  const scale = resolved
    ? Math.min(viewport.width / resolved.width, viewport.height / resolved.height)
    : 1

  const rendererHref = useMemo(() => {
    if (!resolved || !sceneMeta) return RENDERER_URL
    const url = new URL(RENDERER_URL)
    url.searchParams.set('scene', sceneMeta.path)
    url.searchParams.set('theme', resolved.theme)
    url.searchParams.set('variant', resolved.variant)
    url.searchParams.set('t', time.toFixed(3))
    url.searchParams.set('w', String(resolved.width))
    url.searchParams.set('h', String(resolved.height))
    if (transparent) url.searchParams.set('transparent', '1')
    return url.toString()
  }, [resolved, sceneMeta, time, transparent])

  return (
    <div className="studio">
      <header className="studio__bar">
        <div className="studio__brand">
          <span className="studio__mark">LINKZAG</span>
          <span className="studio__product">STUDIO</span>
        </div>
        <div className="studio__meta">
          {resolved && (
            <>
              <span>{resolved.id}</span>
              <span>
                {resolved.width}×{resolved.height}
              </span>
              <span>{seconds(resolved.duration)}</span>
              <span className={stageReady ? 'studio__ready' : 'studio__waiting'}>
                {stageReady ? 'ready' : 'warming up'}
              </span>
            </>
          )}
        </div>
        <a className="studio__link" href={rendererHref} target="_blank" rel="noreferrer">
          Open renderer ↗
        </a>
      </header>

      <main className="studio__main">
        <aside className="studio__sidebar">
          <div className="studio__section-label">Scenes</div>
          <div className="studio__scene-list">
            {scenes.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`studio__scene ${entry.path === selectedPath ? 'is-active' : ''}`}
                onClick={() => setSelectedPath(entry.path)}
              >
                <span className="studio__scene-title">{entry.title ?? entry.id}</span>
                <span className="studio__scene-meta">
                  {entry.id} · {entry.itemCount} items · {seconds(entry.duration)}
                </span>
                <span className="studio__scene-path">{entry.path}</span>
              </button>
            ))}
          </div>

          {sceneErrors.length > 0 && (
            <div className="studio__errors">
              <div className="studio__section-label">Scene errors</div>
              {sceneErrors.map((entry) => (
                <div key={entry.path} className="studio__error">
                  <strong>{entry.path}</strong>
                  <span>{entry.error}</span>
                </div>
              ))}
            </div>
          )}

          <div className="studio__controls">
            <label className="studio__control">
              <span>Theme</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeChoice)}>
                <option value="scene">scene default</option>
                <option value="dark">dark</option>
                <option value="light">light</option>
              </select>
            </label>
            <label className="studio__control">
              <span>Composition</span>
              <select value={variant} onChange={(event) => setVariant(event.target.value as VariantChoice)}>
                <option value="auto">scene default</option>
                <option value="slide">whole slide</option>
                <option value="item">standalone item</option>
              </select>
            </label>
            <label className="studio__check">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              Transparent background
            </label>
          </div>

          {sceneMeta && (
            <div className="studio__sources">
              <div className="studio__section-label">Sources</div>
              <code>{sceneMeta.checksum.slice(0, 12)}</code>
              {sceneMeta.sources.map((source) => (
                <div key={source}>{source}</div>
              ))}
            </div>
          )}
        </aside>

        <section className="studio__preview">
          <div className="studio__viewport" ref={viewportRef}>
            {error && <div className="studio__fatal">{error}</div>}
            {!error && loading && <div className="studio__fatal">Loading scene…</div>}
            {!error && !loading && resolved && (
              <div
                className={`studio__canvas ${transparent ? 'is-transparent' : ''}`}
                style={{
                  width: resolved.width * scale,
                  height: resolved.height * scale,
                }}
              >
                <div
                  style={{
                    width: resolved.width,
                    height: resolved.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <SceneStage
                    key={stageKey}
                    scene={resolved}
                    time={time}
                    onReady={() => setStageReady(true)}
                    onError={(stageError) => {
                      setStageReady(false)
                      setError(stageError.message)
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="studio__timeline">
            <button type="button" className="studio__play" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              aria-label="Scene time"
              type="range"
              min={0}
              max={resolved?.duration ?? 0}
              step={0.01}
              value={Math.min(time, resolved?.duration ?? 0)}
              onChange={(event) => {
                setPlaying(false)
                setTime(Number(event.target.value))
              }}
            />
            <div className="studio__time">
              <strong>{seconds(time)}</strong>
              <span>/ {seconds(resolved?.duration ?? 0)}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
