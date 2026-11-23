import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import ChatBubble from '../components/ChatBubble.jsx'
import { getChats, getChatMessages, sendChatMessage, markChatRead } from '../api.js'

const socket = io({ autoConnect: true })

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000)   return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function LiveChats() {
  const [chats, setChats]           = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages]     = useState([])
  const [text, setText]             = useState('')
  const [sending, setSending]       = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch]         = useState('')
  const feedRef                     = useRef(null)
  const inputRef                    = useRef(null)

  // load chat list
  const loadChats = useCallback(async () => {
    try {
      const list = await getChats()
      setChats(list || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadChats()
    const t = setInterval(loadChats, 15000)
    return () => clearInterval(t)
  }, [loadChats])

  // load messages when activeChat changes
  useEffect(() => {
    if (!activeChat) return
    setLoadingMsgs(true)
    setMessages([])
    getChatMessages(activeChat.phone, activeChat.instance_name)
      .then(msgs => setMessages(msgs || []))
      .catch(console.error)
      .finally(() => setLoadingMsgs(false))

    markChatRead(activeChat.phone, activeChat.instance_name).catch(() => {})

    // mark unread=0 in list
    setChats(prev => prev.map(c =>
      c.phone === activeChat.phone && c.instance_name === activeChat.instance_name
        ? { ...c, unread: 0 } : c
    ))
  }, [activeChat])

  // socket: join room + receive new messages
  useEffect(() => {
    if (!activeChat) return
    const room = `${activeChat.phone}:${activeChat.instance_name}`
    socket.emit('join', room)

    function onMsg(msg) {
      setMessages(prev => [...prev, msg])
      setChats(prev => prev.map(c =>
        c.phone === msg.phone && c.instance_name === msg.instance_name
          ? { ...c, last_body: msg.body, last_at: msg.created_at }
          : c
      ))
      markChatRead(activeChat.phone, activeChat.instance_name).catch(() => {})
    }

    socket.on('new_message', onMsg)
    return () => socket.off('new_message', onMsg)
  }, [activeChat])

  // scroll feed to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend() {
    if (!text.trim() || !activeChat || sending) return
    setSending(true)
    const body = text.trim()
    setText('')
    try {
      const sent = await sendChatMessage(activeChat.phone, activeChat.instance_name, body)
      if (sent) {
        setMessages(prev => [...prev, sent])
        setChats(prev => prev.map(c =>
          c.phone === activeChat.phone && c.instance_name === activeChat.instance_name
            ? { ...c, last_body: body, last_at: new Date().toISOString() }
            : c
        ))
      }
    } catch (e) { console.error(e) }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const filtered = chats.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.contact_name || c.phone).toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>

      {/* Left: conversation list */}
      <div style={{ width: 300, minWidth: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* search */}
        <div style={{ padding: '12px 12px 10px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid #242838', borderRadius: 8, fontSize: 12 }}
          />
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
              {chats.length === 0 ? 'Nenhuma conversa ainda' : 'Sem resultados'}
            </div>
          )}
          {filtered.map(c => {
            const isActive = activeChat?.phone === c.phone && activeChat?.instance_name === c.instance_name
            const name = c.contact_name || c.phone
            return (
              <div
                key={`${c.phone}:${c.instance_name}`}
                onClick={() => setActiveChat(c)}
                style={{
                  padding: '11px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(36,40,56,0.6)',
                  background: isActive ? 'rgba(108,99,255,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6c63ff 0%, #4a45c8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff',
                  }}>
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#c8d0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                        {name}
                      </span>
                      <span style={{ fontSize: 10, color: '#3d4660', flexShrink: 0, marginLeft: 6 }}>
                        {timeAgo(c.last_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#3d4660', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                        {c.last_body || '—'}
                      </span>
                      {c.unread > 0 && (
                        <span style={{
                          background: 'var(--accent)', color: '#fff',
                          borderRadius: 99, fontSize: 9, fontWeight: 700,
                          padding: '1px 6px', flexShrink: 0, marginLeft: 4,
                          boxShadow: '0 0 6px rgba(108,99,255,0.5)',
                        }}>
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#2a2d3a', marginTop: 2 }}>{c.instance_name}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: chat window */}
      {!activeChat ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: 13, opacity: 0.5 }}>Selecione uma conversa</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* chat topbar */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff 0%, #4a45c8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {(activeChat.contact_name || activeChat.phone).charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#c8d0e0' }}>
                {activeChat.contact_name || activeChat.phone}
              </div>
              <div style={{ fontSize: 11, color: '#3d4660' }}>
                {activeChat.phone} · {activeChat.instance_name}
              </div>
            </div>
          </div>

          {/* messages feed */}
          <div
            ref={feedRef}
            style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {loadingMsgs && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Carregando...</div>
            )}
            {!loadingMsgs && messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Sem mensagens</div>
            )}
            {messages.map((msg, i) => (
              <ChatBubble
                key={msg.id || i}
                direction={msg.direction}
                body={msg.body}
                media_url={msg.media_url}
                media_type={msg.media_type}
                created_at={msg.created_at}
              />
            ))}
          </div>

          {/* input bar */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Digite uma mensagem… (Enter para enviar)"
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '9px 12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid #242838',
                borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                maxHeight: 120, overflowY: 'auto',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              style={{ flexShrink: 0, height: 38, paddingLeft: 18, paddingRight: 18 }}
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
