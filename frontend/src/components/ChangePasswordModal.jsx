import { useState } from 'react'
import { changePassword } from '../api/auth'

const POLICY = [
  '12 caractères minimum',
  'au moins 1 minuscule',
  'au moins 1 MAJUSCULE',
  'au moins 1 chiffre',
  'au moins 1 caractère spécial',
]

const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [current, setCurrent] = useState('')
  const [next1,   setNext1]   = useState('')
  const [next2,   setNext2]   = useState('')
  const [error,   setError]   = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (next1 !== next2) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(current, next1)
      onSuccess?.()
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Échec du changement de mot de passe.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Changer mon mot de passe</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={lbl}>Mot de passe actuel</label>
            <input className={inp} type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className={lbl}>Nouveau mot de passe</label>
            <input className={inp} type="password" required minLength={12} value={next1} onChange={(e) => setNext1(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={lbl}>Confirmer le nouveau mot de passe</label>
            <input className={inp} type="password" required minLength={12} value={next2} onChange={(e) => setNext2(e.target.value)} autoComplete="new-password" />
          </div>

          <div className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
            <div className="font-semibold mb-1">Politique :</div>
            <ul className="list-disc list-inside space-y-0.5">
              {POLICY.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors">
              {submitting ? 'Modification…' : 'Valider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
