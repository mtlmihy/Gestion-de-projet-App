/**
 * Export CSV via Blob - aucune dépendance externe.
 * @param {string}   filename  - nom du fichier sans extension (ou avec .csv)
 * @param {string[]} headers   - noms des colonnes
 * @param {Array[]}  rows      - tableau de tableaux de valeurs
 */
export function exportCSV(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ]
  // BOM UTF-8 pour l'ouverture correcte dans Excel
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
