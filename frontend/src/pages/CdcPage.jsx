import { useState, useEffect } from 'react'
import { getCdc, updateCdc } from '../api/cdc'

// ── Structure JSON vide ───────────────────────────────────────────────────────
const EMPTY = {
  nom_projet: '', reference: '', chef_projet: '', service: '',
  sponsor: '', date_debut: '',
  contexte: '', objectifs: '', perimetre: '',
  fonctionnel: '', technique: '', ressources: '',
  risques: '', budget: '',
  history: [['1.0', '', 'Version initiale', '']],
  jalons:  [['', '', '']],
}

// ── Helpers styles ────────────────────────────────────────────────────────────
const inp  = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
const ta   = 'w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical leading-relaxed transition min-h-[130px]'
const lbl  = 'block text-[.68rem] font-semibold uppercase tracking-wide text-gray-400 mb-1'
const help = 'text-[.75rem] text-gray-400 italic mb-3 ml-9 leading-snug'
const rowIn = 'w-full border-0 bg-transparent text-sm text-gray-700 px-1 py-0.5 rounded focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400'

// ── Sous-composants ───────────────────────────────────────────────────────────
function Card({ children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow">
      {children}
    </div>
  )
}

function SectionNum({ n, color }) {
  const bg = color === 'red'
    ? 'bg-red-50 text-red-400'
    : 'bg-blue-50 text-blue-500'
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold flex-shrink-0 ${bg}`}>
      {n}
    </span>
  )
}

function SectionHeader({ n, title, color }) {
  return (
    <div className="flex items-center gap-2.5 mb-1">
      <SectionNum n={n} color={color} />
      <span className="text-[.94rem] font-semibold text-gray-800">{title}</span>
    </div>
  )
}

function Notification({ msg, type }) {
  if (!msg) return null
  const cls = type === 'error'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-green-50 text-green-700 border-green-200'
  return (
    <div className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${cls}`}>{msg}</div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function CdcPage() {
  const [cdc,      setCdc]     = useState(EMPTY)
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)
  const [notif,    setNotif]   = useState({ msg: '', type: 'ok' })
  const [lastSaved, setLastSaved] = useState(null)

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  // Chargement initial
  useEffect(() => {
    getCdc()
      .then(({ data }) => {
        setLastSaved(data.derniere_maj ? new Date(data.derniere_maj) : null)
        try {
          const parsed = JSON.parse(data.contenu)
          setCdc({ ...EMPTY, ...parsed })
        } catch {
          // Le contenu n'est pas du JSON → on le met dans contexte
          setCdc({ ...EMPTY, contexte: data.contenu ?? '' })
        }
      })
      .catch((err) => {
        if (err?.response?.status !== 404) notify('Erreur lors du chargement.', 'error')
      })
      .finally(() => setLoading(false))
  }, [])

  // Modificateurs
  const set = (field) => (e) => setCdc((c) => ({ ...c, [field]: e.target.value }))

  // Tables history / jalons
  const setCell = (table, ri, ci) => (e) =>
    setCdc((c) => {
      const t = c[table].map((r) => [...r])
      t[ri][ci] = e.target.value
      return { ...c, [table]: t }
    })
  const addRow    = (table, empty) => () => setCdc((c) => ({ ...c, [table]: [...c[table], empty] }))
  const removeRow = (table, ri)    => () => setCdc((c) => ({ ...c, [table]: c[table].filter((_, i) => i !== ri) }))

  // Sauvegarde
  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await updateCdc(JSON.stringify(cdc))
      setLastSaved(data.derniere_maj ? new Date(data.derniere_maj) : null)
      notify('Cahier des charges sauvegardé.')
    } catch {
      notify('Erreur lors de la sauvegarde.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Chargement…</div>
  )

  const history = cdc.history ?? []
  const jalons  = cdc.jalons  ?? []

  return (
    <div className="space-y-4 max-w-4xl mx-auto">

      {/* ── Barre de titre ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 leading-tight">Cahier des Charges</div>
            <div className="text-xs text-gray-400">Document de cadrage projet</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Sauvegardé le {lastSaved.toLocaleString('fr-FR')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <Notification msg={notif.msg} type={notif.type} />

      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ['nom_projet',  'Nom / Code projet',        'Ex : PROJ-2026-001'],
            ['reference',   'Référence (Stratégie)',     'Ex : STRAT-2026-A'],
            ['chef_projet', 'Chef de projet',            'Prénom Nom'],
            ['service',     'Service / Organisation',    'Ex : DSI, Direction Commerciale…'],
            ['sponsor',     'Sponsor du projet',         'Prénom Nom — Direction / Rôle'],
          ].map(([field, label, placeholder]) => (
            <div key={field}>
              <label className={lbl}>{label}</label>
              <input className={inp} type="text" value={cdc[field] ?? ''} onChange={set(field)} placeholder={placeholder} />
            </div>
          ))}
          <div>
            <label className={lbl}>Date de début du projet</label>
            <input className={inp} type="date" value={cdc.date_debut ?? ''} onChange={set('date_debut')} />
          </div>
        </div>
      </Card>

      {/* ── Historique des versions ────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-xs font-bold text-gray-500">H</span>
            <span className="text-[.94rem] font-semibold text-gray-800">Historique des versions</span>
          </div>
          <button
            onClick={addRow('history', ['', '', '', ''])}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Version', 'Auteur', 'Description', 'Date', ''].map((h) => (
                  <th key={h} className="text-left text-[.68rem] font-semibold uppercase tracking-wide text-gray-400 pb-2.5 pr-3 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map((row, ri) => (
                <tr key={ri} className="group">
                  <td className="py-2 pr-3 w-24"><input className={rowIn} value={row[0] ?? ''} onChange={setCell('history', ri, 0)} placeholder="1.0" /></td>
                  <td className="py-2 pr-3 w-36"><input className={rowIn} value={row[1] ?? ''} onChange={setCell('history', ri, 1)} placeholder="Auteur" /></td>
                  <td className="py-2 pr-3"><input className={rowIn} value={row[2] ?? ''} onChange={setCell('history', ri, 2)} placeholder="Description" /></td>
                  <td className="py-2 pr-3 w-36"><input className={rowIn} type="date" value={row[3] ?? ''} onChange={setCell('history', ri, 3)} /></td>
                  <td className="py-2 w-8 text-center">
                    <button onClick={removeRow('history', ri)} className="text-gray-200 hover:text-red-400 transition-colors text-sm">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Sections 1-6 (textareas) ───────────────────────────────────── */}
      {[
        ['1', 'Contexte du projet',    'contexte',     'Situez ici le projet dans son contexte. Décrivez comment ce projet est né, les besoins initiaux, les avantages espérés, le contexte technique, les aspects légaux si applicable.',
          'Décrivez le contexte du projet…'],
        ['2', 'Objectifs du projet',   'objectifs',    'Exprimez les bénéfices attendus justifiant votre investissement (augmentation des ventes, réduction de coûts, obligation légale, etc.). Soyez aussi complet que possible.',
          'Décrivez les objectifs du projet…'],
        ['3', 'Périmètre du projet',   'perimetre',    "Quelles sont les limites de votre projet ? En quoi consiste-t-il ? Où commence-t-il et où s'arrête-t-il ? Définir ce qui sort des limites est aussi important.",
          'Décrivez le périmètre du projet…'],
        ['4', 'Aspects fonctionnels',  'fonctionnel',  "Définissez chacun de vos objectifs et découpez-les en livrables ou fonctionnalités.",
          'Décrivez les aspects fonctionnels…'],
        ['5', 'Aspects techniques',    'technique',    "Y a-t-il des contraintes techniques ? Nouveau progiciel ? Nouveaux équipements ? Réseau ? Compétences internes ?",
          'Décrivez les contraintes techniques…'],
        ['6', 'Ressources',            'ressources',   "Définir le besoin en ressources (qui, quand, combien de temps, expertise) pour délivrer le projet dans les délais.",
          'Décrivez les ressources nécessaires…'],
      ].map(([n, title, field, helpText, placeholder]) => (
        <Card key={field}>
          <SectionHeader n={n} title={title} />
          <p className={help}>{helpText}</p>
          <textarea className={ta} value={cdc[field] ?? ''} onChange={set(field)} placeholder={placeholder} />
        </Card>
      ))}

      {/* ── Risques identifiés ─────────────────────────────────────────── */}
      <Card>
        <SectionHeader n="R" title="Risques identifiés" color="red" />
        <p className={help}>Listez les risques connus (1 par ligne). Ex : Dépassement budgétaire, Manque de ressources, Résistance au changement…</p>
        <textarea className={`${ta} min-h-[100px]`} value={cdc.risques ?? ''} onChange={set('risques')} placeholder="Un risque par ligne…" />
      </Card>

      {/* ── Jalons & Planning ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader n="7" title="Jalons & Planning" />
          <button
            onClick={addRow('jalons', ['', '', ''])}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter un jalon
          </button>
        </div>
        <p className={`${help} ml-0 mb-3`}>Renseignez chaque phase/jalon avec sa date cible et une description.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Jalon / Phase', 'Date cible', 'Description / Livrable', ''].map((h) => (
                  <th key={h} className="text-left text-[.68rem] font-semibold uppercase tracking-wide text-gray-400 pb-2.5 pr-3 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jalons.map((row, ri) => (
                <tr key={ri} className="group">
                  <td className="py-2 pr-3 w-[34%]"><input className={rowIn} value={row[0] ?? ''} onChange={setCell('jalons', ri, 0)} placeholder="Ex : Lancement" /></td>
                  <td className="py-2 pr-3 w-32"><input className={rowIn} type="date" value={row[1] ?? ''} onChange={setCell('jalons', ri, 1)} /></td>
                  <td className="py-2 pr-3"><input className={rowIn} value={row[2] ?? ''} onChange={setCell('jalons', ri, 2)} placeholder="Description du livrable" /></td>
                  <td className="py-2 w-8 text-center">
                    <button onClick={removeRow('jalons', ri)} className="text-gray-200 hover:text-red-400 transition-colors text-sm">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Budget ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader n="8" title="Budget" />
        <p className={help}>Montant des investissements, prestataires, hébergement, coût des ressources, maintenance, licences, éléments techniques, etc.</p>
        <textarea className={ta} value={cdc.budget ?? ''} onChange={set('budget')} placeholder="Décrivez le budget du projet…" />
      </Card>

      {/* ── Barre d'actions collante ────────────────────────────────────── */}
      <div className="sticky bottom-4 bg-white border border-gray-100 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-lg z-10">
        {lastSaved ? (
          <span className="text-xs text-gray-400">
            Sauvegardé le {lastSaved.toLocaleString('fr-FR')}
          </span>
        ) : <span />}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Enregistrement…' : 'Sauvegarder'}
        </button>
      </div>

    </div>
  )
}
