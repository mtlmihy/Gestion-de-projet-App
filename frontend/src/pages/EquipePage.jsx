import { useState, useEffect } from 'react'
import { getEquipe, createMembre, updateMembre, deleteMembre } from '../api/equipe'
import { useProject } from '../context/ProjectContext'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import MembreForm from '../components/MembreForm'

function Notification({ msg, type }) {
  if (!msg) return null
  const bg = type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm font-medium ${bg}`}>{msg}</div>
}

const AVATAR_COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-cyan-500']

function Avatar({ name, size = 'sm' }) {
  const initials = name.split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')
  const color    = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  const sz       = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-8 h-8 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${color} ${sz}`}>
      {initials}
    </span>
  )
}

/* ─── Org chart ──────────────────────────────────────────────── */

/**
 * Construit un forêt (liste de racines) depuis la liste plate des membres.
 * Un membre est une racine si son manager n'est pas dans la liste.
 */
function buildTree(members) {
  const byName = {}
  members.forEach((m) => { byName[m.collaborateur] = { ...m, children: [] } })

  const roots = []
  members.forEach((m) => {
    const node = byName[m.collaborateur]
    if (m.manager && byName[m.manager]) {
      byName[m.manager].children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function OrgCard({ node, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-3 w-40 text-center group hover:border-blue-300 hover:shadow-md transition-all">
      <Avatar name={node.collaborateur} size="lg" />
      <p className="text-sm font-semibold text-gray-900 truncate mt-2 leading-tight">{node.collaborateur}</p>
      {node.poste && <p className="text-xs text-gray-400 truncate mt-0.5">{node.poste}</p>}
      {/* Actions visibles au survol */}
      <div className="flex justify-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(node)}
          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          title="Modifier"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          onClick={() => onDelete(node)}
          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
          title="Supprimer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function OrgNode({ node, onEdit, onDelete }) {
  return (
    <div className="flex flex-col items-center">
      <OrgCard node={node} onEdit={onEdit} onDelete={onDelete} />
      {node.children.length > 0 && (
        <>
          <div className="org-parent-connector" />
          <div className="org-children">
            {node.children.map((child) => (
              <div key={child.id} className="org-child-cell">
                <OrgNode node={child} onEdit={onEdit} onDelete={onDelete} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OrgChart({ equipe, onEdit, onDelete }) {
  const roots = buildTree(equipe)
  if (roots.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Aucun membre enregistré.
      </div>
    )
  }
  return (
    <div className="overflow-auto py-8 px-6">
      <div className="flex gap-12 justify-center min-w-fit">
        {roots.map((root) => (
          <OrgNode key={root.id} node={root} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function EquipePage() {
  const { projet } = useProject()
  const [equipe,     setEquipe]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [notif,      setNotif]      = useState({ msg: '', type: 'ok' })
  const [addOpen,    setAddOpen]    = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [tab,        setTab]        = useState('organigramme')   // 'grille' | 'organigramme'

  const notify = (msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }

  const load = async () => {
    setLoading(true)
    try   { const { data } = await getEquipe(projet.id); setEquipe(data) }
    catch { notify('Erreur lors du chargement.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (data) => {
    setSaving(true)
    try   { await createMembre(projet.id, data); await load(); setAddOpen(false); notify('Membre ajouté.') }
    catch { notify("Erreur lors de l'ajout.", 'error') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    try   { await updateMembre(editItem.id, data); await load(); setEditItem(null); notify('Membre modifié.') }
    catch { notify('Erreur lors de la modification.', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try   { await deleteMembre(deleteItem.id); await load(); setDeleteItem(null); notify('Membre supprimé.') }
    catch { notify('Erreur lors de la suppression.', 'error') }
    finally { setSaving(false) }
  }

  const managers = [...new Set(equipe.map((m) => m.manager).filter(Boolean))]

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/>
          </svg>
          Équipe
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">＋</span> Ajouter un membre
        </button>
      </div>

      <Notification {...notif} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Membres"        value={equipe.length} />
        <KpiCard label="Managers"       value={managers.length} colorClass="text-blue-600" />
        <KpiCard label="Postes uniques" value={new Set(equipe.map((m) => m.poste).filter(Boolean)).size} colorClass="text-purple-600" />
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'organigramme', label: 'Organigramme' },
          { id: 'grille',       label: 'Grille' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Chargement…</div>

      ) : tab === 'grille' ? (
        equipe.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center h-32 text-gray-400 text-sm">
            Aucun membre enregistré.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipe.map((m) => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.collaborateur} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{m.collaborateur}</p>
                      {m.poste && <p className="text-xs text-gray-500">{m.poste}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditItem(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Modifier">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button onClick={() => setDeleteItem(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Supprimer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  {m.manager && <p><span className="font-medium text-gray-400">Manager : </span>{m.manager}</p>}
                  {m.email   && <p><span className="font-medium text-gray-400">Email : </span><a href={`mailto:${m.email}`} className="text-blue-600 hover:underline">{m.email}</a></p>}
                  {m.numero  && <p><span className="font-medium text-gray-400">Tél. : </span>{m.numero}</p>}
                </div>
              </div>
            ))}
          </div>
        )

      ) : (
        /* ── Organigramme ── */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-48">
          <OrgChart equipe={equipe} onEdit={setEditItem} onDelete={setDeleteItem} />
        </div>
      )}

      {/* Modals */}
      <Modal open={addOpen} title="Ajouter un membre" onClose={() => setAddOpen(false)} size="md">
        <MembreForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={saving} />
      </Modal>

      <Modal open={!!editItem} title="Modifier le membre" onClose={() => setEditItem(null)} size="md">
        <MembreForm initial={editItem} onSubmit={handleEdit} onCancel={() => setEditItem(null)} loading={saving} />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Supprimer le membre"
        message={`Supprimer "${deleteItem?.collaborateur}" de l'équipe ?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}
