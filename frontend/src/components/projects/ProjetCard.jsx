import StatutBadge from './StatutBadge'
import RoleBadge from './RoleBadge'

export default function ProjetCard({ projet, onSelect, onGererAcces, isAdmin, isPinned, onTogglePin }) {
  const estProprietaire = isAdmin || projet.mon_role === 'Proprietaire'
  return (
    <div
      onClick={() => onSelect(projet)}
      className={`group relative bg-white dark:bg-slate-800 border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer p-5 flex flex-col gap-3 ${
        projet.est_cloture
          ? 'border-gray-300 dark:border-slate-600 opacity-80 hover:border-gray-400 dark:hover:border-slate-500'
          : isPinned
            ? 'border-amber-300 dark:border-amber-500/60 ring-1 ring-amber-200 dark:ring-amber-500/30 hover:border-amber-400 dark:hover:border-amber-400'
            : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
      }`}
    >
      {/* Badge clôturé */}
      {projet.est_cloture && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Clôturé
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(projet.id) }}
            title={isPinned ? 'Désépingler' : 'Épingler en haut de la liste'}
            aria-label={isPinned ? 'Désépingler le projet' : 'Épingler le projet'}
            aria-pressed={isPinned}
            className={`shrink-0 mt-0.5 p-1 rounded-md transition-all ${
              isPinned
                ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                : 'text-gray-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400'
            }`}
          >
            {isPinned ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M14 2l8 8-4 1-3 3 1 5-4-3-7 7-1-1 7-7-3-4 5 1 3-3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2l8 8-4 1-3 3 1 5-4-3-7 7-1-1 7-7-3-4 5 1 3-3z" />
              </svg>
            )}
          </button>
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {projet.nom}
          </h3>
        </div>
        {!projet.est_cloture && <StatutBadge statut={projet.statut} />}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
        {projet.description || <span className="italic text-gray-300">Aucune description</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <RoleBadge role={projet.mon_role} />
        <div className="flex items-center gap-1">
          {estProprietaire && (
            <button
              onClick={(e) => { e.stopPropagation(); onGererAcces(projet) }}
              className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg transition-colors"
              title="Paramètres du projet"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
