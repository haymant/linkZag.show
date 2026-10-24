import { resolveScene, parseRenderQuery, type ResolvedScene, type Scene } from '@linkzag/scene-types'
import { SceneStage, nextFrames, type LinkzagCaptureApi } from '@linkzag/scene-runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

interface SceneResponse {
  scene: Scene
  path: string
  absolutePath: string
  checksum: string
  sources: string[]
}

const parsed = parseRenderQuery(window.location.search)

function setDocumentState(ready: boolean, error: string | null): void {
  document.documentElement.dataset.linkzagReady = ready ? 'true' : 'false'
  if (error) document.documentElement.dataset.linkzagError = error
  else delete document.documentElement.dataset.linkzagError
}

function Fatal({ message, details }: { message: string; details?: string[] }) {
  return (
    <div className="lz-app" data-linkzag-error={message}>
      <div className="lz-fatal">
        <div className="lz-fatal__label">Render failed</div>
        <h1>Scene could not be rendered</h1>
        <div className="lz-fatal__message">{message}</div>
        {details && details.length > 0 && (
          <ul className="lz-fatal__details">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <div className="lz-fatal__hint">
          URL API: <code>/?scene=content/scenes/agentic-coding.yaml&amp;theme=dark&amp;t=4&amp;w=1920&amp;h=1080</code>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [scene, setScene] = useState<ResolvedScene | null>(null)
  const [time, setTime] = useState(parsed.time ?? 0)
  const timeRef = useRef(time)
  timeRef.current = time

  const [loading, setLoading] = useState(Boolean(parsed.scene))
  const [fatal, setFatal] = useState<{ message: string; details?: string[] } | null>(
    parsed.scene ? null : { message: 'Missing ?scene= parameter.' },
  )
  const [ready, setReady] = useState(false)

  const applyTime = useCallback((next: number) => {
    flushSync(() => setTime(next))
  }, [])

  const setTimeApi = useCallback(
    async (next: number) => {
      const duration = scene?.duration ?? 0
      const clamped = Math.min(Math.max(0, next), duration)
      applyTime(clamped)
      await nextFrames(2)
    },
    [applyTime, scene?.duration],
  )

  useEffect(() => {
    if (!parsed.scene) {
      setDocumentState(false, 'Missing ?scene= parameter.')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    void fetch(`/__linkzag/scene?path=${encodeURIComponent(parsed.scene)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as
          | SceneResponse
          | { error: string; details?: string[] }
        if (!response.ok || 'error' in payload) {
          const message = 'error' in payload ? payload.error : `HTTP ${response.status}`
          const details = 'error' in payload ? payload.details : undefined
          setFatal({ message, details })
          setDocumentState(false, message)
          setLoading(false)
          return
        }
        const resolved = resolveScene(payload.scene, parsed.overrides)
        setScene(resolved)
        setTime(parsed.time === undefined ? resolved.duration : Math.min(parsed.time, resolved.duration))
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setFatal({ message })
        setDocumentState(false, message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const api: LinkzagCaptureApi = {
      version: '0.1.0',
      ready,
      sceneId: scene?.id,
      duration: scene?.duration ?? 0,
      theme: scene?.theme,
      time,
      setTime: setTimeApi,
      getTime: () => timeRef.current,
    }
    window.__LINKZAG__ = api
    setDocumentState(ready && !fatal, fatal?.message ?? null)
  }, [fatal, ready, scene, setTimeApi, time])

  if (fatal) return <Fatal message={fatal.message} details={fatal.details} />

  if (loading || !scene) {
    return (
      <div className="lz-app">
        <div className="lz-loading">
          <div className="lz-loading__pulse" />
          <div>Loading scene…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="lz-app">
      <SceneStage
        scene={scene}
        time={time}
        onReady={() => setReady(true)}
        onError={(error) => {
          setReady(false)
          setDocumentState(false, error.message)
        }}
      />
    </div>
  )
}
