import { BrowserRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom'
import Instances from './pages/Instances.jsx'
import Flows from './pages/Flows.jsx'
import Editor from './pages/Editor.jsx'
import Contacts from './pages/Contacts.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LiveChats from './pages/LiveChats.jsx'

/* ── Inline SVG icons ─────────────────────────────────────────── */
function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1.2"/>
      <rect x="9.5" y="1.5" width="5" height="5" rx="1.2"/>
      <rect x="1.5" y="9.5" width="5" height="5" rx="1.2"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/>
    </svg>
  )
}

function IconFlow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3.5" cy="8"   r="2"/>
      <circle cx="13" cy="3.5" r="1.8"/>
      <circle cx="13" cy="12.5" r="1.8"/>
      <line x1="5.4" y1="7.1"  x2="11.3" y2="4.3"/>
      <line x1="5.4" y1="8.9"  x2="11.3" y2="11.7"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="5.5" r="2.5"/>
      <path d="M1.5 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/>
      <path d="M11.5 2.5a2.5 2.5 0 0 1 0 5"/>
      <path d="M14.5 14c0-2.3-1.3-4.3-3-5"/>
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="8.5" width="3" height="6" rx="0.8"/>
      <rect x="6.5" y="5"   width="3" height="9.5" rx="0.8"/>
      <rect x="11.5" y="2" width="3" height="12.5" rx="0.8"/>
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 10.5a1.5 1.5 0 0 1-1.5 1.5H4.5L2 14.5V3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v7Z"/>
      <line x1="5" y1="6"  x2="11" y2="6"/>
      <line x1="5" y1="9"  x2="8.5" y2="9"/>
    </svg>
  )
}

function LogoBolt() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M10.5 1.5L4 9h5.5L7.5 15.5l8-8.5H10L10.5 1.5Z"
        fill="white" fillOpacity="0.92"/>
    </svg>
  )
}

/* ── Nav items ───────────────────────────────────────────────── */
const NAV = [
  { to: '/',          Icon: IconGrid,     label: 'Instâncias', end: true },
  { to: '/flows',     Icon: IconFlow,     label: 'Fluxos' },
  { to: '/contacts',  Icon: IconUsers,    label: 'Contatos' },
  { to: '/dashboard', Icon: IconBarChart, label: 'Dashboard' },
  { to: '/chats',     Icon: IconChat,     label: 'Live Chats' },
]

/* ── Sidebar ─────────────────────────────────────────────────── */
function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo"><LogoBolt /></div>
        <div>
          <div className="sidebar-name">FlowZap</div>
          <div className="sidebar-sub">WhatsApp Flows</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">Menu</div>
        {NAV.map(({ to, Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <span className="sidebar-icon"><Icon /></span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-dot" />
        <span>Sistema online</span>
      </div>
    </aside>
  )
}

/* ── Layout ──────────────────────────────────────────────────── */
function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"          element={<Instances />} />
          <Route path="/flows"     element={<Flows />} />
          <Route path="/contacts"  element={<Contacts />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chats"     element={<LiveChats />} />
        </Route>
        <Route path="/flows/:id/editor" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  )
}
