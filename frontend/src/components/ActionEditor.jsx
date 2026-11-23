import { useState } from 'react'
import { uploadMedia } from '../api.js'

export default function ActionEditor({ action, onChange }) {
  const { action_type, config } = action
  const set = (key, val) => onChange({ ...action, config: { ...config, [key]: val } })

  if (action_type === 'send_message') {
    return (
      <div>
        <label>Mensagem</label>
        <textarea
          value={config.message_text || ''}
          onChange={e => set('message_text', e.target.value)}
          rows={4}
          placeholder="Use {full_name}, {phone_number}, {SEU_CAMPO}"
        />
      </div>
    )
  }

  if (action_type === 'send_multi_media') {
    return (
      <div>
        <label>URL do áudio</label>
        <input
          value={config.media_file_info?.url || ''}
          onChange={e => onChange({ ...action, config: { ...config, media_type: 'audio', media_file_info: { ...(config.media_file_info || {}), url: e.target.value } } })}
          placeholder="https://..."
          style={{ marginBottom: 8 }}
        />
        <MediaUpload onUpload={info => onChange({ ...action, config: { ...config, media_type: 'audio', media_file_info: info } })} />
      </div>
    )
  }

  if (action_type === 'send_file') {
    return (
      <div>
        <div className="form-group">
          <label>Nome do arquivo</label>
          <input value={config.file_name || ''} onChange={e => set('file_name', e.target.value)} placeholder="ex: contrato.pdf" />
        </div>
        <MediaUpload onUpload={info => onChange({ ...action, config: { ...config, media_file_info: info } })} />
      </div>
    )
  }

  if (action_type === 'wait_for_response') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>Valor</label>
          <input type="number" min={1} value={config.timeout_value || ''} onChange={e => set('timeout_value', Number(e.target.value))} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Unidade</label>
          <select value={config.timeout_unit || 'hours'} onChange={e => set('timeout_unit', e.target.value)}>
            <option value="minutes">Minutos</option>
            <option value="hours">Horas</option>
            <option value="days">Dias</option>
          </select>
        </div>
      </div>
    )
  }

  if (action_type === 'save_user_data') {
    return (
      <div>
        <label>Campo para salvar</label>
        <input value={config.field_name || ''} onChange={e => set('field_name', e.target.value)} placeholder="ex: nome_pet" />
      </div>
    )
  }

  if (action_type === 'evaluate_condition') {
    const conditions = config.conditions || []
    const setCondition = (i, key, val) =>
      set('conditions', conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c))
    return (
      <div>
        <div className="form-group">
          <label>Regra</label>
          <select value={config.ruleType || 'any'} onChange={e => set('ruleType', e.target.value)}>
            <option value="any">Qualquer uma (OR)</option>
            <option value="all">Todas (AND)</option>
          </select>
        </div>
        {conditions.map((cond, i) => (
          <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              {i === 0 && <label>Campo</label>}
              <input value={cond.fieldName || ''} onChange={e => setCondition(i, 'fieldName', e.target.value)} placeholder="campo" />
            </div>
            <div style={{ flex: 2 }}>
              {i === 0 && <label>Operador</label>}
              <select value={cond.fieldOperator || 'equal'} onChange={e => setCondition(i, 'fieldOperator', e.target.value)}>
                <option value="equal">igual</option>
                <option value="contains">contém</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              {i === 0 && <label>Valor</label>}
              <input value={cond.fieldValue || ''} onChange={e => setCondition(i, 'fieldValue', e.target.value)} placeholder="valor" />
            </div>
            <button className="btn btn-danger" style={{ padding: '4px 8px', flexShrink: 0 }}
              onClick={() => set('conditions', conditions.filter((_, idx) => idx !== i))}>×</button>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 4 }}
          onClick={() => set('conditions', [...conditions, { category: 'field', fieldName: '', fieldOperator: 'equal', fieldValue: '' }])}>
          + Condição
        </button>
      </div>
    )
  }

  if (action_type === 'add_tags') {
    return (
      <div>
        <div className="form-group">
          <label>Ação</label>
          <select value={config.action || 'add'} onChange={e => set('action', e.target.value)}>
            <option value="add">Adicionar</option>
            <option value="remove">Remover</option>
          </select>
        </div>
        <label>Tags (separadas por vírgula)</label>
        <input
          value={(config.tags || []).join(', ')}
          onChange={e => set('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="tag1, tag2"
        />
      </div>
    )
  }

  if (action_type === 'smart_interval') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>Valor</label>
          <input type="number" min={1} value={config.interval_value || ''} onChange={e => set('interval_value', Number(e.target.value))} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Unidade</label>
          <select value={config.interval_unit || 'days'} onChange={e => set('interval_unit', e.target.value)}>
            <option value="minutes">Minutos</option>
            <option value="hours">Horas</option>
            <option value="days">Dias</option>
          </select>
        </div>
      </div>
    )
  }

  if (action_type === 'send_notification') {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }} className="form-group">
            <label>Nome</label>
            <input value={config.name || ''} onChange={e => set('name', e.target.value)} placeholder="Destinatário" />
          </div>
          <div style={{ flex: 1 }} className="form-group">
            <label>DDI</label>
            <input value={config.country_code || '55'} onChange={e => set('country_code', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Telefone</label>
          <input value={config.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="11999999999" />
        </div>
        <div className="form-group">
          <label>Mensagem</label>
          <textarea value={config.message || ''} onChange={e => set('message', e.target.value)} rows={3} />
        </div>
      </div>
    )
  }

  if (action_type === 'register_approved_sale') {
    return (
      <div>
        <div className="form-group">
          <label>Valor (template)</label>
          <input value={config.amount_template || ''} onChange={e => set('amount_template', e.target.value)} placeholder="{valor_venda}" />
        </div>
        <div className="form-group">
          <label>Moeda</label>
          <input value={config.currency_template || 'BRL'} onChange={e => set('currency_template', e.target.value)} />
        </div>
      </div>
    )
  }

  return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Tipo: {action_type}</div>
}

function MediaUpload({ onUpload }) {
  const [uploading, setUploading] = useState(false)
  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try { onUpload(await uploadMedia(file)) }
    catch (e) { alert(e.message) }
    setUploading(false)
    e.target.value = ''
  }
  return (
    <label style={{ cursor: 'pointer', display: 'inline-block' }}>
      <span className="btn btn-ghost" style={{ display: 'inline-block', pointerEvents: 'none' }}>
        {uploading ? 'Enviando...' : '📎 Upload'}
      </span>
      <input type="file" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
    </label>
  )
}
