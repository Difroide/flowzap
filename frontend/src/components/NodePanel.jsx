import { useState, useEffect } from 'react'
import ActionEditor from './ActionEditor.jsx'

const ACTION_LABELS = {
  send_message:          '💬 Mensagem de texto',
  send_multi_media:      '🎵 Áudio / Mídia',
  send_file:             '📎 Arquivo',
  wait_for_response:     '⏱ Aguardar Resposta',
  save_user_data:        '💾 Salvar Campo',
  evaluate_condition:    '❓ Condição',
  add_tags:              '🏷 Tags',
  smart_interval:        '⏳ Intervalo',
  send_notification:     '🔔 Notificação',
  register_approved_sale:'💰 Venda Aprovada',
}
const ACTION_TYPES = Object.keys(ACTION_LABELS)

export default function NodePanel({ node, onSave, onDelete }) {
  const [name, setName]       = useState(node.data.name || '')
  const [actions, setActions] = useState(node.data.actions || [])
  const [adding, setAdding]   = useState(false)
  const [dirty, setDirty]     = useState(false)

  useEffect(() => {
    setName(node.data.name || '')
    setActions(node.data.actions || [])
    setDirty(false)
  }, [node.id])

  const mark = fn => (...a) => { fn(...a); setDirty(true) }

  const changeName = mark(v => setName(v))
  const changeAction = mark((i, u) => setActions(p => p.map((a, idx) => idx === i ? u : a)))
  const removeAction = mark(i => setActions(p => p.filter((_, idx) => idx !== i)))
  const addAction    = mark(type => {
    setActions(p => [...p, { id: `tmp_${Date.now()}`, action_type: type, config: {}, sort_order: p.length }])
    setAdding(false)
  })

  function save() { onSave(node.id, { name, actions }); setDirty(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel top bar */}
      <div className="panel-topbar">
        <div>
          <div className="panel-topbar-title">Nó selecionado</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{node.type}</div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(node.id)}>Apagar</button>
      </div>

      {/* Scrollable body */}
      <div className="panel-body">
        <div className="form-group">
          <label>Nome do nó</label>
          <input value={name} onChange={e => changeName(e.target.value)} />
        </div>

        <hr className="divider" />
        <div className="panel-header">Ações</div>

        {actions.map((action, i) => (
          <div key={action.id || i} style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 10px 10px',
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                {ACTION_LABELS[action.action_type] || action.action_type}
              </span>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px', fontSize: 11, lineHeight: 1 }}
                onClick={() => removeAction(i)}>×</button>
            </div>
            <ActionEditor action={action} onChange={u => changeAction(i, u)} />
          </div>
        ))}

        {adding ? (
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>Escolha o tipo de ação:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ACTION_TYPES.map(type => (
                <button key={type} className="btn btn-ghost btn-sm" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => addAction(type)}>
                  {ACTION_LABELS[type]}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }} onClick={() => setAdding(true)}>
            + Adicionar ação
          </button>
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* Footer save */}
      <div className="panel-footer">
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={save} disabled={!dirty}>
          {dirty ? '💾 Salvar nó' : '✓ Salvo'}
        </button>
      </div>
    </div>
  )
}
