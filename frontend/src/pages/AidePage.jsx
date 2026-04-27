const SECTIONS = [
  {
    title: 'Registre des Risques',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    items: [
      'Ajoutez des risques via le bouton « Ajouter un risque ».',
      'La priorité (P1/P2/P3) est calculée automatiquement : Probabilité × Impact.',
      'Filtrez par statut, priorité, probabilité, impact ou identifiant.',
      'P3 = risque critique (score ≥ 6), P2 = modéré (score ≥ 3), P1 = faible.',
      'Passez les risques traités en statut « Fermé » pour les archiver.',
    ],
  },
  {
    title: 'Suivi des Tâches',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    items: [
      'Créez des tâches et assignez-les à un collaborateur de l\'équipe.',
      'Associez chaque tâche à un jalon pour l\'afficher dans le Planning.',
      'L\'avancement (0–100 %) est mis à jour via le curseur dans le formulaire.',
      'Les tâches « Critique » sont remontées dans les KPIs.',
    ],
  },
  {
    title: 'Planning',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    items: [
      'La timeline est construite à partir des jalons du Cahier des Charges.',
      'Les tâches sont groupées sous leur jalon correspondant.',
      'Un point bleu indique le jalon du jour, vert = passé, gris = futur.',
      'Définissez les jalons dans la page « Cahier des Charges ».',
    ],
  },
  {
    title: 'Cahier des Charges',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    items: [
      'Remplissez le cahier des charges section par section.',
      'Cliquez sur « Sauvegarder » pour enregistrer en base de données.',
      'La section Jalons alimente directement la page Planning.',
      'L\'historique des versions permet de tracer les évolutions du document.',
    ],
  },
  {
    title: 'Équipe',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    items: [
      'Gérez les membres de l\'équipe : collaborateur, poste, manager, contact.',
      'Les noms de collaborateurs peuvent être utilisés dans le champ « Assigné » des tâches.',
      'L\'avatar est généré automatiquement à partir des initiales.',
    ],
  },
  {
    title: 'Accès & Sécurité',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    items: [
      'L\'accès est protégé par un mot de passe (hash SHA-256 en base).',
      'Le JWT est stocké dans un cookie HttpOnly — invisible depuis JavaScript.',
      'La session expire automatiquement après 8 heures.',
      'Utilisez le bouton « Déconnexion » pour mettre fin à la session.',
    ],
  },
]

export default function AidePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Aide Pilotage
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map(({ title, icon, items }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600">{icon}</span>
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            </div>
            <ul className="space-y-1.5">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Légende priorités */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Matrice Probabilité × Impact</h2>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500"></th>
                {['Faible', 'Moyen', 'Élevé'].map((i) => (
                  <th key={i} className="border border-gray-200 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500">{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Élevée',  '🟡 P2 (6)', '🔴 P3 (6)', '🔴 P3 (9)'],
                ['Moyenne', '🟢 P1 (2)', '🟡 P2 (4)', '🔴 P3 (6)'],
                ['Faible',  '🟢 P1 (1)', '🟢 P1 (2)', '🟡 P2 (3)'],
              ].map(([proba, ...cells]) => (
                <tr key={proba}>
                  <td className="border border-gray-200 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500">{proba}</td>
                  {cells.map((c, ci) => (
                    <td key={ci} className="border border-gray-200 px-3 py-2 text-center text-xs">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">Probabilité (ligne) × Impact (colonne) = Score → P1 (&lt;3) / P2 (3–5) / P3 (≥6)</p>
        </div>
      </div>
    </div>
  )
}
