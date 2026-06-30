export default function MiniBar({ value, color = '#3b82f6' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : color }} />
    </div>
  )
}
