import { animatedStyle } from '@linkzag/scene-types'
import type { LayoutItem, ThemeTokens } from '@linkzag/scene-types'
import type { CSSProperties } from 'react'
import {
  CodeItem,
  EChartsItem,
  ImageItem,
  MarkdownItem,
  MermaidItem,
  QuoteItem,
  XyflowItem,
} from '@linkzag/scene-components'
import type { ItemRenderProps } from '@linkzag/scene-components'
import type { ResolvedScene } from '@linkzag/scene-types'
import { useCallback } from 'react'
import { ItemErrorBoundary } from './ItemErrorBoundary'

interface Props {
  layoutItem: LayoutItem
  scene: ResolvedScene
  theme: ThemeTokens
  time: number
  onItemReady: (index: number) => void
  onItemError: (index: number, error: Error) => void
}

function RenderItem({
  item,
  theme,
  scene,
  time,
  enter,
  width,
  height,
  onReady,
  onError,
}: ItemRenderProps): React.ReactNode {
  switch (item.type) {
    case 'markdown':
      return <MarkdownItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'echarts':
      return <EChartsItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'mermaid':
      return <MermaidItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'xyflow':
      return <XyflowItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'image':
      return <ImageItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'quote':
      return <QuoteItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    case 'code':
      return <CodeItem item={item} theme={theme} scene={scene} time={time} enter={enter} width={width} height={height} onReady={onReady} onError={onError} />
    default:
      return null
  }
}

export function ItemFrame({ layoutItem, scene, theme, time, onItemReady, onItemError }: Props) {
  const { item, rect, enter, index } = layoutItem
  const animated = animatedStyle(enter, time)
  const opacity = (item.opacity ?? 1) * animated.opacity
  const transforms = [animated.transform === 'none' ? '' : animated.transform]
  if (item.rotate) transforms.push(`rotate(${item.rotate}deg)`)
  const transform = transforms.filter(Boolean).join(' ') || undefined

  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    zIndex: item.zIndex,
    opacity,
    transform,
    clipPath: animated.clipPath,
    transformOrigin: animated.transformOrigin,
  }

  const handleReady = useCallback(() => onItemReady(index), [index, onItemReady])
  const handleError = useCallback(
    (error: Error) => onItemError(index, error),
    [index, onItemError],
  )

  return (
    <div className="lz-item lz-item-frame" style={style} data-item-index={index} data-item-type={item.type}>
      <ItemErrorBoundary onError={handleError}>
        <RenderItem
          item={item}
          theme={theme}
          scene={scene}
          time={time}
          enter={enter}
          width={rect.width}
          height={rect.height}
          onReady={handleReady}
          onError={handleError}
        />
      </ItemErrorBoundary>
    </div>
  )
}
