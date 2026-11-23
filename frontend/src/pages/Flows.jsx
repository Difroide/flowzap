import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFlows, createFlow, updateFlow, deleteFlow, duplicateFlow } from '../api.js'

function StatusBadge({ status }) {
  if (status === 'active')   return <span className="badge badge-green">active</span>
  if (status === 'draft')    return <span className="badge badge-gray">draft</span>
  return <span className="badge badge-gray" style={{ opacity: 0.5 }}>archived</span>
}

export default function Flows() {
  const [flows, setFlows] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const navigate = useNavigate()

  async function load() {
    try { setFlows(await getFlows() || []) } catch {}
  }
  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    try { await createFlow(form); setModal(false); setForm({ name: '', description: '' }); await load() }
    catch (e) { alert(e.message) }
  }

  async function handleToggle(flow) {
    const s = flow.status === 'active' ? 'archived' : 'active'
    try { await updateFlow(flow.id, { status: s }); await load() }
    catch (e) { alert(e.message) }
  }

  async function handleDuplicate(flow) {
    try { await duplicateFlow(flow.id); await load() }
    catch (e) { alert(e.message) }
  }

  async function handleDelete(flow) {
    if (!confirm(`Apagar "${flow.name}"?`)) return
    try { await deleteFlow(flow.id); await load() }
    catch (e) { alert(e.message) }
  }

  const active = flows.filter(f => f.status === 'active').length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxos</h1>
          <p className="page-sub">{flows.length} fluxo{flows.length !== 1 ? 's' : ''} · {active} ativo{active !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Novo fluxo</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th>Instância</th>
              <th>Gatilho</th>
              <th>Nós</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {flows.map(flow => (
              <tr key={flow.id}>
                <td className="td-main">
                  <div>{flow.name}</div>
                  {flow.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{flow.description}</div>}
                </td>
                <td><StatusBadge status={flow.status} /></td>
                <td>{flow.instance_name
                  ? <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px' }}>{flow.instance_name}</span>
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>
                }</td>
                <td style={{ fontSize: 12 }}>
                  {flow.trigger_type === 'keyword'
                    ? <span style={{ color: 'var(--text-2)' }}>🔑 Keyword</span>
                    : <span style={{ color: 'var(--text-muted)' }}>Qualquer</span>
                  }
                </td>
                <td>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px' }}>
                    {flow.node_count ?? 0}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/flows/${flow.id}/editor`)}>Editar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(flow)}>
                      {flow.status === 'active' ? 'Arquivar' : 'Ativar'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(flow)}>Duplicar</button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 9px' }} onClick={() => handleDelete(flow)}>×</button>
                  </div>
                </td>
              </tr>
            ))}
            {flows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '52px 16px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                  <div style={{ fontWeight: 500, marginBottom: 5 }}>Nenhum fluxo criado</div>
                  <div style={{ fontSize: 12 }}>Clique em "Novo fluxo" para começar</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Criar novo fluxo</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nome do fluxo</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Funil de vendas"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Descrição <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Objetivo ou contexto desse fluxo"
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar fluxo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
