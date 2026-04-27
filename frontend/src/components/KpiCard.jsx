export default function KpiCard({ label, value, colorClass = 'text-gray-900 dark:text-slate-100' }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
