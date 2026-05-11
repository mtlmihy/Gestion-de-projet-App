import { useEffect, useState } from 'react'
import { RocketLaunch, Lightbulb, Code, CheckCircle, FlashOn, Lock, GpsFixed } from '@mui/icons-material'

import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useProject } from '../context/ProjectContext'
import {
  createCopil,
  createCopilNote,
  deleteCopil,
  deleteCopilNote,
  getCopilNotes,
  getCopils,
  updateCopil,
} from '../api/copils'
import { getCdc } from '../api/cdc'
import { getEquipe } from '../api/equipe'
import { getRisques } from '../api/risques'
import { getTaches } from '../api/taches'

// ─── PHASES D'UN PROJET IT ─────────────────────────────────────────────────────
const PROJECT_PHASES = [
  { id: 'kickoff', nom: 'Kick-off', ordre: 1, color: 'bg-blue-500 dark:bg-blue-600' },
  { id: 'poc', nom: 'POC', ordre: 2, color: 'bg-cyan-500 dark:bg-cyan-600' },
  { id: 'dev', nom: 'Développement', ordre: 3, color: 'bg-emerald-500 dark:bg-emerald-600' },
  { id: 'uat', nom: 'Test & UAT', ordre: 4, color: 'bg-violet-500 dark:bg-violet-600' },
  { id: 'golive', nom: 'Go-live', ordre: 5, color: 'bg-rose-500 dark:bg-rose-600' },
  { id: 'postprod', nom: 'Post-Prod', ordre: 6, color: 'bg-amber-500 dark:bg-amber-600' },
  { id: 'clotureretex', nom: 'Clôture', ordre: 7, color: 'bg-slate-500 dark:bg-slate-600' },
]

const PHASE_ICONS = {
  kickoff: <RocketLaunch sx={{ fontSize: 32 }} />,
  poc: <Lightbulb sx={{ fontSize: 32 }} />,
  dev: <Code sx={{ fontSize: 32 }} />,
  uat: <CheckCircle sx={{ fontSize: 32 }} />,
  golive: <FlashOn sx={{ fontSize: 32 }} />,
  postprod: <Lock sx={{ fontSize: 32 }} />,
  clotureretex: <GpsFixed sx={{ fontSize: 32 }} />,
}

