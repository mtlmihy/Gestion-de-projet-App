import { useState, useEffect, useMemo } from 'react'

const IMPORTANCES = ['Faible', 'Moyenne', 'Élevée', 'Critique']
const STATUTS     = ['A faire', 'En cours', 'Terminée', 'Bloquée']
const HEURES_PAR_JOUR = 8

const EMPTY = {
  nom: '', description: '', importance: 'Moyenne',
  avancement: 0, assigne: '', jalon: '', charge_jours: '', statut: 'A faire',
}

/** Convertit une saisie en heures vers des jours (1J = 8h). Ex : 4 → 0.5, 8.4 → 1.05 */
function heuresToJours(h) {
  const n = parseFloat(h)
  return isNaN(n) || n < 0 ? null : Math.round((n / HEURES_PAR_JOUR) * 100) / 100
}

const cls = {
  label:    'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1',
  input:    'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
  select:   'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
  textarea: 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
}

export default function TacheForm({ initial, onSubmit, onCancel, loading, jalonsOptions = [], membresOptions = [] }) {
  const toFormState = (data) => data
    ? { ...data, charge_jours: data.charge_jours != null ? String(data.charge_jours * HEURES_PAR_JOUR) : '' }
    : { ...EMPTY }

  const [form, setForm] = useState(() => toFormState(initial))
  const jalonsSelectOptions = useMemo(() => {
    const values = new Set(jalonsOptions.filter(Boolean))
    if (form.jalon) values.add(form.jalon)
    return Array.from(values)
  }, [jalonsOptions, form.jalon])

  const assigneSelectOptions = useMemo(() => {
    const values = new Set(membresOptions.filter(Boolean))
    if (form.assigne) values.add(form.assigne)
    return Array.from(values)
  }, [membresOptions, form.assigne])

  useEffect(() => { setForm(toFormState(initial)) }, [initial])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const chargeJours = heuresToJours(form.charge_jours)
    onSubmit({ ...form, charge_jours: chargeJours })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className={cls.label} htmlFor="tache-nom">Nom <span className="text-red-500">*</span></label>
          <input id="tache-nom" className={cls.input} value={form.nom} onChange={set('nom')} required />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={cls.label} htmlFor="tache-description">Description</label>
          <textarea id="tache-description" className={cls.textarea} rows={2} value={form.description} onChange={set('description')} />
        </div>

        {/* Importance */}
        <div>
          <label className={cls.label} htmlFor="tache-importance">Importance</label>
          <select id="tache-importance" className={cls.select} value={form.importance} onChange={set('importance')}>
            {IMPORTANCES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Statut */}
        <div>
          <label className={cls.label} htmlFor="tache-statut">Statut</label>
          <select id="tache-statut" className={cls.select} value={form.statut ?? 'A faire'} onChange={set('statut')}>
            {STATUTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Assigné */}
        <div>
          <label className={cls.label} htmlFor="tache-assigne">Assigné à <span className="text-red-500">*</span></label>
          {assigneSelectOptions.length > 0 ? (
            <select id="tache-assigne" className={cls.select} value={form.assigne} onChange={set('assigne')} required>
              <option value="">- Choisir un membre -</option>
              {assigneSelectOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input id="tache-assigne" className={cls.input} value={form.assigne} onChange={set('assigne')} required placeholder="Nom du responsable" />
          )}
        </div>

        {/* Jalon */}
        <div>
          <label className={cls.label} htmlFor="tache-jalon">Jalon</label>
          {jalonsSelectOptions.length > 0 ? (
            <select id="tache-jalon" className={cls.select} value={form.jalon} onChange={set('jalon')}>
              <option value="">(Sans jalon)</option>
              {jalonsSelectOptions.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          ) : (
            <input id="tache-jalon" className={cls.input} value={form.jalon} onChange={set('jalon')} placeholder="Nom du jalon" />
          )}
        </div>

        {/* Charge */}
        <div>
          <label className={cls.label} htmlFor="tache-charge">
            Charge (heures)
            {form.charge_jours !== '' && !isNaN(parseFloat(form.charge_jours)) && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                = {heuresToJours(form.charge_jours)} j. ({HEURES_PAR_JOUR}h/j)
              </span>
            )}
          </label>
          <input
            id="tache-charge"
            type="number" min="0" step="0.5"
            value={form.charge_jours}
            onChange={set('charge_jours')}
            placeholder="ex: 4 (= 0.5 jour)"
            className={cls.input}
          />
        </div>

        {/* Avancement */}
        <div>
          <label className={cls.label} htmlFor="tache-avancement">Avancement : <span className="font-semibold">{form.avancement} %</span></label>
          <input
            id="tache-avancement"
            type="range" min="0" max="100" step="5"
            value={form.avancement}
            onChange={setNum('avancement')}
            className="w-full accent-blue-600"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium">
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
