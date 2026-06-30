import { useState } from 'react'
import { createProjet } from '../../api/projets'
import { STATUTS, inp, lbl } from '../../utils/projectsShared'

export default function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nom: '', description: '', statut: 'En cours', type_projet: 'Interne', budget_prevu: '', devise: 'CHF' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (form.type_projet === 'Client') {
      const budget = Number((form.budget_prevu || '').toString().replace(',', '.'))
      if (!form.budget_prevu?.toString().trim()) {
        setError('Le budget est requis pour un projet client.')
        setSaving(false)
        return
      }
      if (Number.isNaN(budget) || budget < 0) {
        setError('Le budget doit être un nombre supérieur ou égal à 0.')
        setSaving(false)
        return
      }
    }

    const payload = {
      nom: form.nom,
      description: form.description,
      statut: form.statut,
      type_projet: form.type_projet,
      devise: form.devise,
      budget_prevu: form.type_projet === 'Client'
        ? Number((form.budget_prevu || '').toString().replace(',', '.'))
        : null,
    }
    try {
      const { data } = await createProjet(payload)
      onCreated(data)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la création.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Nouveau projet</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={lbl}>Nom du projet *</label>
            <input className={inp} required value={form.nom} onChange={setF('nom')} placeholder="Nom du projet" autoFocus />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={form.description}
              onChange={setF('description')}
              placeholder="Description du projet"
            />
          </div>
          <div>
            <label className={lbl}>Statut initial</label>
            <select className={inp} value={form.statut} onChange={setF('statut')}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type de projet</label>
              <select className={inp} value={form.type_projet} onChange={setF('type_projet')}>
                <option value="Interne">Sans budget</option>
                <option value="Client">Avec budget</option>
              </select>
            </div>
            {form.type_projet === 'Client' && (
              <>
                <div>
                  <label className={lbl}>Budget prévu *</label>
                  <input
                    className={inp}
                    value={form.budget_prevu}
                    onChange={setF('budget_prevu')}
                    placeholder="Montant"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className={lbl}>Devise</label>
                  <select className={inp} value={form.devise} onChange={setF('devise')}>
                    <option value="CHF">CHF (CHF)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-semibold transition-colors">
              {saving ? 'Création…' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