function parseCdcContent(data) {
  try {
    const raw = typeof data?.contenu === 'string' ? JSON.parse(data.contenu) : (data?.contenu ?? {})
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function normalizeJalons(cdc) {
  const rows = Array.isArray(cdc?.jalons) ? cdc.jalons : []
  return rows
    .map((j) => {
      if (Array.isArray(j)) return { nom: (j[0] || '').trim(), date: (j[1] || '').trim(), detail: (j[2] || '').trim() }
      return { nom: (j?.nom || '').trim(), date: (j?.date || '').trim(), detail: (j?.description || '').trim() }
    })
    .filter((j) => j.nom || j.date || j.detail)
}

function buildAutoPhaseData({ projet, cdc, equipe, taches, risques }) {
  const jalons = normalizeJalons(cdc)
  const jalonsText = jalons.slice(0, 5).map((j) => `- ${j.nom || 'Jalon'}${j.date ? ` - ${j.date}` : ''}`).join('\n')
  const managers = [...new Set((equipe || []).flatMap((m) => (m.manager || '').split(';').map((x) => x.trim()).filter(Boolean)))].slice(0, 3)
  const topMembers = (equipe || []).slice(0, 6).map((m) => m.collaborateur).filter(Boolean)
  const roles = [
    cdc?.sponsor ? `- Sponsor / Executive Steering: ${cdc.sponsor}` : '- Sponsor / Executive Steering: [NOM]',
    projet?.chef_projet ? `- Chef(fe) de projet: ${projet.chef_projet}` : '- Chef(fe) de projet: [NOM]',
    managers.length ? `- Referents métier: ${managers.join(', ')}` : '- Referents métier: [NOMS]',
    '- Lead technique: [NOM]',
  ].join('\n')

  const maybeGoLive = jalons.find((j) => /go\s*-?\s*live|mise en prod|production/i.test(j.nom || ''))
  const dateGoLive = maybeGoLive?.date ? `${maybeGoLive.date}T09:00` : ''
  const objectif = (cdc?.objectifs || projet?.description || '').trim()
  const perimetre = (cdc?.perimetre || '').trim()
  const participants = topMembers.join(', ')
  const risquesOuverts = (risques || []).filter((r) => r.statut !== 'Fermé').slice(0, 3)
  const risquesText = risquesOuverts.map((r) => `- ${r.identifiant || 'Risque'} | ${r.responsable || 'N/A'} | ${r.statut || 'Ouvert'}`).join('\n')
  const tachesCritiques = (taches || []).filter((t) => t.importance === 'Critique' || (t.avancement || 0) < 100).slice(0, 3)
  const tachesText = tachesCritiques.map((t) => `- ${t.nom || 'Tâche'} | ${t.assigne || 'Non assigné'} | ${t.avancement || 0}%`).join('\n')

  return {
    objectif,
    perimetre,
    roles,
    jalons: jalonsText,
    dateGoLive,
    participants,
    risquesText,
    tachesText,
  }
}

const PHASE_TEMPLATES = {
  kickoff: {
    notes: (data) => `KICK-OFF - LANCEMENT OFFICIEL

1) CONTEXTE ET OBJECTIF
- Objectif principal: ${data.objectif || 'À définir'}
- Enjeux métier:
- Vision produit:
- Indicateurs de succès:

2) PÉRIMÈTRE
- Inclus: ${data.perimetre || 'À préciser'}
- Hors périmètre:
- Hypothèses de départ:
- Contraintes techniques/métier:

3) GOUVERNANCE ET ROLES (RACI)
${data.roles || '- Sponsor / Executive Steering: [NOM]\n- Chef(fe) de projet: [NOM]\n- Referents métier: [NOMS]\n- Lead technique: [NOM]'}

4) JALONS MAJEURS
${data.jalons || '- Jalon 1: Cadrage - J+15\n- Jalon 2: Design - J+30\n- Jalon 3: Construction - J+60\n- Jalon 4: UAT - J+75\n- Jalon 5: Go-live - J+85'}

5) PLAN 30 JOURS
- S1: Cadrage détaillé et planning
- S2: Validation architecture et design
- S3: Lancement construction
- S4: Premiers livrables + COPIL suivi

6) RISQUES INITIAUX
- Risque 1: [description] | Impact: [H/M/B] | Mitigation: [action]
- Risque 2:`,
    decisions: `DECISIONS DE KICK-OFF
✓ Gouvernance validée (Sponsor, COPIL, fréquence)
✓ Périmètre V1 validé et signé
✓ Planning et jalons validés
✓ Rôles RACI validés
✓ Communication et escalade définies
✓ Budget et ressources alloués`,
    actions: `ACTIONS A LANCER
- [CP] Finaliser planning détaillé - J+3
- [Sponsor] Valider budget/périmètre - J+5
- [Équipe] Mettre en place infrastructure - J+5
- [Lead Tech] Présenter architecture - J+7
- [CP] Diffuser RACI et ressources - J+7`,
  },
  poc: {
    notes: (data) => `POINT POC - PROOF OF CONCEPT

1) OBJECTIFS DU POC
- Valider faisabilité technique de: ${data.objectif || 'À définir'}
- Points de validation clés:
- Critères d'acceptation POC:

2) PERIMETRE DU POC
- Inclus: ${data.perimetre || 'À préciser'}
- Hors périmètre:
- Environnement de test:

3) RESULTATS TECHNIQUES
- Composant/feature validé: [description + status]
- Intégrations testées: [liste]
- Performances mesurées: [chiffres]
- Aspects non-fonctionnels: [sécurité, scalabilité, etc.]

4) RISQUES TECHNIQUES IDENTIFIES
- Risque technique 1: [description] | Impact: [solution]
- Risque 2:

5) DECISION: GO / NO-GO / GO AVEC CONDITIONS
- Avis technique: [GO / CONDITIONNEL / NO-GO]
- Conditions si applicables: [liste]`,
    decisions: `DECISIONS POST-POC
✓ Architecture POC approuvée
✓ Stack technique validée
✓ Risques techniques levés ou mitigations en place
✓ DECISION FINALE: [GO / NO-GO / GO AVEC CONDITIONS]`,
    actions: `ACTIONS POST-POC
- [Lead Tech] Documenter POC et architecture cible - J+5
- [Sponsor] Autoriser phase construction si GO - J+3
- [Équipe] Préparer environnement dev - J+7`,
  },
  dev: {
    notes: (data) => `POINT DE SUIVI DÉVELOPPEMENT

1) AVANCEMENT GÉNÉRAL
- % d'avancement global: [X%]
- Itération/sprint: [N°]
- Livrables cette semaine: [liste]

2) LIVRABLES COMPLETES
- Feature 1: [description + statut] ✓
- Feature 2:
- État du code: [master/stable]
- Tests unitaires: [coverage %]

3) EN COURS / BLOCAGES
- Tâche 1: [% fait, blocages s'il y en a]
- Tâche 2:
- Dépendances externes:

4) INDICATEURS QUALITÉ
- Bugs critiques: [nombre]
- Tests unitaires passants: [% / total]
- Code coverage: [%]
- Dépendances de sécurité: [OK / alertes]

5) RISQUES ET BLOCAGES
- Blocage 1: [description] | Impact: [X jours] | Mitigation: [action]`,
    decisions: `DECISIONS DE SUIVI DEV
✓ Livrables acceptés / à corriger
✓ Qualité conforme / À améliorer
✓ Planning maintenu / À réajuster
✓ Autorisation de continuer dev`,
    actions: `ACTIONS DE SUIVI DEV
- [Lead Dev] Corriger bugs critiques - [date]
- [Équipe] Augmenter coverage tests - [date]
- [Sponsor] Approuver réajustement planning - [date]`,
  },
  uat: {
    notes: (data) => `POINT DE SUIVI TEST ET UAT

1) CAMPAGNES DE TEST
- Test fonctionnel: [% avancement]
- Test d'intégration: [% avancement]
- Test utilisateur (UAT): [% avancement]
- Test performance: [status]
- Test sécurité: [status]

2) RESULTATS GLOBAUX
- Tests exécutés: [nombre]
- Tests réussis: [%]
- Défauts trouvés: [nombre]
  - Critiques: [nombre]
  - Majeurs: [nombre]
  - Mineurs: [nombre]

3) DEFAUTS CRITIQUES/MAJEURS
- Défaut 1: [description] | Status: [ouvert/en cours/fermé]
- Défaut 2:

4) FEEDBACK UTILISATEURS
- Points positifs:
- Points d'amélioration:
- Blocages pour les users:

5) READINESS POUR GO-LIVE
- État: [Go / Go conditionnel / Not ready]
- Plan de retour arrière: [Défini/À définir]`,
    decisions: `DECISIONS UAT
✓ Campagnes de test: [Réussi / À continuer]
✓ Défauts critiques: [Tous fermés / Acceptés]
✓ Acceptation utilisateur: [Obtenue / Conditionnelle]
✓ DECISION FINALE: [GO PROD / NON-GO]`,
    actions: `ACTIONS DE SUIVI UAT
- [QA Lead] Corriger défauts critiques - [date]
- [Dev] Déployer corrections en test - [date]
- [PO] Valider corrections - [date]`,
  },
  golive: {
    notes: (data) => `POINT DE SUIVI GO-LIVE ET DEPLOYMENT

1) STATUT DU DEPLOYMENT
- Date/heure: ${data.dateGoLive || '[date/heure]'}
- Status: [En cours / Réussi / Rollback]
- Durée indisponibilité: [X minutes]

2) CHECKLIST PRE-DEPLOYMENT
- Backup données: ✓
- Plan rollback: ✓
- Support on-site: ✓
- Monitoring activé: ✓
- Tests smoke: [En attente/En cours/Réussi]

3) INCIDENTS DURANT DEPLOYMENT
- Incident 1: [description] | Sévérité: [C/M/B] | Status: [Résolu/En cours]
- Incident 2:

4) POST-DEPLOYMENT VALIDATION
- Fonctionnalités critiques: [%]
- Données intégrées: [oui/non]
- Performance: [OK/À investiguer]
- Accès utilisateurs: [oui/non]

5) DECISION: GO LIVE REUSSI / ROLLBACK
- Status final: [REUSSI / ROLLBACK]`,
    decisions: `DECISIONS GO-LIVE
✓ Deployment: [REUSSI / ROLLBACK EFFECTUE]
✓ Systèmes: [OPERATIONNELS / DEGRADES]
✓ Incidents critiques: [Aucun / Tous gérés]
✓ Continuité: [Assurée / À restaurer]`,
    actions: `ACTIONS POST GO-LIVE
- [DevOps] Monitorer systèmes - 48h minimum
- [Support] Traiter incidents users - Priorité critique
- [Product] Communiquer stakeholders - Immédiat`,
  },
  postprod: {
    notes: (data) => `POINT POST-PRODUCTION ET STABILISATION

1) STATUS DE STABILISATION
- Jours post-deployment: [J+X]
- Uptime: [99.X%]
- Incidents: [nombre]

2) INCIDENTS TRAITES
- Incident 1: [description] | Sévérité: [C/M/B] | Status: [Résolu]
- Incident 2:

3) INCIDENTS EN SUIVI
- Incident critique: [description] | Depuis: [date] | ETA: [date]

4) PERFORMANCES EN PRODUCTION
- Temps réponse: [Xs]
- Disponibilité: [99.X%]
- Erreurs: [nombre]
- Ressources: [OK / À optimiser]

5) FEEDBACK UTILISATEURS
- Adoption: [% actifs]
- Satisfaction: [Score/10]
- Points positifs:
- Améliorations demandées:

6) READINESS TRANSITION SUPPORT
- Support IT formé: [oui/non]
- Documentation: [oui/non]
- Date transition: [date]`,
    decisions: `DECISIONS POST-PROD
✓ Solution stable pour support: [OUI / NON]
✓ Incidents critiques résolus: [OUI / NON]
✓ Performance acceptable: [OUI / À optimiser]
✓ Satisfaction users: [Acceptable / À améliorer]
✓ Transition support IT: [OUI / NON]`,
    actions: `ACTIONS DE STABILISATION
- [Support Prod] Monitoring intensif - J+14
- [Dev] Hotfixes si critiques - On-demand
- [Product] Collecter feedback users - Permanent`,
  },
  clotureretex: {
    notes: (data) => `BILAN ET CLÔTURE DU PROJET

1) ATTEINTE DES OBJECTIFS
- Objectif 1: [Atteint / Partiellement / Non atteint]
- Objectif 2:
- Indicateurs de succès mesurés: [résultats]

2) LIVRABLES ACCEPTES
- Livrable 1: [description] ✓
- Livrable 2:

3) INDICATEURS PROJET
- Délai: [À l'heure / Retard X jours / Avance]
- Budget: [Respecté / Dépensé / Sous-utilisé X%]
- Qualité: [Score / métrique]
- Satisfaction users: [Score/10]

4) LESSONS LEARNED - POINTS POSITIFS
- Point positif 1: [description]
- À reconduire:

5) LESSONS LEARNED - POINTS D'AMÉLIORATION
- Amélioration 1: [description + recommandation]
- À éviter:

6) RESSOURCES ET CONTINUITÉ
- Support transition: [Oui/Non - date]
- Maintenance: [Oui/Non - coûts]
- Évolutions futures: [Oui/Non - liste]

7) CLÔTURE ADMINISTRATIVE
- Contrats honorés: [Oui/Non]
- Docs archivées: [Oui/Non]`,
    decisions: `DECISIONS FINALES DE CLÔTURE
✓ Objectifs: [ATTEINTS / PARTIELS / NON ATTEINTS]
✓ Livrables: [ACCEPTES / RESERVES]
✓ Bilan financier: [APPROUVE]
✓ Lessons learned: [CAPITALISEES]
✓ PROJET CLOS
✓ Prochaines étapes: [PLANIFIEES]`,
    actions: `ACTIONS DE CLÔTURE
- [CP] Rapport clôture / lessons learned - [date]
- [PMO] Archiver documentation - [date]
- [RH] Libérer ressources - [date]
- [Finance] Clôturer budgets - [date]
- [Sponsor] Approver clôture - [date]`,
  },
}

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

function CopilForm({ initial, onSubmit, onCancel, saving, projet, projectContext }) {
  const isCreate = !initial
  const autoData = buildAutoPhaseData({ projet, ...projectContext })
  const [form, setForm] = useState(() => ({
    date_reunion: initial?.date_reunion ?? new Date().toISOString().slice(0, 10),
    heure_reunion: initial?.heure_reunion ?? '',
    titre: initial?.titre ?? '',
    participants: initial?.participants ?? (isCreate ? autoData.participants : ''),
    notes: initial?.notes ?? '',
    decisions: initial?.decisions ?? '',
    actions: initial?.actions ?? '',
  }))
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [showAdvancedTemplate, setShowAdvancedTemplate] = useState(false)
  const [phaseData, setPhaseData] = useState(() => ({
    objectif: autoData.objectif || '',
    perimetre: autoData.perimetre || '',
    roles: autoData.roles || '',
    jalons: autoData.jalons || '',
    dateGoLive: autoData.dateGoLive || '',
    risquesText: autoData.risquesText || '',
    tachesText: autoData.tachesText || '',
  }))

  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setPhaseDataF = (key) => (e) => setPhaseData((p) => ({ ...p, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalized = {
      ...form,
      titre: (form.titre ?? '').trim() || `Réunion COPIL - ${form.date_reunion || ''}`,
      notes: (form.notes ?? '').trim(),
    }
    onSubmit(normalized)
  }

  const applyTemplate = () => {
    if (!selectedPhase) return
    const template = PHASE_TEMPLATES[selectedPhase]
    if (!template) return
    const phaseName = PROJECT_PHASES.find((p) => p.id === selectedPhase)?.nom || 'Réunion'
    const mergedData = {
      ...autoData,
      ...phaseData,
      objectif: (phaseData.objectif || autoData.objectif || '').trim(),
      perimetre: (phaseData.perimetre || autoData.perimetre || '').trim(),
      roles: (phaseData.roles || autoData.roles || '').trim(),
      jalons: (phaseData.jalons || autoData.jalons || '').trim(),
      dateGoLive: (phaseData.dateGoLive || autoData.dateGoLive || '').trim(),
    }
    setForm((prev) => ({
      ...prev,
      titre: (prev.titre || '').trim() || `${phaseName} - ${prev.date_reunion || ''}`,
      participants: (prev.participants || '').trim() || autoData.participants || '',
      notes: template.notes(mergedData),
      decisions: template.decisions,
      actions: template.actions,
    }))
    setSelectedPhase(null)
  }

  const refreshAutoData = () => {
    setPhaseData((prev) => ({
      ...prev,
      objectif: prev.objectif || autoData.objectif || '',
      perimetre: prev.perimetre || autoData.perimetre || '',
      roles: prev.roles || autoData.roles || '',
      jalons: prev.jalons || autoData.jalons || '',
      dateGoLive: prev.dateGoLive || autoData.dateGoLive || '',
      risquesText: prev.risquesText || autoData.risquesText || '',
      tachesText: prev.tachesText || autoData.tachesText || '',
    }))
    setForm((prev) => ({
      ...prev,
      participants: prev.participants || autoData.participants || '',
    }))
  }


  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base sm:text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Date de réunion *</label>
          <input type="date" className={inp} required value={form.date_reunion} onChange={setF('date_reunion')} />
        </div>
        <div>
          <label className={lbl}>Heure de réunion *</label>
          <input type="time" className={inp} required value={form.heure_reunion} onChange={setF('heure_reunion')} />
        </div>
      </div>

      <div>
        <label className={lbl}>Titre (optionnel)</label>
        <input className={inp} maxLength={200} value={form.titre} onChange={setF('titre')} placeholder="COPIL #12 - Suivi mensuel" />
        <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">Si vide, généré automatiquement.</p>
      </div>

      <div>
        <label className={lbl}>Participants</label>
        <input className={inp} value={form.participants} onChange={setF('participants')} placeholder="Thalïa, Louis-Marie, Client X" />
      </div>

      {isCreate && (
        <section className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">Assistant COPIL - Choisissez une phase</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Préremplissage automatique pour gagner du temps.</p>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {PROJECT_PHASES.map((phase) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => setSelectedPhase(selectedPhase === phase.id ? null : phase.id)}
                className={`relative rounded-lg p-3 transition-all font-semibold text-slate-900 dark:text-slate-100 text-center group flex flex-col items-center gap-2
                  ${selectedPhase === phase.id
                    ? `${phase.color} shadow-lg ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-gray-400`
                    : `${phase.color} opacity-75 hover:opacity-100`
                  }`}
              >
                {PHASE_ICONS[phase.id]}
                <div className="text-[10px] font-semibold leading-tight">{phase.nom}</div>
              </button>
            ))}
          </div>

          {selectedPhase && (
            <div className="rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 p-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvancedTemplate((v) => !v)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAdvancedTemplate ? 'Masquer les options avancées' : 'Afficher les options avancées'}
              </button>

              {showAdvancedTemplate && (
                <>
                  <button
                    type="button"
                    onClick={refreshAutoData}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Réinjecter les données projet
                  </button>

                  {selectedPhase === 'kickoff' && (
                    <>
                      <input className={inp} value={phaseData.objectif} onChange={setPhaseDataF('objectif')} placeholder="Objectif du projet" />
                      <input className={inp} value={phaseData.perimetre} onChange={setPhaseDataF('perimetre')} placeholder="Périmètre" />
                      <textarea className={`${inp} min-h-12`} value={phaseData.jalons} onChange={setPhaseDataF('jalons')} placeholder="Jalons (un par ligne)" />
                    </>
                  )}
                  {selectedPhase === 'poc' && (
                    <input className={inp} value={phaseData.objectif} onChange={setPhaseDataF('objectif')} placeholder="Objectif du POC" />
                  )}
                  {selectedPhase === 'golive' && (
                    <input className={inp} type="datetime-local" value={phaseData.dateGoLive} onChange={setPhaseDataF('dateGoLive')} placeholder="Date/heure go-live" />
                  )}
                </>
              )}

              <button
                type="button"
                onClick={applyTemplate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
              >
                Préremplir la réunion
              </button>
            </div>
          )}
        </section>
      )}

      <div>
        <label className={lbl}>Notes de réunion {isCreate ? '*' : ''}</label>
        <textarea className={`${inp} min-h-24`} required={isCreate} value={form.notes} onChange={setF('notes')} placeholder="Contexte, points clés, blocages..." />
      </div>

      <div>
        <label className={lbl}>Décisions</label>
        <textarea className={`${inp} min-h-20`} value={form.decisions} onChange={setF('decisions')} placeholder="Décisions actées en COPIL..." />
      </div>

      <div>
        <label className={lbl}>Actions de suivi</label>
        <textarea className={`${inp} min-h-20`} value={form.actions} onChange={setF('actions')} placeholder="Qui fait quoi pour quand..." />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 dark:border-slate-600 rounded-lg py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Annuler</button>
        <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-semibold transition-colors">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export default function CopilPage() {
  const { projet, estLecteur } = useProject()
  const [items, setItems] = useState([])
  const [expandedCopilId, setExpandedCopilId] = useState(null)
  const [projectContext, setProjectContext] = useState({ cdc: {}, equipe: [], taches: [], risques: [] })
  const [notesByCopil, setNotesByCopil] = useState({})
  const [noteDraftByCopil, setNoteDraftByCopil] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [notif, setNotif] = useState({ msg: '', type: 'ok' })
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try {
      const [copilsRes, cdcRes, equipeRes, tachesRes, risquesRes] = await Promise.all([
        getCopils(projet.id),
        getCdc(projet.id).catch(() => ({ data: {} })),
        getEquipe(projet.id).catch(() => ({ data: [] })),
        getTaches(projet.id).catch(() => ({ data: [] })),
        getRisques(projet.id).catch(() => ({ data: [] })),
      ])
      const copilItems = copilsRes.data || []
      setItems(copilItems)
      setProjectContext({
        cdc: parseCdcContent(cdcRes.data),
        equipe: equipeRes.data || [],
        taches: tachesRes.data || [],
        risques: risquesRes.data || [],
      })
    } catch {
      notify('Erreur lors du chargement des réunions COPIL.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projet.id])

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtDateTimeTs = (iso) => new Date(iso).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtDateTime = (item) => {
    const date = fmtDate(item.date_reunion)
    if (!item.heure_reunion) return `${date} · --:--`
    return `${date} · ${String(item.heure_reunion).slice(0, 5)}`
  }

  const handleAdd = async (data) => {
    setSaving(true)
    try {
      await createCopil(projet.id, data)
      await load()
      setAddOpen(false)
      notify('Réunion COPIL ajoutée.')
    } catch {
      notify('Erreur lors de la création.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    try {
      await updateCopil(editItem.id, data)
      await load()
      setEditItem(null)
      notify('Réunion COPIL mise à jour.')
    } catch {
      notify('Erreur lors de la modification.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await deleteCopil(deleteItem.id)
      await load()
      setDeleteItem(null)
      notify('Réunion COPIL supprimée.')
    } catch {
      notify('Erreur lors de la suppression.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddNote = async (copilId) => {
    const contenu = (noteDraftByCopil[copilId] || '').trim()
    if (!contenu) return
    setSavingNote(true)
    try {
      const { data } = await createCopilNote(copilId, { contenu })
      setNotesByCopil((prev) => ({ ...prev, [copilId]: [data, ...(prev[copilId] || [])] }))
      setNoteDraftByCopil((prev) => ({ ...prev, [copilId]: '' }))
    } catch {
      notify('Erreur lors de l\'ajout de la note.', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  const loadNotesForCopil = async (copilId) => {
    try {
      const { data } = await getCopilNotes(copilId)
      setNotesByCopil((prev) => ({ ...prev, [copilId]: data || [] }))
    } catch {
      notify('Erreur lors du chargement des notes.', 'error')
    }
  }

  const toggleDetails = async (copilId) => {
    const next = expandedCopilId === copilId ? null : copilId
    setExpandedCopilId(next)
    if (next && !notesByCopil[copilId]) {
      await loadNotesForCopil(copilId)
    }
  }

  const preview = (text) => {
    const val = (text || '').trim()
    if (!val) return '—'
    return val.length > 90 ? `${val.slice(0, 90)}...` : val
  }

  const handleDeleteNote = async (copilId, noteId) => {
    setSavingNote(true)
    try {
      await deleteCopilNote(noteId)
      setNotesByCopil((prev) => ({ ...prev, [copilId]: (prev[copilId] || []).filter((n) => n.id !== noteId) }))
    } catch {
      notify('Erreur lors de la suppression de la note.', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 10h8M8 14h6"/><rect x="3" y="4" width="18" height="16" rx="2"/>
          </svg>
          Suivi COPIL
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          hidden={estLecteur}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Ajouter une réunion</span>
        </button>
      </div>

      <Notification {...notif} />

      {loading ? (
        <div className="text-center py-14 text-sm text-gray-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Aucune réunion COPIL enregistrée pour ce projet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDateTime(it)}</p>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{it.titre}</h3>
                  {it.participants && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Participants : {it.participants}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleDetails(it.id)} className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">{expandedCopilId === it.id ? 'Fermer' : 'Ouvrir'}</button>
                  {!estLecteur && (
                    <>
                      <button onClick={() => setEditItem(it)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Modifier</button>
                      <button onClick={() => setDeleteItem(it)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Supprimer</button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Synthèse</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{preview(it.notes)}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Décisions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{preview(it.decisions)}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Actions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{preview(it.actions)}</p>
                </section>
              </div>

              {expandedCopilId === it.id && (
                <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-3">
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{it.notes || '—'}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Décisions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{it.decisions || '—'}</p>
                </section>
                <section className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Actions</p>
                  <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{it.actions || '—'}</p>
                </section>
              </div>

              <section className="mt-3 rounded-lg border border-gray-100 dark:border-slate-700 p-3 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Journal de notes</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{(notesByCopil[it.id] || []).length} note(s)</p>
                </div>

                {!estLecteur && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <textarea
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-16"
                      value={noteDraftByCopil[it.id] || ''}
                      onChange={(e) => setNoteDraftByCopil((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      placeholder="Ajouter une note rapide de réunion..."
                    />
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={() => handleAddNote(it.id)}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                    >
                      Ajouter
                    </button>
                  </div>
                )}

                {(notesByCopil[it.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">Aucune note pour cette réunion.</p>
                ) : (
                  <div className="space-y-2">
                    {(notesByCopil[it.id] || []).map((note) => (
                      <div key={note.id} className="rounded-md border border-gray-200 dark:border-slate-700 p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDateTimeTs(note.created_at)}</p>
                          {!estLecteur && (
                            <button
                              onClick={() => handleDeleteNote(it.id, note.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{note.contenu}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal open={addOpen} title="Nouvelle réunion COPIL" onClose={() => setAddOpen(false)}>
          <CopilForm
            initial={null}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
            saving={saving}
            projet={projet}
            projectContext={projectContext}
          />
        </Modal>
      )}

      {editItem && (
        <Modal open={!!editItem} title="Modifier la réunion COPIL" onClose={() => setEditItem(null)}>
          <CopilForm
            initial={editItem}
            onSubmit={handleEdit}
            onCancel={() => setEditItem(null)}
            saving={saving}
            projet={projet}
            projectContext={projectContext}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer la réunion COPIL"
        message={`Supprimer "${deleteItem?.titre ?? ''}" ?`}
        confirmText="Supprimer"
        cancelText="Annuler"
        danger
        loading={saving}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
