export default function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const color = pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="min-w-[80px]">
      <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs font-semibold mt-1 text-gray-500">{pct} %</p>
    </div>
  )
}
