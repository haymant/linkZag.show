import dagre from '@dagrejs/dagre'
import {
  Background,
  BackgroundVariant,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Fragment, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { timedProgress } from '@linkzag/scene-types'
import type { EnterSpec, SceneItem, ThemeTokens } from '@linkzag/scene-types'
import type { ItemRenderProps } from './types'

type Props = ItemRenderProps<Extract<SceneItem, { type: 'xyflow' }>>
type ItemNode = Extract<SceneItem, { type: 'xyflow' }>['nodes'][number]

interface LzNodeData extends Record<string, unknown> {
  label: string
  sublabel?: string
  kind: NonNullable<ItemNode['kind']>
}

type LzFlowNode = Node<LzNodeData, 'lz'>

interface LzEdgeData extends Record<string, unknown> {
  progress: number
  label?: string
}

type LzFlowEdge = Edge<LzEdgeData, 'lz'>

const SIDES = [
  { position: Position.Top, key: 'top' },
  { position: Position.Right, key: 'right' },
  { position: Position.Bottom, key: 'bottom' },
  { position: Position.Left, key: 'left' },
] as const

function LzNodeView({ data }: NodeProps<LzFlowNode>) {
  const kind = data.kind ?? 'default'
  return (
    <div className={`lz-node lz-node--${kind}`}>
      {SIDES.map(({ position, key }) => (
        <Fragment key={key}>
          <Handle
            type="source"
            id={`s-${key}`}
            position={position}
            className="lz-handle"
            isConnectable={false}
          />
          <Handle
            type="target"
            id={`t-${key}`}
            position={position}
            className="lz-handle"
            isConnectable={false}
          />
        </Fragment>
      ))}
      <div className="lz-node__label">{data.label}</div>
      {data.sublabel && <div className="lz-node__sublabel">{data.sublabel}</div>}
    </div>
  )
}

/**
 * Edge drawing is driven by `data.progress`, which is derived from scene time.
 * SVG pathLength normalises the path so a dash offset can reveal it smoothly
 * without any wall-clock animation.
 *
 * Backward edges (repair/retry loops) are bowed below the forward row so they
 * never sit underneath a forward edge and produce a double-headed line.
 */
function edgePath(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): [string, number, number] {
  if (targetX < sourceX) {
    const dx = sourceX - targetX
    const bend = Math.min(180, Math.max(90, dx * 0.22))
    const c1x = sourceX - dx * 0.1
    const c1y = sourceY + bend
    const c2x = targetX + dx * 0.1
    const c2y = targetY + bend
    const path = `M ${sourceX},${sourceY} C ${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`
    return [path, (sourceX + targetX) / 2, (sourceY + targetY) / 2 + bend * 0.75]
  }
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.24,
  })
  return [path, labelX, labelY]
}

function LzEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<LzFlowEdge>) {
  const [path, labelX, labelY] = edgePath(
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  )
  const progress = data?.progress ?? 1
  const drawing = progress < 1
  const pathStyle: CSSProperties = drawing
    ? { ...style, strokeDasharray: '1', strokeDashoffset: 1 - progress }
    : (style ?? {})

  return (
    <>
      <path
        d={path}
        fill="none"
        className="react-flow__edge-path"
        style={pathStyle}
        pathLength={drawing ? 1 : undefined}
        markerEnd={drawing ? undefined : markerEnd}
      />
      {data?.label && progress >= 0.86 && (
        <EdgeLabelRenderer>
          <div
            className="lz-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity: Math.min(1, (progress - 0.86) / 0.14),
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { lz: LzNodeView }
const edgeTypes = { lz: LzEdgeView }

function nodeSize(node: ItemNode): { width: number; height: number } {
  const label = node.label.length
  const sublabel = node.sublabel?.length ?? 0
  const width = node.width ?? Math.max(150, Math.min(320, 92 + Math.max(label, sublabel) * 7.2))
  const height = node.height ?? (node.sublabel ? 74 : 58)
  return { width, height }
}

function sideFor(source: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { source: 'right', target: 'left' }
      : { source: 'left', target: 'right' }
  }
  return dy >= 0
    ? { source: 'bottom', target: 'top' }
    : { source: 'top', target: 'bottom' }
}

interface BuiltGraph {
  nodes: LzFlowNode[]
  edges: LzFlowEdge[]
}

function buildGraph(
  item: Extract<SceneItem, { type: 'xyflow' }>,
  theme: ThemeTokens,
): BuiltGraph {
  const nodeIds = new Set(item.nodes.map((node) => node.id))
  if (nodeIds.size !== item.nodes.length) throw new Error('XYFlow node ids must be unique')
  for (const edge of item.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`XYFlow edge ${edge.source} -> ${edge.target} references a missing node`)
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  const sizes = new Map<string, { width: number; height: number }>()
  for (const node of item.nodes) sizes.set(node.id, nodeSize(node))

  const allPositioned = item.nodes.every((node) => node.x !== undefined && node.y !== undefined)
  const needsDagre = item.layout !== 'manual' && !allPositioned

  if (needsDagre) {
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
      rankdir: item.direction ?? 'LR',
      nodesep: 58,
      ranksep: 96,
      marginx: 20,
      marginy: 20,
    })
    graph.setDefaultEdgeLabel(() => ({}))
    for (const node of item.nodes) {
      const size = sizes.get(node.id)!
      graph.setNode(node.id, { width: size.width, height: size.height })
    }
    for (const edge of item.edges) graph.setEdge(edge.source, edge.target)
    dagre.layout(graph)

    for (const node of item.nodes) {
      const size = sizes.get(node.id)!
      const placed = graph.node(node.id) as { x: number; y: number }
      positions.set(node.id, { x: placed.x - size.width / 2, y: placed.y - size.height / 2 })
    }
  } else {
    for (const [index, node] of item.nodes.entries()) {
      positions.set(node.id, {
        x: node.x ?? (index % 4) * 280,
        y: node.y ?? Math.floor(index / 4) * 120,
      })
    }
  }

  const nodes: LzFlowNode[] = item.nodes.map((node) => {
    const size = sizes.get(node.id)!
    const position = positions.get(node.id)!
    return {
      id: node.id,
      type: 'lz',
      position,
      data: {
        label: node.label,
        ...(node.sublabel ? { sublabel: node.sublabel } : {}),
        kind: node.kind ?? 'default',
      },
      draggable: false,
      selectable: false,
      connectable: false,
      style: { width: size.width, height: size.height },
    }
  })

  const centers = new Map<string, { x: number; y: number }>()
  for (const node of item.nodes) {
    const position = positions.get(node.id)!
    const size = sizes.get(node.id)!
    centers.set(node.id, { x: position.x + size.width / 2, y: position.y + size.height / 2 })
  }

  const edges: LzFlowEdge[] = item.edges.map((edge, index) => {
    const sides = sideFor(centers.get(edge.source)!, centers.get(edge.target)!)
    const color =
      edge.kind === 'accent' ? theme.accent2 : edge.kind === 'dashed' ? theme.muted : theme.accent
    return {
      id: edge.id ?? `edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: `s-${sides.source}`,
      targetHandle: `t-${sides.target}`,
      type: 'lz',
      data: { progress: 1, ...(edge.label ? { label: edge.label } : {}) },
      animated: false,
      selectable: false,
      focusable: false,
      style: {
        stroke: color,
        strokeWidth: edge.kind === 'accent' ? 2.2 : 1.6,
        ...(edge.kind === 'dashed' ? { strokeDasharray: '7 7' } : {}),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 16,
        height: 16,
      },
    }
  })

  return { nodes, edges }
}

interface FlowTiming {
  enabled: boolean
  delay: number
  nodeDuration: number
  stagger: number
  edgeStart: number
  edgeDuration: number
  edgeStagger: number
  end: number
}

function flowTiming(item: Extract<SceneItem, { type: 'xyflow' }>, enter: EnterSpec): FlowTiming {
  const config = item.flowAnimation
  const enabled = config?.enabled !== false
  const delay = config?.delay ?? enter.delay + 0.15
  const nodeDuration = config?.duration ?? 0.5
  const stagger = config?.stagger ?? 0.06
  const edgeDuration = config?.edgeDuration ?? 0.55
  const edgeStagger = config?.edgeStagger ?? 0.05
  const edgeStart =
    delay + Math.max(0, item.nodes.length - 1) * stagger + nodeDuration + 0.08
  const end = edgeStart + Math.max(0, item.edges.length - 1) * edgeStagger + edgeDuration
  return { enabled, delay, nodeDuration, stagger, edgeStart, edgeDuration, edgeStagger, end }
}

function animateGraph(graph: BuiltGraph, time: number, timing: FlowTiming): BuiltGraph {
  if (!timing.enabled) return graph
  const nodes = graph.nodes.map((node, index) => {
    const progress = timedProgress(
      time,
      timing.delay + index * timing.stagger,
      timing.nodeDuration,
    )
    const style = {
      ...node.style,
      opacity: progress,
      ['--lz-node-scale' as string]: String(0.94 + progress * 0.06),
    } as CSSProperties
    return { ...node, style }
  })
  const edges = graph.edges.map((edge, index) => {
    const progress = timedProgress(
      time,
      timing.edgeStart + index * timing.edgeStagger,
      timing.edgeDuration,
    )
    return { ...edge, data: { ...(edge.data ?? { progress: 1 }), progress } }
  })
  return { nodes, edges }
}

export function XyflowItem({ item, theme, time, enter, onReady, onError }: Props) {
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError

  const graph = useMemo(() => buildGraph(item, theme), [item, theme])
  const timing = flowTiming(item, enter)
  const finished = !timing.enabled || time >= timing.end
  const clock = finished ? Number.POSITIVE_INFINITY : time
  const animated = useMemo(
    () => (finished ? graph : animateGraph(graph, clock, timing)),
    // Primitive timing fields keep the expensive graph animation from running
    // after the sequence has settled.
    [finished, graph, clock, timing.enabled, timing.delay, timing.nodeDuration, timing.stagger, timing.edgeStart, timing.edgeDuration, timing.edgeStagger],
  )

  useEffect(() => {
    if (animated.nodes.length === 0) readyRef.current()
  }, [animated.nodes.length])

  return (
    <div className="lz-xyflow" data-flow-progress={finished ? '1.0000' : time.toFixed(4)}>
      <ReactFlow
        nodes={animated.nodes}
        edges={animated.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: item.fitViewPadding ?? 0.12, duration: 0 }}
        minZoom={0.15}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling
        disableKeyboardA11y
        colorMode={theme.isDark ? 'dark' : 'light'}
        onInit={(instance) => {
          requestAnimationFrame(() => {
            try {
              instance.fitView({ padding: item.fitViewPadding ?? 0.12, duration: 0 })
              requestAnimationFrame(() => readyRef.current())
            } catch (error) {
              errorRef.current(error instanceof Error ? error : new Error(String(error)))
            }
          })
        }}
      >
        {item.grid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={26}
            size={1.2}
            color={theme.grid}
          />
        )}
      </ReactFlow>
    </div>
  )
}
