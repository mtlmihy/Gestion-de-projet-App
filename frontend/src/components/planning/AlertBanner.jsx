export default function AlertBanner({ icon, children, level = 'error' }) {
  const styles = {
    error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300',
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${styles[level]}`}>
      <span className="flex-shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
