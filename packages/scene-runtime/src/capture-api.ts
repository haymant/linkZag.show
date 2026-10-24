export interface LinkzagCaptureApi {
  version: string
  ready: boolean
  sceneId?: string
  duration: number
  theme?: string
  time: number
  setTime: (time: number) => Promise<void>
  getTime: () => number
}

declare global {
  interface Window {
    __LINKZAG__?: LinkzagCaptureApi
  }
}

export function nextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
