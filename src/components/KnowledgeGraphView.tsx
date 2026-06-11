import { useState, useCallback } from 'react'

interface GraphNode {
  id: string
  name: string
  file: string
  layer: string
  description: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface GraphEdge {
  from: string
  to: string
  label?: string
  type: 'solid' | 'dashed'
}

const nodes: GraphNode[] = [
  {
    id: 'http-server',
    name: 'HTTP Server',
    file: 'entrypoints/http_server.py',
    layer: 'API层',
    description: 'SGLang的HTTP入口点，接收客户端请求并转发给内部引擎处理，支持流式和非流式响应',
    x: 250,
    y: 40,
    width: 180,
    height: 56,
    color: '#00d4ff',
  },
  {
    id: 'openai-adapter',
    name: 'OpenAI Adapter',
    file: 'entrypoints/openai/',
    layer: 'API层',
    description: '提供与OpenAI API兼容的接口层，支持Chat Completions、Completions等标准端点',
    x: 500,
    y: 40,
    width: 180,
    height: 56,
    color: '#00d4ff',
  },
  {
    id: 'engine-api',
    name: 'Engine API',
    file: 'entrypoints/engine.py',
    layer: 'API层',
    description: '直接引擎API入口，提供编程式接口，跳过HTTP层直接与TokenizerManager交互',
    x: 750,
    y: 40,
    width: 180,
    height: 56,
    color: '#00d4ff',
  },
  {
    id: 'tokenizer-manager',
    name: 'TokenizerManager',
    file: 'managers/tokenizer_manager.py',
    layer: 'Tokenize层',
    description: '负责输入tokenization和请求路由，将文本转为token id后发送给Scheduler，同时管理LoRA和Grammar等适配器',
    x: 500,
    y: 170,
    width: 200,
    height: 56,
    color: '#22c55e',
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    file: 'scheduler/scheduler.py',
    layer: 'Scheduler层',
    description: '核心调度器，负责请求批管理、缓存协调、prefill/decode调度，是SGLang架构的中央枢纽',
    x: 500,
    y: 300,
    width: 200,
    height: 56,
    color: '#f59e0b',
  },
  {
    id: 'tp-model-worker',
    name: 'TpModelWorker',
    file: 'workers/tp_worker.py',
    layer: 'Worker层',
    description: '多GPU张量并行Worker，管理模型权重的分布式加载，协调多GPU间的通信与同步',
    x: 500,
    y: 430,
    width: 200,
    height: 56,
    color: '#a855f7',
  },
  {
    id: 'model-runner',
    name: 'ModelRunner',
    file: 'model_runner/model_runner.py',
    layer: 'Model层',
    description: '执行模型前向计算的核心模块，集成FlashInfer/CUDA Kernel，管理KV Cache的GPU内存',
    x: 500,
    y: 560,
    width: 200,
    height: 56,
    color: '#ec4899',
  },
  {
    id: 'detokenizer-manager',
    name: 'DetokenizerManager',
    file: 'managers/detokenizer_manager.py',
    layer: 'Tokenize层',
    description: '将输出token id解码为文本，处理增量解码和特殊token，将结果返回给客户端',
    x: 800,
    y: 300,
    width: 200,
    height: 56,
    color: '#22c55e',
  },
  {
    id: 'radix-cache',
    name: 'RadixCache',
    file: 'cache/radix_cache.py',
    layer: 'Cache子系统',
    description: '基于基数树的KV Cache，支持前缀匹配和自动合并，实现高效的KV Cache复用',
    x: 100,
    y: 300,
    width: 170,
    height: 56,
    color: '#06b6d4',
  },
  {
    id: 'hicache',
    name: 'HiCache',
    file: 'cache/hicache.py',
    layer: 'Cache子系统',
    description: '分层缓存系统，支持GPU/CPU间的KV Cache卸载，降低显存压力同时保持访问效率',
    x: 100,
    y: 390,
    width: 170,
    height: 56,
    color: '#06b6d4',
  },
  {
    id: 'overlap-schedule',
    name: 'OverlapSchedule',
    file: 'scheduler/scheduler.py',
    layer: 'Generation子系统',
    description: '重叠调度策略，将prefill和decode阶段重叠执行，提高GPU利用率和吞吐量',
    x: 100,
    y: 210,
    width: 170,
    height: 56,
    color: '#f97316',
  },
  {
    id: 'chunked-prefill',
    name: 'ChunkedPrefill',
    file: 'scheduler/scheduler.py',
    layer: 'Generation子系统',
    description: '将长prefill请求分块处理，避免单个长请求阻塞整个batch，改善延迟分布',
    x: 100,
    y: 130,
    width: 170,
    height: 56,
    color: '#f97316',
  },
  {
    id: 'speculative-decoding',
    name: 'Speculative Decoding',
    file: 'workers/speculative.py',
    layer: 'Generation子系统',
    description: '投机解码加速，使用Draft Model生成候选token，再由主模型验证，提升解码速度',
    x: 800,
    y: 430,
    width: 200,
    height: 56,
    color: '#f97316',
  },
  {
    id: 'pd-disaggregation',
    name: 'PD Disaggregation',
    file: 'runtime/',
    layer: 'Generation子系统',
    description: 'Prefill-Decode分离架构，将计算密集的prefill和内存密集的decode分布到不同节点',
    x: 800,
    y: 520,
    width: 200,
    height: 56,
    color: '#f97316',
  },
  {
    id: 'lora',
    name: 'LoRA',
    file: 'lora/',
    layer: 'Generation子系统',
    description: 'LoRA适配器管理，支持多LoRA动态加载和切换，实现单模型服务多任务',
    x: 800,
    y: 170,
    width: 170,
    height: 56,
    color: '#f97316',
  },
  {
    id: 'grammar',
    name: 'Grammar',
    file: 'grammar/',
    layer: 'Generation子系统',
    description: '结构化输出约束，支持正则表达式、JSON Schema等语法约束，确保输出格式合规',
    x: 800,
    y: 80,
    width: 170,
    height: 56,
    color: '#f97316',
  },
]

const edges: GraphEdge[] = [
  { from: 'http-server', to: 'tokenizer-manager', label: '请求转发', type: 'solid' },
  { from: 'openai-adapter', to: 'tokenizer-manager', label: '请求转发', type: 'solid' },
  { from: 'engine-api', to: 'tokenizer-manager', label: '直接调用', type: 'solid' },
  { from: 'tokenizer-manager', to: 'scheduler', label: 'Token ID', type: 'solid' },
  { from: 'scheduler', to: 'tp-model-worker', label: 'Batch调度', type: 'solid' },
  { from: 'tp-model-worker', to: 'model-runner', label: '前向计算', type: 'solid' },
  { from: 'model-runner', to: 'detokenizer-manager', label: '输出Token', type: 'solid' },
  { from: 'detokenizer-manager', to: 'http-server', label: '响应返回', type: 'dashed' },
  { from: 'scheduler', to: 'radix-cache', label: '缓存查询/更新', type: 'dashed' },
  { from: 'scheduler', to: 'hicache', label: '分层缓存', type: 'dashed' },
  { from: 'scheduler', to: 'overlap-schedule', label: '重叠调度', type: 'dashed' },
  { from: 'scheduler', to: 'chunked-prefill', label: '分块处理', type: 'dashed' },
  { from: 'scheduler', to: 'speculative-decoding', label: '投机调度', type: 'dashed' },
  { from: 'scheduler', to: 'pd-disaggregation', label: 'PD分离', type: 'dashed' },
  { from: 'tokenizer-manager', to: 'lora', label: 'LoRA路由', type: 'dashed' },
  { from: 'tokenizer-manager', to: 'grammar', label: '语法约束', type: 'dashed' },
]

const layerLegend = [
  { name: 'API层', color: '#00d4ff' },
  { name: 'Tokenize层', color: '#22c55e' },
  { name: 'Scheduler层', color: '#f59e0b' },
  { name: 'Worker层', color: '#a855f7' },
  { name: 'Model层', color: '#ec4899' },
  { name: 'Cache子系统', color: '#06b6d4' },
  { name: 'Generation子系统', color: '#f97316' },
]

function getConnectedNodeIds(nodeId: string): Set<string> {
  const ids = new Set<string>()
  for (const edge of edges) {
    if (edge.from === nodeId) ids.add(edge.to)
    if (edge.to === nodeId) ids.add(edge.from)
  }
  return ids
}

function getConnectedEdges(nodeId: string): Set<number> {
  const indices = new Set<number>()
  edges.forEach((edge, i) => {
    if (edge.from === nodeId || edge.to === nodeId) indices.add(i)
  })
  return indices
}

export default function KnowledgeGraphView() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const activeNodeId = hoveredNode || selectedNode
  const connectedNodeIds = activeNodeId ? getConnectedNodeIds(activeNodeId) : new Set<string>()
  const connectedEdgeIndices = activeNodeId ? getConnectedEdges(activeNodeId) : new Set<number>()

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNode(nodeId)
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId))
  }, [])

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null
  const selectedConnected = selectedNode
    ? Array.from(getConnectedNodeIds(selectedNode))
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean) as GraphNode[]
    : []

  const svgWidth = 1050
  const svgHeight = 660

  return (
    <div className="flex gap-6">
      <div className="flex-1 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[800px]"
          style={{ maxHeight: '75vh' }}
        >
          <defs>
            <marker
              id="arrowhead-solid"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#00d4ff" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from)!
            const toNode = nodes.find((n) => n.id === edge.to)!
            const isActive = connectedEdgeIndices.has(i)
            const isDashed = edge.type === 'dashed'

            let fromX = fromNode.x + fromNode.width / 2
            let fromY = fromNode.y + fromNode.height
            let toX = toNode.x + toNode.width / 2
            let toY = toNode.y

            if (edge.from === 'model-runner' && edge.to === 'detokenizer-manager') {
              fromX = fromNode.x + fromNode.width
              fromY = fromNode.y + fromNode.height / 2
              toX = toNode.x
              toY = toNode.y + toNode.height / 2
            }

            if (edge.from === 'detokenizer-manager' && edge.to === 'http-server') {
              fromX = fromNode.x + fromNode.width / 2
              fromY = toNode.y + toNode.height
              toX = toNode.x + toNode.width
              toY = toNode.y + toNode.height / 2
            }

            const midX = (fromX + toX) / 2
            const midY = (fromY + toY) / 2

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke={isActive ? '#00d4ff' : '#374151'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isDashed ? '6,4' : undefined}
                  markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead-solid)'}
                  opacity={activeNodeId ? (isActive ? 1 : 0.2) : 0.6}
                  className="transition-all duration-300"
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    fill={isActive ? '#00d4ff' : '#6b7280'}
                    fontSize="10"
                    opacity={activeNodeId ? (isActive ? 1 : 0.3) : 0.7}
                    className="transition-all duration-300"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id
            const isSelected = selectedNode === node.id
            const isConnected = connectedNodeIds.has(node.id)
            const isDimmed = activeNodeId && !isHovered && !isSelected && !isConnected

            return (
              <g
                key={node.id}
                onMouseEnter={() => handleNodeHover(node.id)}
                onMouseLeave={() => handleNodeHover(null)}
                onClick={() => handleNodeClick(node.id)}
                className="cursor-pointer"
                opacity={isDimmed ? 0.3 : 1}
                style={{ transition: 'opacity 0.3s ease' }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx="10"
                  ry="10"
                  fill={`${node.color}15`}
                  stroke={isHovered || isSelected ? node.color : `${node.color}60`}
                  strokeWidth={isHovered || isSelected ? 2 : 1}
                  filter={isHovered || isSelected ? 'url(#glow)' : undefined}
                  style={{ transition: 'all 0.3s ease' }}
                />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + 22}
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="600"
                >
                  {node.name}
                </text>
                <text
                  x={node.x + node.width / 2}
                  y={node.y + 40}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                >
                  {node.file}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-white/5 bg-[#1a1f35] px-5 py-3">
          {layerLegend.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-400">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedNodeData && (
        <div className="w-80 shrink-0 self-start rounded-xl border border-white/5 bg-[#1a1f35] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: selectedNodeData.color }}
              />
              <span className="text-xs text-gray-400">{selectedNodeData.layer}</span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-500 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>

          <h3 className="mb-1 text-xl font-bold text-white">{selectedNodeData.name}</h3>
          <p className="mb-4 font-mono text-xs text-gray-500">{selectedNodeData.file}</p>
          <p className="mb-5 text-sm leading-relaxed text-gray-300">{selectedNodeData.description}</p>

          {selectedConnected.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-400">关联模块</h4>
              <div className="space-y-2">
                {selectedConnected.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: conn.color }}
                    />
                    <span className="text-sm text-gray-300">{conn.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{conn.layer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
