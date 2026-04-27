import { useState, useEffect } from 'react'

const EMPTY = { collaborateur: '', poste: '', manager: '', numero: '', email: '' }

const cls = {
  label: 'block text-sm font-medium text-gray-700 mb-1',
  input: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
}

export default function MembreForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? EMPTY)

  useEffect(() => { setForm(initial ?? EMPTY) }, [initial])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
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
          <label className={cls.label}>Manager</label>
          <input className={cls.input} value={form.manager} onChange={set('manager')} />
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

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium">
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
