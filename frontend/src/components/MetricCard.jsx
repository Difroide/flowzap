export default function MetricCard({ icon, label, value, sublabel, trend, tooltip }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #161a28 0%, #121620 100%)',
      border: '1px solid #242838',
      borderRadius: 12,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* Top shimmer */}
      <div style={{ position: 'absolute', top: 0, left: 10, right: 10, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

      {/* Icon + trend row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>
          {icon}
        </div>
        {trend != null && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
            background: trend >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: trend >= 0 ? '#4ade80' : '#f87171',
            border: `1px solid ${trend >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: '#e2e8f0', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>

      {/* Label */}
      <div style={{ fontSize: 12, color: '#4a5568', fontWeight: 500 }}>
        {label}
        {tooltip && (
          <span
            title={tooltip}
            style={{ marginLeft: 5, cursor: 'help', fontSize: 11, color: '#3d4660',
              background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2d3a',
              borderRadius: 99, padding: '0 5px' }}
          >?</span>
        )}
      </div>
      {sublabel && <div style={{ fontSize: 11, color: '#3d4660', marginTop: 3 }}>{sublabel}</div>}
    </div>
  )
}
