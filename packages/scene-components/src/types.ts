import type { EnterSpec, ResolvedScene, SceneItem, ThemeTokens } from '@linkzag/scene-types'

export interface ItemRenderProps<T extends SceneItem = SceneItem> {
  item: T
  theme: ThemeTokens
  scene: ResolvedScene
  time: number
  enter: EnterSpec
  width: number
  height: number
  onReady: () => void
  onError: (error: Error) => void
}
