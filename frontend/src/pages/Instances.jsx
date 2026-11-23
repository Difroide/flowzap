import { useState, useEffect, useCallback } from 'react'
import { getInstances, createInstance, getQr, deleteInstance } from '../api.js'

const STATUS_COLOR = {
  connected:    '#22c55e',
  connecting:   '#f59e0b',
  disconnected: '#ef4444',
}
const STATUS_BADGE = {
  connected:    'badge-green',
  connecting:   'badge-yellow',
  disconnected: 'badge-red',
}

export default function Instances() {
  const [instances, setInstances] = useState([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [qrModal, setQrModal] = useState(null)

  const load = useCallback(async () => {
    try { setInstances(await getInstances() || []) } catch {}
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  // QR polling
  useEffect(() => {
    if (!qrModal) return
    const name = qrModal.name
    const t = setInterval(async () => {
      const cur = instances.find(i => i.name === name)
      if (cur?.status === 'connected') { setQrModal(null); return }
      try {
        const d = await getQr(name)
        if (d?.qrcode?.base64) setQrModal(p => p ? { ...p, qr: d.qrcode.base64 } : null)
      } catch {}
    }, 3000)
    return () => clearInterval(t)
  }, [qrModal, instances])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try { await createInstance(newName.trim()); setNewName(''); await load() }
    catch (e) { alert(e.message) }
    setCreating(false)
  }

  async function handleShowQr(inst) {
    try {
      const d = await getQr(inst.name)
      setQrModal({ name: inst.name, qr: d?.qrcode?.base64 || null })
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(inst) {
    if (!confirm(`Desconectar e apagar "${inst.name}"?`)) return
    try { await deleteInstance(inst.name); await load() }
    catch (e) { alert(e.message) }
  }

  const connected = instances.filter(i => i.status === 'connected').length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Instâncias</h1>
          <p className="page-sub">
            {instances.length} instância{instances.length !== 1 ? 's' : ''} · {connected} conectada{connected !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* New instance form */}
      <div style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.06) 0%, rgba(108,99,255,0.02) 100%)', border: '1px solid rgba(108,99,255,0.14)', borderRadius: 11, padding: '16px 20px', marginBottom: 24 }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 480 }}>
          <div style={{ flex: 1 }}>
            <label>Nome da nova instância</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="ex: whatsapp-vendas"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating} style={{ flexShrink: 0 }}>
            {creating ? 'Criando...' : '+ Nova instância'}
          </button>
        </form>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 14 }}>
        {instances.map(inst => {
          const color = STATUS_COLOR[inst.status] || '#64748b'
          const isOff = inst.status === 'disconnected'
          return (
            <div key={inst.name} className={'instance-card' + (isOff ? ' pulse-border' : '')}>
              {/* Status bar */}
              <div className="instance-card-bar" style={{ background: color, opacity: inst.status === 'connected' ? 1 : 0.6 }} />
              <div className="instance-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div className="instance-card-name">{inst.name}</div>
                    {inst.phone
                      ? <div className="instance-card-phone">{inst.phone}</div>
                      : <div className="instance-card-phone" style={{ opacity: 0.4 }}>Sem número</div>
                    }
                  </div>
                  <span className={`badge ${STATUS_BADGE[inst.status] || 'badge-gray'}`}>
                    {inst.status}
                  </span>
                </div>
                <div className="instance-card-actions">
                  {inst.status !== 'connected' && (
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => handleShowQr(inst)}>
                      📷 Ver QR
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: 12 }} onClick={() => handleDelete(inst)}>
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {instances.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', borderRadius: 11 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🖥</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Nenhuma instância</div>
            <div style={{ fontSize: 12 }}>Crie uma instância acima para conectar seu WhatsApp</div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', minWidth: 320 }}>
            <h2>Conectar — {qrModal.name}</h2>
            <div style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'inline-block', margin: '0 auto' }}>
              {qrModal.qr
                ? <img src={qrModal.qr.startsWith('data:') ? qrModal.qr : `data:image/png;base64,${qrModal.qr}`} alt="QR" style={{ width: 220, height: 220, display: 'block' }} />
                : <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>Carregando...</div>
              }
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
              Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Atualiza automaticamente a cada 3s</p>
            <button className="btn btn-ghost" onClick={() => setQrModal(null)} style={{ marginTop: 16, width: '100%' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
