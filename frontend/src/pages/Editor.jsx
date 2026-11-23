import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getFullFlow, saveGraph, getInstances, updateFlow } from '../api.js'
import FlowNode from '../components/FlowNode.jsx'
import NodePanel from '../components/NodePanel.jsx'

const NODE_TYPES = {
  start: FlowNode, message: FlowNode, wait_response: FlowNode, condition: FlowNode,
  tags: FlowNode, smart_interval: FlowNode, notification: FlowNode, approved_sale: FlowNode,
}

const PALETTE = [
  { type: 'message',        label: '💬 Mensagem',       color: '#6c63ff' },
  { type: 'wait_response',  label: '⏱ Aguardar Resp.',  color: '#3b82f6' },
  { type: 'condition',      label: '❓ Condição',        color: '#f97316' },
  { type: 'tags',           label: '🏷 Tags',            color: '#14b8a6' },
  { type: 'smart_interval', label: '⏳ Intervalo',       color: '#eab308' },
  { type: 'notification',   label: '🔔 Notificação',     color: '#ec4899' },
  { type: 'approved_sale',  label: '💰 Venda Aprovada',  color: '#f59e0b' },
]

function edgeColor(h) {
  if (h === 'client-response' || h === 'success') return '#22c55e'
  if (h === 'timeout' || h === 'failure')         return '#ef4444'
  return '#3d4660'
}

function ccToHandle(cc) {
  if (!cc) return 'output'
  if (cc.source_handle) return cc.source_handle
  if (cc.condition_result === 'success') return 'success'
  if (cc.condition_result === 'failure') return 'failure'
  return 'output'
}

function handleToCC(handle, nodeType) {
  if (nodeType === 'wait_response') {
    if (handle === 'client-response') return { type: 'always', source_handle: 'client-response' }
    if (handle === 'timeout')         return { type: 'always', source_handle: 'timeout' }
  }
  if (nodeType === 'condition') {
    if (handle === 'success') return { type: 'always', condition_result: 'success' }
    if (handle === 'failure') return { type: 'always', condition_result: 'failure' }
  }
  return { type: 'always' }
}

function toRF(nodes, connections) {
  const rfNodes = nodes.map(n => ({
    id: String(n.id),
    type: n.node_type,
    position: { x: n.position_x, y: n.position_y },
    data: { node_type: n.node_type, name: n.name, actions: n.actions || [] },
  }))
  const rfEdges = connections.map(c => {
    const h = ccToHandle(c.condition_config)
    const col = edgeColor(h)
    return {
      id: `c${c.id}`,
      source: String(c.from_node_id),
      target: String(c.to_node_id),
      sourceHandle: h !== 'output' ? h : undefined,
      type: 'buttonEdge',
      style: { stroke: col, strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: col },
      data: { cc: c.condition_config },
    }
  })
  return { rfNodes, rfEdges }
}

function fromRF(rfNodes, rfEdges) {
  const map = Object.fromEntries(rfNodes.map(n => [n.id, n]))
  const nodes = rfNodes.map(n => ({
    id: n.id,
    node_type: n.type || n.data.node_type,
    name: n.data.name,
    position_x: n.position.x,
    position_y: n.position.y,
    actions: (n.data.actions || []).map((a, i) => ({ id: a.id, action_type: a.action_type, config: a.config || {}, sort_order: i })),
  }))
  const connections = rfEdges.map(e => {
    const src = map[e.source]
    const srcType = src?.type || src?.data?.node_type
    const h = e.sourceHandle || 'output'
    return { from_node_id: e.source, to_node_id: e.target, condition_config: handleToCC(h, srcType) }
  })
  return { nodes, connections }
}

function ButtonEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) {
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`, pointerEvents: 'all', zIndex: 10 }}>
          <button onClick={() => data?.onDelete(id)} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#131720', border: '1px solid #242838',
            color: '#4a5568', cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#131720'; e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.borderColor = '#242838' }}
          >×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const EDGE_TYPES = { buttonEdge: ButtonEdge }

function ConfigPanel({ config, onChange, instances, flow, onSave, saving, onToggle }) {
  const kw = (config.trigger_keywords || []).join(', ')
  return (
    <div className="panel-body">
      <div className="panel-header">Configuração do Fluxo</div>

      <div className="form-group">
        <label>Nome</label>
        <input value={config.name} onChange={e => onChange(c => ({ ...c, name: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>Instância WhatsApp</label>
        <select value={config.instance_name} onChange={e => onChange(c => ({ ...c, instance_name: e.target.value }))}>
          <option value="">— Nenhuma —</option>
          {instances.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Gatilho</label>
        <select value={config.trigger_type} onChange={e => onChange(c => ({ ...c, trigger_type: e.target.value }))}>
          <option value="all">Qualquer mensagem</option>
          <option value="keyword">Palavra-chave</option>
        </select>
      </div>
      {config.trigger_type === 'keyword' && (
        <div className="form-group">
          <label>Keywords (separadas por vírgula)</label>
          <input
            value={kw}
            onChange={e => onChange(c => ({ ...c, trigger_keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) }))}
            placeholder="oi, olá, start"
          />
        </div>
      )}

      <button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={onSave} disabled={saving}>
        {saving ? 'Salvando...' : '💾 Salvar configuração'}
      </button>

      {flow && (
        <button
          className={`btn btn-ghost`}
          style={{ width: '100%', marginTop: 8 }}
          onClick={onToggle}
        >
          {flow.status === 'active' ? '⏸ Arquivar fluxo' : '▶ Ativar fluxo'}
        </button>
      )}

      {flow && (
        <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 2 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Status: </span>
            <span className={`badge badge-${flow.status === 'active' ? 'green' : 'gray'}`} style={{ verticalAlign: 'middle' }}>{flow.status}</span>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>ID do fluxo: <span style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>#{flow.id}</span></div>
        </div>
      )}
    </div>
  )
}

function EditorInner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()

  const [flow, setFlow]         = useState(null)
  const [instances, setInstances] = useState([])
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selNodeId, setSelNodeId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [config, setConfig]     = useState({ name: '', instance_name: '', trigger_type: 'all', trigger_keywords: [] })

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  const deleteEdge = useCallback(eid => setEdges(p => p.filter(e => e.id !== eid)), [setEdges])

  const edgesWithDel = useMemo(
    () => edges.map(e => ({ ...e, data: { ...(e.data || {}), onDelete: deleteEdge } })),
    [edges, deleteEdge]
  )

  async function load() {
    try {
      const { flow: f, nodes: ns, connections: cs } = await getFullFlow(id)
      setFlow(f)
      setConfig({ name: f.name, instance_name: f.instance_name || '', trigger_type: f.trigger_type || 'all', trigger_keywords: f.trigger_keywords || [] })
      const { rfNodes, rfEdges } = toRF(ns, cs)
      setNodes(rfNodes)
      setEdges(rfEdges)
    } catch (e) { alert('Erro ao carregar: ' + e.message) }
  }

  useEffect(() => {
    load()
    getInstances().then(setInstances).catch(() => {})
  }, [id])

  useEffect(() => {
    const fn = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        doSave(nodesRef.current, edgesRef.current)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  async function doSave(ns, es) {
    setSaving(true)
    try { const d = fromRF(ns, es); await saveGraph(id, d) }
    catch (e) { alert('Erro ao salvar: ' + e.message) }
    setSaving(false)
  }

  async function handleSaveCfg() {
    setSavingCfg(true)
    try { await updateFlow(id, { name: config.name, instance_name: config.instance_name, trigger_type: config.trigger_type, trigger_keywords: config.trigger_keywords }) }
    catch (e) { alert(e.message) }
    setSavingCfg(false)
  }

  async function handleToggle() {
    if (!flow) return
    const s = flow.status === 'active' ? 'archived' : 'active'
    try { await updateFlow(id, { status: s }); await load() }
    catch (e) { alert(e.message) }
  }

  const srcRef = useRef(nodes)
  useEffect(() => { srcRef.current = nodes }, [nodes])

  const onConnect = useCallback(params => {
    const src = srcRef.current.find(n => n.id === params.source)
    const srcType = src?.type || src?.data?.node_type
    const h = params.sourceHandle || 'output'
    const col = edgeColor(h)
    setEdges(p => addEdge({ ...params, type: 'buttonEdge', style: { stroke: col, strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: col }, data: {} }, p))
  }, [setEdges])

  const onDragOver = useCallback(e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])

  const onDrop = useCallback(e => {
    e.preventDefault()
    const nt = e.dataTransfer.getData('application/reactflow')
    if (!nt) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setNodes(p => [...p, { id: `tmp_${Date.now()}`, type: nt, position: pos, data: { node_type: nt, name: nt, actions: [] } }])
  }, [screenToFlowPosition, setNodes])

  const onNodeClick = useCallback((_, n) => setSelNodeId(n.id), [])
  const onPaneClick = useCallback(() => setSelNodeId(null), [])

  function nodeSave(nid, { name, actions }) {
    setNodes(p => p.map(n => n.id === nid ? { ...n, data: { ...n.data, name, actions } } : n))
  }
  function nodeDelete(nid) {
    if (!confirm('Apagar este nó e suas conexões?')) return
    setNodes(p => p.filter(n => n.id !== nid))
    setEdges(p => p.filter(e => e.source !== nid && e.target !== nid))
    setSelNodeId(null)
  }

  const selNode = nodes.find(n => n.id === selNodeId)

  return (
    <div className="editor-shell">
      {/* Top bar */}
      <div className="editor-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/flows')}>← Voltar</button>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <span className="editor-title">{flow?.name || 'Carregando...'}</span>
        {flow && <span className={`badge badge-${flow.status === 'active' ? 'green' : 'gray'}`} style={{ fontSize: 10 }}>{flow.status}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+S</span>
        <button className="btn btn-primary btn-sm" onClick={() => doSave(nodes, edges)} disabled={saving}>
          {saving ? 'Salvando...' : '💾 Salvar grafo'}
        </button>
      </div>

      <div className="editor-body">
        {/* Palette */}
        <div className="editor-palette">
          <div className="panel-header">Arrastar p/ canvas</div>
          {PALETTE.map(item => (
            <div
              key={item.type}
              className="palette-item"
              draggable
              onDragStart={e => { e.dataTransfer.setData('application/reactflow', item.type); e.dataTransfer.effectAllowed = 'move' }}
              style={{ borderLeftColor: item.color + '55', borderLeftWidth: 2 }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edgesWithDel}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: 'var(--bg)' }}
          >
            <Background variant="dots" gap={20} size={1} color="#1e2234" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <div className="editor-panel">
          {selNode ? (
            <NodePanel node={selNode} onSave={nodeSave} onDelete={nodeDelete} />
          ) : (
            <>
              <div className="panel-topbar">
                <div className="panel-topbar-title">Configurações</div>
              </div>
              <ConfigPanel
                config={config}
                onChange={setConfig}
                instances={instances}
                flow={flow}
                onSave={handleSaveCfg}
                saving={savingCfg}
                onToggle={handleToggle}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  )
}
