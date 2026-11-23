import { useState, useEffect } from 'react'
import { getContacts, resetContact, getContactMessages } from '../api.js'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [msgModal, setMsgModal] = useState(null)

  async function load() {
    try { setContacts(await getContacts() || []) } catch {}
  }
  useEffect(() => { load() }, [])

  async function handleMessages(c) {
    try {
      const messages = await getContactMessages(c.id)
      setMsgModal({ contact: c, messages: messages || [] })
    } catch (e) { alert(e.message) }
  }

  async function handleReset(c) {
    if (!confirm(`Resetar fluxo de ${c.name || c.phone}?`)) return
    try { await resetContact(c.id); await load() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contatos</h1>
          <p className="page-sub">{contacts.length} contato{contacts.length !== 1 ? 's' : ''} cadastrado{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>↺ Atualizar</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Instância</th>
              <th>Tags</th>
              <th>Fluxo atual</th>
              <th>Status</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td className="td-main">
                  <div>{c.name || <span style={{ color: 'var(--text-muted)' }}>Sem nome</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{c.phone}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  {c.instance_name
                    ? <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px' }}>{c.instance_name}</span>
                    : '—'
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(c.tags || []).map(tag => (
                      <span key={tag} className="badge badge-gray" style={{ fontSize: 10, padding: '2px 7px' }}>{tag}</span>
                    ))}
                    {(!c.tags || c.tags.length === 0) && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.flow_name || '—'}</td>
                <td>
                  {c.flow_status
                    ? <span className={`badge badge-${c.flow_status === 'running' ? 'green' : 'gray'}`}>{c.flow_status}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                  }
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleMessages(c)}>💬 Mensagens</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReset(c)}>Reset</button>
                  </div>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '52px 16px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
                  <div style={{ fontWeight: 500, marginBottom: 5 }}>Nenhum contato ainda</div>
                  <div style={{ fontSize: 12 }}>Os contatos aparecem quando alguém interagir com um fluxo ativo</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {msgModal && (
        <div className="modal-overlay" onClick={() => setMsgModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                👤
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{msgModal.contact.name || msgModal.contact.phone}</div>
                {msgModal.contact.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{msgModal.contact.phone}</div>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0', minHeight: 0 }}>
              {msgModal.messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
                  <div>Sem mensagens registradas</div>
                </div>
              )}
              {msgModal.messages.map(msg => (
                <div key={msg.id} className={msg.direction === 'out' ? 'msg-out' : 'msg-in'}>
                  {msg.action_type && <div className="msg-meta">{msg.action_type}</div>}
                  <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                  <div className="msg-meta" style={{ marginTop: 4 }}>
                    {new Date(msg.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-ghost" onClick={() => setMsgModal(null)} style={{ marginTop: 16 }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
