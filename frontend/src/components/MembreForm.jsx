import { useState, useEffect } from 'react'

const EMPTY = { collaborateur: '', poste: '', manager: '', numero: '', email: '' }

const cls = {
  label: 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1',
  input: 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
}

export default function MembreForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? EMPTY)
  const [error, setError] = useState('')

  useEffect(() => { setForm(initial ?? EMPTY); setError('') }, [initial])

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const collab   = (form.collaborateur ?? '').trim()
    const managers = (form.manager ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    if (collab && managers.some((m) => m.toLowerCase() === collab.toLowerCase())) {
      setError("Un membre ne peut pas être son propre manager.")
      return
    }
    onSubmit({ ...form, collaborateur: collab, manager: managers.join('; ') })
  }

  const selfManager =
    (form.collaborateur ?? '').trim() &&
    (form.manager ?? '')
      .split(';')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes((form.collaborateur ?? '').trim().toLowerCase())

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={cls.label}>Collaborateur <span className="text-red-500">*</span></label>
          <input className={cls.input} value={form.collaborateur} onChange={set('collaborateur')} required />
        </div>
        <div>
          <label className={cls.label}>Poste</label>
          <input className={cls.input} value={form.poste} onChange={set('poste')} />
        </div>
        <div>
          <label className={cls.label}>Manager(s)</label>
          <input
            className={`${cls.input} ${selfManager ? 'border-red-400 dark:border-red-500 focus:ring-red-400' : ''}`}
            value={form.manager}
            onChange={set('manager')}
            placeholder="Prénom NOM ; Prénom NOM"
            aria-invalid={selfManager || undefined}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Séparer plusieurs référents par un point-virgule (<code>;</code>).
          </p>
          {selfManager && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Un membre ne peut pas être son propre manager.</p>
          )}
        </div>
        <div>
          <label className={cls.label}>Numéro</label>
          <input className={cls.input} type="tel" value={form.numero} onChange={set('numero')} />
        </div>
        <div>
          <label className={cls.label}>Email</label>
          <input className={cls.input} type="email" value={form.email} onChange={set('email')} />
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">Annuler</button>
        <button type="submit" disabled={loading || selfManager} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium">
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
