import { Handle, Position } from 'reactflow'

const CFG = {
  start:          { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  icon: '▶',  label: 'Início' },
  message:        { color: '#6c63ff', bg: 'rgba(108,99,255,0.1)', border: 'rgba(108,99,255,0.2)', icon: '💬', label: 'Mensagem' },
  wait_response:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icon: '⏱',  label: 'Aguardar Resp.' },
  condition:      { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)',  icon: '❓', label: 'Condição' },
  tags:           { color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.2)',  icon: '🏷',  label: 'Tags' },
  smart_interval: { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.2)',   icon: '⏳', label: 'Intervalo' },
  notification:   { color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.2)',  icon: '🔔', label: 'Notificação' },
  approved_sale:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  icon: '💰', label: 'Venda Aprovada' },
}

function summary(actions) {
  if (!actions?.length) return null
  const a = actions[0]
  if (a.action_type === 'send_message')   return (a.config?.message_text || '').substring(0, 48) || null
  if (a.action_type === 'wait_for_response') return `Aguardar ${a.config?.timeout_value || '?'}${(a.config?.timeout_unit || 'h')[0]}`
  if (a.action_type === 'evaluate_condition') return 'Avaliar condição'
  if (a.action_type === 'add_tags')       return `${a.config?.action || 'add'} tags`
  if (a.action_type === 'smart_interval') return `Intervalo ${a.config?.interval_value || '?'}${(a.config?.interval_unit || 'd')[0]}`
  if (a.action_type === 'send_notification')   return `Notif. ${a.config?.name || ''}`
  if (a.action_type === 'register_approved_sale') return a.config?.amount_template || 'Registrar venda'
  if (a.action_type === 'send_multi_media') return 'Áudio'
  if (a.action_type === 'send_file')      return a.config?.file_name || 'Arquivo'
  return null
}

const H = { width: 11, height: 11, border: '2px solid #0b0e16' }

export default function FlowNode({ data, selected }) {
  const c = CFG[data.node_type] || CFG.message
  const isStart = data.node_type === 'start'
  const isWait  = data.node_type === 'wait_response'
  const isCond  = data.node_type === 'condition'
  const sum = summary(data.actions)

  return (
    <div style={{
      width: 198,
      background: 'linear-gradient(155deg, #181c2b 0%, #131720 100%)',
      borderRadius: 10,
      border: selected ? `1.5px solid ${c.color}` : '1.5px solid #242838',
      boxShadow: selected
        ? `0 0 0 3px ${c.color}22, 0 6px 24px rgba(0,0,0,0.6)`
        : '0 2px 12px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)',
      overflow: 'visible',
      position: 'relative',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      {/* Top shimmer */}
      <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', borderRadius: 99 }} />

      {/* Type strip */}
      <div style={{
        background: c.bg,
        borderBottom: `1px solid ${c.border}`,
        borderRadius: '8px 8px 0 0',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 11, lineHeight: 1 }}>{c.icon}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.09em', flex: 1 }}>
          {c.label}
        </span>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}`, opacity: 0.9 }} />
      </div>

      {/* Body */}
      <div style={{ padding: '9px 11px 11px' }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: '#dde1f0', marginBottom: sum ? 4 : 0, letterSpacing: '-0.01em' }}>
          {data.name || 'Nó'}
        </div>
        {sum && (
          <div style={{ fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
            {sum}
          </div>
        )}
        {data.actions?.length > 1 && (
          <div style={{ fontSize: 10, color: '#3d4660', marginTop: 3 }}>+{data.actions.length - 1} ação(ões)</div>
        )}
      </div>

      {/* Handle labels */}
      {isWait && <>
        <div style={{ position: 'absolute', right: -48, top: '36%', fontSize: 9.5, color: '#22c55e', pointerEvents: 'none', userSelect: 'none' }}>resp.</div>
        <div style={{ position: 'absolute', right: -56, top: '62%', fontSize: 9.5, color: '#ef4444', pointerEvents: 'none', userSelect: 'none' }}>timeout</div>
      </>}
      {isCond && <>
        <div style={{ position: 'absolute', right: -36, top: '36%', fontSize: 9.5, color: '#22c55e', pointerEvents: 'none', userSelect: 'none' }}>sim ✓</div>
        <div style={{ position: 'absolute', right: -36, top: '62%', fontSize: 9.5, color: '#ef4444', pointerEvents: 'none', userSelect: 'none' }}>não ✗</div>
      </>}

      {/* Input handle */}
      {!isStart && (
        <Handle type="target" id="input" position={Position.Left}
          style={{ ...H, background: '#2e3348', left: -6 }} />
      )}

      {/* Output handle(s) */}
      {isWait ? <>
        <Handle type="source" id="client-response" position={Position.Right}
          style={{ ...H, top: '38%', background: '#22c55e', right: -6 }} />
        <Handle type="source" id="timeout" position={Position.Right}
          style={{ ...H, top: '64%', background: '#ef4444', right: -6 }} />
      </> : isCond ? <>
        <Handle type="source" id="success" position={Position.Right}
          style={{ ...H, top: '38%', background: '#22c55e', right: -6 }} />
        <Handle type="source" id="failure" position={Position.Right}
          style={{ ...H, top: '64%', background: '#ef4444', right: -6 }} />
      </> : (
        <Handle type="source" id="output" position={Position.Right}
          style={{ ...H, background: '#6c63ff', right: -6 }} />
      )}
    </div>
  )
}
