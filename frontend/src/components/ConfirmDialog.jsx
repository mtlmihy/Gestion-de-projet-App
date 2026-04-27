import Modal from './Modal'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm">
      <p className="text-gray-600 dark:text-slate-300 mb-6 text-sm">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium"
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Confirmer
        </button>
      </div>
    </Modal>
  )
}
