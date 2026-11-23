export default function ChatBubble({ direction, body, media_url, media_type, created_at }) {
  const isOut = direction === 'out'

  const time = created_at
    ? new Date(created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''

  function renderContent() {
    if (media_type === 'audio' && media_url) {
      return <audio controls src={media_url} style={{ maxWidth: '100%', height: 36 }} />
    }
    if (media_type === 'image' && media_url) {
      return (
        <a href={media_url} target="_blank" rel="noreferrer">
          <img src={media_url} alt="imagem" style={{ maxWidth: 220, borderRadius: 8, display: 'block' }} />
        </a>
      )
    }
    return <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: 13 }}>{body || '—'}</span>
  }

  return (
    <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
      <div style={{
        maxWidth: '72%',
        background: isOut
          ? 'linear-gradient(135deg, #5b55e8 0%, #4a45c8 100%)'
          : 'rgba(255,255,255,0.04)',
        border: isOut
          ? '1px solid rgba(108,99,255,0.3)'
          : '1px solid #1e2234',
        borderRadius: isOut ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
        padding: '8px 12px 6px',
        boxShadow: isOut ? '0 2px 8px rgba(108,99,255,0.2)' : 'none',
      }}>
        {renderContent()}
        <div style={{ fontSize: 10, color: isOut ? 'rgba(255,255,255,0.45)' : '#3d4660', marginTop: 4, textAlign: 'right' }}>
          {time}
        </div>
      </div>
    </div>
  )
}
