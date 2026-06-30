export default function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}
