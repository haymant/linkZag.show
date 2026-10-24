import type { BackgroundSpec, ResolvedScene, Scene, ThemeName } from './schema.ts'
import { DEFAULT_SCENE } from './schema.ts'

/**
 * Merge scene defaults, file values, and CLI/URL overrides into the exact scene
 * the runtime renders. Explicit override > scene file > variant default > global default.
 */
export function resolveScene(scene: Scene, overrides: import('./schema').RenderOverrides = {}): ResolvedScene {
  const theme: ThemeName = overrides.theme ?? scene.theme ?? DEFAULT_SCENE.theme
  const variant = (() => {
    if (overrides.variant && overrides.variant !== 'auto') return overrides.variant
    return scene.variant ?? DEFAULT_SCENE.variant
  })()

  let background: BackgroundSpec
  if (overrides.transparent) {
    background = 'transparent'
  } else if (overrides.background) {
    background = overrides.background
  } else if (scene.background) {
    background = scene.background
  } else if (variant === 'item') {
    background = 'transparent'
  } else {
    background = 'theme'
  }

  return {
    ...scene,
    theme,
    variant,
    background,
    width: overrides.width ?? scene.width ?? DEFAULT_SCENE.width,
    height: overrides.height ?? scene.height ?? DEFAULT_SCENE.height,
    duration: overrides.duration ?? scene.duration ?? DEFAULT_SCENE.duration,
    padding: overrides.padding ?? scene.padding ?? DEFAULT_SCENE.padding,
  }
}

export function effectiveThemeForBackground(scene: ResolvedScene): ThemeName {
  return scene.theme
}

export function isTransparent(scene: Pick<ResolvedScene, 'background'>): boolean {
  return scene.background === 'transparent'
}
