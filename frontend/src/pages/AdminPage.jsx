import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import UsersTab from '../components/admin/UsersTab'
import PermissionsTab from '../components/admin/PermissionsTab'

// ── Page principale Administration ───────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('users')

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-slate-200">Accès réservé aux administrateurs</h1>
      </div>
    )
  }

  const tabs = [
    { id: 'users',       label: 'Utilisateurs' },
    { id: 'permissions', label: 'Permissions' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-slate-100">Administration</div>
          <div className="text-xs text-gray-400 dark:text-slate-500">Comptes, rôles et accès aux projets</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm p-6">
          <UsersTab currentUser={user} />
        </div>
      )}
      {tab === 'permissions' && <PermissionsTab />}
    </div>
  )
}
