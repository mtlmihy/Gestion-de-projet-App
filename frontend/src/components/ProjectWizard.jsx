import { useState, useMemo } from 'react'
import { createProjet } from '../api/projets'
import { updateCdc } from '../api/cdc'

// ── Styles partagés (cohérents avec le reste de l'app) ───────────────────────
const inp = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
const ta  = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition leading-relaxed'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1'
const help = 'text-xs text-gray-400 dark:text-slate-500 italic mt-1'

// ── État initial ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  // Étape 1 — Identité
  nom: '',
  reference: '',
  chef_projet: '',
  service: '',
  sponsor: '',
  date_debut: '',
  // Étape 2 — Cadrage
  contexte: '',
  objectifs: '',
  perimetre: '',
  // Étape 3 — Jalons (liste dynamique)
  jalons: [{ label: 'Démarrage du projet', date: '', description: '' }],
}

const STEPS = [
  { num: 1, label: 'Identité',   icon: '🏷️' },
  { num: 2, label: 'Cadrage',    icon: '🎯' },
  { num: 3, label: 'Jalons',     icon: '📅' },
  { num: 4, label: 'Récap',      icon: '✅' },
]

export default function ProjectWizard({ onClose, onCreated }) {
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // ── Validation par étape ─────────────────────────────────────────────────
  const stepValidation = useMemo(() => {
    if (step === 1) {
      if (!form.nom.trim())        return 'Le nom du projet est requis.'
      if (!form.date_debut)        return 'La date de début est requise.'
    }
    if (step === 2) {
      if (!form.contexte.trim())   return 'Le contexte est requis.'
      if (!form.objectifs.trim())  return 'Les objectifs sont requis.'
    }
    return null
  }, [step, form])

  const canNext = !stepValidation

  const next = () => {
    if (!canNext) { setError(stepValidation); return }
    setError('')
    setStep((s) => Math.min(s + 1, STEPS.length))
  }
  const prev = () => { setError(''); setStep((s) => Math.max(s - 1, 1)) }

  // ── Gestion jalons ───────────────────────────────────────────────────────
  const addJalon = () =>
    setForm((f) => ({ ...f, jalons: [...f.jalons, { label: '', date: '', description: '' }] }))
  const updateJalon = (i, field, value) =>
    setForm((f) => ({
      ...f,
      jalons: f.jalons.map((j, idx) => (idx === i ? { ...j, [field]: value } : j)),
    }))
  const removeJalon = (i) =>
    setForm((f) => ({ ...f, jalons: f.jalons.filter((_, idx) => idx !== i) }))

  // ── Soumission finale ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      // 1. Créer le projet (description = courte synthèse depuis objectifs)
      const shortDesc = (form.objectifs || form.contexte).split('\n')[0].slice(0, 200)
      const { data: projet } = await createProjet({
        nom: form.nom.trim(),
        description: shortDesc,
        statut: 'En cours',
      })

      // 2. Construire le contenu CDC structuré
      const today = new Date().toISOString().slice(0, 10)
      const cdcContent = {
        nom_projet: form.nom.trim(),
        reference:  form.reference.trim(),
        chef_projet: form.chef_projet.trim(),
        service:    form.service.trim(),
        sponsor:    form.sponsor.trim(),
        date_debut: form.date_debut,
        contexte:   form.contexte.trim(),
        objectifs:  form.objectifs.trim(),
        perimetre:  form.perimetre.trim(),
        fonctionnel: '',
        technique:   '',
        ressources:  '',
        risques:     '',
        budget:      '',
        history: [['1.0', form.chef_projet || '', 'Création via assistant', today]],
        jalons: form.jalons
          .filter((j) => j.label || j.date)
          .map((j) => [j.label, j.date, j.description]),
      }

      // 3. Sauvegarder le CDC
      await updateCdc(projet.id, JSON.stringify(cdcContent))

      // 4. Notifier le parent → redirection vers /cdc
      onCreated(projet)
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Erreur lors de la création du projet.')
      setSaving(false)
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Création guidée d'un projet</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Étape {step} sur {STEPS.length} · {STEPS[step - 1].label}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl leading-none disabled:opacity-50"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    s.num < step
                      ? 'bg-green-500 text-white'
                      : s.num === step
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                  }`}
                >
                  {s.num < step ? '✓' : s.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      s.num < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-medium text-gray-500 dark:text-slate-500 px-1">
            {STEPS.map((s) => (
              <span key={s.num} className={s.num === step ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Body — défilant */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                Commençons par identifier votre projet et ses parties prenantes.
              </p>
              <div>
                <label className={lbl}>Nom du projet *</label>
                <input className={inp} required value={form.nom} onChange={setField('nom')} placeholder="Ex. Refonte du portail client" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Référence</label>
                  <input className={inp} value={form.reference} onChange={setField('reference')} placeholder="Ex. PRJ-2026-001" />
                </div>
                <div>
                  <label className={lbl}>Date de début *</label>
                  <input type="date" className={inp} required value={form.date_debut} onChange={setField('date_debut')} />
                </div>
              </div>
              <div>
                <label className={lbl}>Chef de projet</label>
                <input className={inp} value={form.chef_projet} onChange={setField('chef_projet')} placeholder="Prénom NOM" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Service</label>
                  <input className={inp} value={form.service} onChange={setField('service')} placeholder="Ex. Direction des systèmes d'information" />
                </div>
                <div>
                  <label className={lbl}>Sponsor</label>
                  <input className={inp} value={form.sponsor} onChange={setField('sponsor')} placeholder="Prénom NOM" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                Cadrons le projet. Ces informations alimenteront automatiquement le cahier des charges.
              </p>
              <div>
                <label className={lbl}>Contexte *</label>
                <textarea
                  className={ta}
                  rows={4}
                  value={form.contexte}
                  onChange={setField('contexte')}
                  placeholder="Pourquoi ce projet ? Quelle est la situation actuelle, le besoin métier ?"
                />
                <p className={help}>Décrivez l'origine du besoin et l'environnement du projet.</p>
              </div>
              <div>
                <label className={lbl}>Objectifs *</label>
                <textarea
                  className={ta}
                  rows={4}
                  value={form.objectifs}
                  onChange={setField('objectifs')}
                  placeholder="• Objectif 1&#10;• Objectif 2&#10;• Objectif 3"
                />
                <p className={help}>Listez les résultats attendus, idéalement mesurables.</p>
              </div>
              <div>
                <label className={lbl}>Périmètre</label>
                <textarea
                  className={ta}
                  rows={3}
                  value={form.perimetre}
                  onChange={setField('perimetre')}
                  placeholder="Ce qui est inclus et exclu du projet."
                />
                <p className={help}>Optionnel — vous pourrez le compléter plus tard.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                Définissez vos jalons clés. Vous pourrez les compléter plus tard depuis la page Planning.
              </p>
              {form.jalons.map((j, i) => (
                <div key={i} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 bg-gray-50 dark:bg-slate-800/50">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className={lbl}>Libellé</label>
                      <input
                        className={inp}
                        value={j.label}
                        onChange={(e) => updateJalon(i, 'label', e.target.value)}
                        placeholder="Ex. Recette utilisateur"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className={lbl}>Date</label>
                      <input
                        type="date"
                        className={inp}
                        value={j.date}
                        onChange={(e) => updateJalon(i, 'date', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className={lbl}>Note</label>
                      <input
                        className={inp}
                        value={j.description}
                        onChange={(e) => updateJalon(i, 'description', e.target.value)}
                        placeholder="Optionnel"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {form.jalons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeJalon(i)}
                          className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Supprimer ce jalon"
                          aria-label="Supprimer ce jalon"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addJalon}
                className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl py-2.5 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                + Ajouter un jalon
              </button>
              <p className="text-xs text-gray-400 dark:text-slate-500 italic text-center mt-2">
                Étape optionnelle — vous pouvez passer directement au récapitulatif.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                Vérifiez les informations avant la création. Le cahier des charges sera pré-rempli automatiquement.
              </p>

              <RecapSection title="Identité">
                <RecapRow k="Nom"          v={form.nom} />
                <RecapRow k="Référence"    v={form.reference} />
                <RecapRow k="Chef de projet" v={form.chef_projet} />
                <RecapRow k="Service"      v={form.service} />
                <RecapRow k="Sponsor"      v={form.sponsor} />
                <RecapRow k="Date début"   v={form.date_debut} />
              </RecapSection>

              <RecapSection title="Cadrage">
                <RecapRow k="Contexte"   v={form.contexte}  multi />
                <RecapRow k="Objectifs"  v={form.objectifs} multi />
                <RecapRow k="Périmètre"  v={form.perimetre} multi />
              </RecapSection>

              <RecapSection title={`Jalons (${form.jalons.filter((j) => j.label || j.date).length})`}>
                {form.jalons.filter((j) => j.label || j.date).length === 0 ? (
                  <p className="text-xs italic text-gray-400">Aucun jalon défini</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {form.jalons.filter((j) => j.label || j.date).map((j, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="font-medium">{j.label || '(sans nom)'}</span>
                        {j.date && <span className="text-gray-400 text-xs">— {j.date}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </RecapSection>
            </div>
          )}
        </div>

        {/* Footer — boutons navigation */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={prev}
            disabled={step === 1 || saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Précédent
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 rounded-xl disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={next}
                disabled={!canNext}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
              >
                Suivant →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
              >
                {saving ? 'Création…' : '✓ Créer le projet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sous-composants récap ────────────────────────────────────────────────────
function RecapSection({ title, children }) {
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
        {title}
      </div>
      <div className="p-3 space-y-1.5">{children}</div>
    </div>
  )
}

function RecapRow({ k, v, multi = false }) {
  const display = v?.toString().trim()
  return (
    <div className={multi ? '' : 'flex items-baseline gap-3 text-sm'}>
      <span className={`text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 ${multi ? 'block mb-0.5' : 'min-w-[110px]'}`}>{k}</span>
      <span className={`text-gray-700 dark:text-slate-300 ${multi ? 'block whitespace-pre-wrap text-sm' : ''} ${!display ? 'italic text-gray-300 dark:text-slate-600' : ''}`}>
        {display || '— non renseigné'}
      </span>
    </div>
  )
}
