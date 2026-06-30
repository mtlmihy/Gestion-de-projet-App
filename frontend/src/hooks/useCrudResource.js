import { useCallback, useState } from 'react'

// Notification éphémère (auto-effacée après 3.5s) — pattern dupliqué tel quel
// dans RisquesPage, TachesPage, CopilPage, EquipePage avant extraction.
export function useNotify() {
  const [notif, setNotif] = useState({ msg: '', type: 'ok' })
  const notify = useCallback((msg, type = 'ok') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif({ msg: '', type: 'ok' }), 3500)
  }, [])
  return { notif, notify }
}

// Charge une liste de ressources et factorise le pattern
// loading/saving + try/catch/finally/notify répété sur chaque page CRUD.
//
// fetchList doit être mémoïsé côté appelant (useCallback), pour que `load`
// ne se recrée que lorsque ses vraies dépendances (ex: projet.id) changent.
export function useCrudResource(fetchList, loadErrorMsg = 'Erreur lors du chargement.') {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { notif, notify } = useNotify()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await fetchList()
      setItems(data)
    } catch {
      notify(loadErrorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }, [fetchList, notify, loadErrorMsg])

  // Exécute une mutation (create/update/delete), recharge la liste, notifie.
  // Retourne true en cas de succès (pour fermer modal/reset état côté appelant).
  const runMutation = useCallback(async (action, successMsg, errorMsg) => {
    setSaving(true)
    try {
      await action()
      await load()
      notify(successMsg)
      return true
    } catch {
      notify(errorMsg, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [load, notify])

  return { items, setItems, loading, saving, notif, notify, load, runMutation }
}
