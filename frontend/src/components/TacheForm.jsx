import { useState, useEffect } from 'react'

const IMPORTANCES = ['Faible', 'Moyenne', 'Élevée', 'Critique']

const EMPTY = {
  nom: '', description: '', importance: 'Moyenne',
  avancement: 0, assigne: '', jalon: '',
}

const cls = {
  label:    'block text-sm font-medium text-gray-700 mb-1',
  input:    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  select:   'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white',
  textarea: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
}

export default function TacheForm({ initial, onSubmit, onCancel, loading, jalonsOptions = [] }) {
  const [form, setForm] = useState(initial ?? EMPTY)

  useEffect(() => { setForm(initial ?? EMPTY) }, [initial])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className={cls.label}>Nom <span className="text-red-500">*</span></label>
          <input className={cls.input} value={form.nom} onChange={set('nom')} required />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={cls.label}>Description</label>
          <textarea className={cls.textarea} rows={2} value={form.description} onChange={set('description')} />
        </div>

        {/* Importance */}
        <div>
          <label className={cls.label}>Importance</label>
          <select className={cls.select} value={form.importance} onChange={set('importance')}>
            {IMPORTANCES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Assigné */}
        <div>
          <label className={cls.label}>Assigné à <span className="text-red-500">*</span></label>
          <input className={cls.input} value={form.assigne} onChange={set('assigne')} required />
        </div>

        {/* Jalon */}
        <div>
          <label className={cls.label}>Jalon</label>
          {jalonsOptions.length > 0 ? (
            <select className={cls.select} value={form.jalon} onChange={set('jalon')}>
              <option value="">(Sans jalon)</option>
              {jalonsOptions.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          ) : (
            <input className={cls.input} value={form.jalon} onChange={set('jalon')} placeholder="Ex : Livrable 1" />
          )}
        </div>

        {/* Avancement */}
        <div>
          <label className={cls.label}>Avancement : <span className="font-semibold">{form.avancement} %</span></label>
          <input
            type="range" min="0" max="100" step="5"
            value={form.avancement}
            onChange={setNum('avancement')}
            className="w-full accent-blue-600"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium">
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
