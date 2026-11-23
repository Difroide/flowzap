import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import MetricCard from '../components/MetricCard.jsx'
import { getDashboardStats, getDashboardSales, getDashboardLeads, getDashboardConfig, setDashboardConfig } from '../api.js'

const fmt  = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
const fmtN = n => new Intl.NumberFormat('pt-BR').format(n || 0)
const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#131720', border: '1px solid #242838', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      <div style={{ color: '#4a5568', marginBottom: 5, fontWeight: 500 }}>{fmtDay(label)}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || '#e2e8f0', display: 'flex', gap: 8 }}>
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{money ? fmt(p.value) : fmtN(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: '7d',   label: '7 dias' },
  { key: '30d',  label: '30 dias' },
  { key: 'custom', label: 'Personalizado' },
]

function getParams(period, customFrom, customTo) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  if (period === 'today')  return `from=${todayStr}&to=${todayStr}`
  if (period === '7d')     return `from=${new Date(now-7*86400000).toISOString().split('T')[0]}&to=${todayStr}`
  if (period === '30d')    return `from=${new Date(now-30*86400000).toISOString().split('T')[0]}&to=${todayStr}`
  if (period === 'custom' && customFrom && customTo) return `from=${customFrom}&to=${customTo}`
  return `from=${new Date(now-30*86400000).toISOString().split('T')[0]}&to=${todayStr}`
}

export default function Dashboard() {
  const [period, setPeriod]       = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [stats, setStats]         = useState(null)
  const [salesData, setSalesData] = useState([])
  const [leadsData, setLeadsData] = useState([])
  const [loading, setLoading]     = useState(true)
  const [adSpend, setAdSpend]     = useState(0)

  const load = useCallback(async () => {
    const p = getParams(period, customFrom, customTo)
    try {
      const [s, sd, ld, cfg] = await Promise.all([
        getDashboardStats(p),
        getDashboardSales(p),
        getDashboardLeads(p),
        getDashboardConfig(),
      ])
      setStats(s)
      setSalesData(sd || [])
      setLeadsData(ld || [])
      if (cfg) setAdSpend(cfg.ad_spend ?? 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  // polling 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const cards = stats ? [
    { icon: '👤', label: 'Leads no período',    sublabel: `+${fmtN(stats.leads_new_today)} hoje`, value: fmtN(stats.leads_total) },
    { icon: '🛒', label: 'Vendas no período',   value: fmtN(stats.sales_total) },
    { icon: '💰', label: 'Faturamento',          value: fmt(stats.revenue_total) },
    { icon: '🎯', label: 'Ticket médio',         value: fmt(stats.avg_ticket) },
    { icon: '📈', label: 'Taxa de conversão',    value: `${stats.conversion_rate.toFixed(1)}%` },
    { icon: '💵', label: 'Lucro',                value: fmt(stats.lucro) },
    { icon: '📊', label: 'ROAS',                 value: stats.roas !== null ? `${stats.roas.toFixed(1)}x` : 'N/A' },
  ] : []

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Métricas do seu funil de WhatsApp</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`btn ${period === p.key ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 140, padding: '4px 8px' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 140, padding: '4px 8px' }} />
            </div>
          )}
        </div>
      </div>

      {/* Ad spend input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Custo de ads:</span>
        <input
          type="number"
          value={adSpend}
          onChange={e => setAdSpend(e.target.value)}
          onBlur={() => setDashboardConfig({ ad_spend: parseFloat(adSpend) || 0 }).then(load)}
          placeholder="0.00"
          style={{ width: 100, padding: '4px 8px' }}
        />
      </div>

      {/* Metrics grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
            {cards.map((c, i) => (
              <MetricCard key={i} {...c} />
            ))}
          </div>

          {/* Status row */}
          {stats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.14)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.8)', display: 'inline-block' }} />
                {stats.active_instances} instância{stats.active_instances !== 1 ? 's' : ''} conectada{stats.active_instances !== 1 ? 's' : ''}
              </div>
              <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.14)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#a5a0ff', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                {stats.active_flows} fluxo{stats.active_flows !== 1 ? 's' : ''} ativo{stats.active_flows !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Revenue chart */}
            <div style={{ background: 'linear-gradient(145deg, #161a28 0%, #121620 100%)', border: '1px solid #242838', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>Faturamento por dia</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={salesData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6c63ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1e2c" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#3d4660', fontSize: 10 }} tickFormatter={fmtDay} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#3d4660', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip money />} />
                  <Area type="monotone" dataKey="revenue" name="Receita" stroke="#6c63ff" strokeWidth={2} fill="url(#gRevenue)" dot={false} activeDot={{ r: 4, fill: '#6c63ff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Leads chart */}
            <div style={{ background: 'linear-gradient(145deg, #161a28 0%, #121620 100%)', border: '1px solid #242838', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>Leads por dia</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={leadsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1e2c" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#3d4660', fontSize: 10 }} tickFormatter={fmtDay} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#3d4660', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Leads" fill="#14b8a6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
