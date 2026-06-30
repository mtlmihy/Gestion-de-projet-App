import { useState, useEffect } from 'react'

const CATEGORIES = [
  'Opérations','Budget','Planning','Technologie','Sécurité',
  'Financier','Ressources humaines','Conformité','Scope',
  'Communication','Qualité','Changement',
]
const PROBABILITES = ['Faible', 'Moyenne', 'Élevée']
const IMPACTS      = ['Faible', 'Moyen', 'Élevé']
const STATUTS      = ['Ouvert', 'En cours', 'Fermé']

const PROBA_SCORE  = { Faible: 1, Moyenne: 2, Élevée: 3 }
const IMPACT_SCORE = { Faible: 1, Moyen: 2, Élevé: 3 }

// Convention ITIL : P1 = critique (le plus prioritaire), P3 = faible
function calcPriorite(prob, imp) {
  const s = (PROBA_SCORE[prob] ?? 1) * (IMPACT_SCORE[imp] ?? 1)
  return s >= 6 ? 1 : s >= 3 ? 2 : 3
}

const EMPTY = {
  nom: '', description: '', categorie: 'Opérations',
  probabilite: 'Faible', impact: 'Faible', responsable: '',
  attenuation: '', statut: 'Ouvert',
}

const cls = {
  label:  'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1',
  input:  'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
  select: 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
  textarea:'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
}

export default function RisqueForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? EMPTY)

  useEffect(() => { setForm(initial ?? EMPTY) }, [initial])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const priorite = calcPriorite(form.probabilite, form.impact)
  const prioColor = { 1: 'bg-red-100 text-red-800', 2: 'bg-yellow-100 text-yellow-800', 3: 'bg-green-100 text-green-800' }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ ...form, priorite })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className={cls.label} htmlFor="risque-nom">Nom du risque <span className="text-red-500">*</span></label>
          <input id="risque-nom" className={cls.input} value={form.nom} onChange={set('nom')} required />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={cls.label} htmlFor="risque-description">Description</label>
          <textarea id="risque-description" className={cls.textarea} rows={2} value={form.description} onChange={set('description')} />
        </div>

        {/* Catégorie */}
        <div>
          <label className={cls.label} htmlFor="risque-categorie">Catégorie</label>
          <select id="risque-categorie" className={cls.select} value={form.categorie} onChange={set('categorie')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Responsable */}
        <div>
          <label className={cls.label} htmlFor="risque-responsable">Responsable <span className="text-red-500">*</span></label>
          <input id="risque-responsable" className={cls.input} value={form.responsable} onChange={set('responsable')} required />
        </div>

        {/* Probabilité */}
        <div>
          <label className={cls.label} htmlFor="risque-probabilite">Probabilité</label>
          <select id="risque-probabilite" className={cls.select} value={form.probabilite} onChange={set('probabilite')}>
            {PROBABILITES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Impact */}
        <div>
          <label className={cls.label} htmlFor="risque-impact">Impact</label>
          <select id="risque-impact" className={cls.select} value={form.impact} onChange={set('impact')}>
            {IMPACTS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Priorité calculée */}
        <div className="sm:col-span-2 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Priorité calculée :</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${prioColor[priorite]}`}>
            P{priorite}
          </span>
        </div>

        {/* Atténuation */}
        <div className="sm:col-span-2">
          <label className={cls.label} htmlFor="risque-attenuation">Mesure d'atténuation</label>
          <textarea id="risque-attenuation" className={cls.textarea} rows={2} value={form.attenuation} onChange={set('attenuation')} />
        </div>

        {/* Statut */}
        <div>
          <label className={cls.label} htmlFor="risque-statut">Statut</label>
          <select id="risque-statut" className={cls.select} value={form.statut} onChange={set('statut')}>
            {STATUTS.map((s) => <option key={s}>{s}</option>)}
          </select>
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
