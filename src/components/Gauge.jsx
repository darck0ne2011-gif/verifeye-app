const COLORS = {
  likely_ai: '#f87171',
  inconclusive: '#fbbf24',
  likely_real: '#34d399',
}

/**
 * Half-circle gauge for the AI probability (0-100), colored by verdict band.
 */
export default function Gauge({ value = 0, verdict = 'inconclusive', label, sublabel }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 54
  const cx = 70
  const cy = 70
  const circumference = Math.PI * r // half circle
  const dash = (v / 100) * circumference
  const color = COLORS[verdict] ?? COLORS.inconclusive
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label ?? ''} ${v}%`}>
      <svg viewBox="0 0 140 84" className="w-44 h-auto">
        <path d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#e6ecf5" fontSize="30" fontWeight="800">
          {Math.round(v)}%
        </text>
      </svg>
      {label && <p className="text-sm font-medium text-fg -mt-1">{label}</p>}
      {sublabel && <p className="text-xs text-muted mt-0.5">{sublabel}</p>}
    </div>
  )
}
