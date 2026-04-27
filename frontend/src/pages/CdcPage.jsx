import { useState, useEffect } from 'react'
import { getCdc, updateCdc } from '../api/cdc'
import { useProject } from '../context/ProjectContext'

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

// ── Helpers export PDF / Charte Projet ───────────────────────────────────────
function escH(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pvTextBlock(text) {
  const hasText = text && text.trim()
  const bLeft   = hasText ? '#2563eb' : '#e2e8f0'
  const color   = hasText ? '#374151' : '#94a3b8'
  const content = hasText
    ? `<pre style="font-family:inherit;font-size:10px;white-space:pre-wrap;line-height:1.65;margin:0;">${escH(text)}</pre>`
    : '—'
  return `<div style="font-size:10px;color:${color};line-height:1.65;padding:10px 14px;background:#f8fafc;border-left:3px solid ${bLeft};border-radius:0 6px 6px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${content}</div>`
}

function buildPrintViewHtml(cdc) {
  const dv   = s => s || '—'
  const today = new Date().toLocaleDateString('fr-FR')
  const thS  = 'background:#f1f5f9;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:7px 10px;border:1px solid #e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;'

  const histRows = (cdc.history || []).map(row => {
    const d = row[3] ? new Date(row[3]).toLocaleDateString('fr-FR') : '—'
    return `<tr>
      <td style="padding:6px 10px;border:1px solid #e9eef5;font-weight:700;color:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escH(dv(row[0]))}</td>
      <td style="padding:6px 10px;border:1px solid #e9eef5;">${escH(dv(row[1]))}</td>
      <td style="padding:6px 10px;border:1px solid #e9eef5;">${escH(dv(row[2]))}</td>
      <td style="padding:6px 10px;border:1px solid #e9eef5;">${escH(d)}</td>
    </tr>`
  }).join('') || '<tr><td colspan="4" style="padding:12px;border:1px solid #e9eef5;color:#94a3b8;text-align:center;">Aucune version renseignée</td></tr>'

  const jalonRows = (cdc.jalons || []).filter(r => r[0] || r[1] || r[2]).map(row => {
    const d = row[1] ? new Date(row[1]).toLocaleDateString('fr-FR') : '—'
    return `<tr>
      <td style="padding:6px 10px;border:1px solid #e9eef5;font-weight:600;color:#1e293b;">${escH(dv(row[0]))}</td>
      <td style="padding:6px 10px;border:1px solid #e9eef5;color:#2563eb;font-weight:500;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escH(d)}</td>
      <td style="padding:6px 10px;border:1px solid #e9eef5;">${escH(dv(row[2]))}</td>
    </tr>`
  }).join('') || '<tr><td colspan="3" style="padding:12px;border:1px solid #e9eef5;color:#94a3b8;text-align:center;">Aucun jalon renseigné</td></tr>'

  const snum = (n, type) => {
    const bg  = type === 'risk' ? '#ef4444' : type === 'hist' ? '#f1f5f9' : '#2563eb'
    const col = type === 'hist' ? '#64748b' : '#fff'
    return `<div style="width:22px;height:22px;background:${bg};color:${col};border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${n}</div>`
  }
  const shdr = (n, title, type) =>
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0;">${snum(n, type)}<div style="font-size:11px;font-weight:700;color:#1e293b;">${title}</div></div>`

  const infoStrip = [
    ['Chef de Projet', cdc.chef_projet],
    ['Sponsor', cdc.sponsor],
    ['Service', cdc.service],
    ['Référence', cdc.reference],
    ["Date d'édition", today],
  ].map(([lbl, val], i) =>
    `<div style="padding:10px 12px;${i < 4 ? 'border-right:1px solid #e2e8f0;' : ''}">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:3px;">${lbl}</div>
      <div style="font-size:10px;font-weight:600;color:#1e293b;">${escH(i === 4 ? today : dv(val))}</div>
    </div>`
  ).join('')

  return `<div style="font-family:'Inter',sans-serif;font-size:10px;color:#1e293b;line-height:1.5;background:#fff;">
    <div style="background:#0f172a;padding:26px 36px 22px;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div>
        <div style="color:#475569;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin-bottom:5px;">Document de cadrage · Confidentiel</div>
        <div style="color:#fff;font-size:21px;font-weight:800;letter-spacing:-.4px;line-height:1.1;">Cahier des Charges</div>
        <div style="color:#3b82f6;font-size:13px;font-weight:600;margin-top:5px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escH(dv(cdc.nom_projet))}</div>
        <div style="color:#64748b;font-size:8.5px;margin-top:8px;">Réf. ${escH(dv(cdc.reference))} · ${today}</div>
      </div>
    </div>
    <div style="background:#f8fafc;border-bottom:3px solid #2563eb;padding:0 36px;display:grid;grid-template-columns:repeat(5,1fr);-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      ${infoStrip}
    </div>
    <div style="padding:20px 36px;">
      <div style="margin-bottom:18px;">${shdr('H', 'Historique des versions', 'hist')}
        <table style="width:100%;border-collapse:collapse;font-size:9.5px;"><thead><tr>
          <th style="${thS}width:72px;">Version</th><th style="${thS}width:130px;">Auteur</th>
          <th style="${thS}">Description</th><th style="${thS}width:100px;">Date</th>
        </tr></thead><tbody>${histRows}</tbody></table>
      </div>
      <div style="margin-bottom:18px;">${shdr('1', 'Contexte du projet')}${pvTextBlock(cdc.contexte)}</div>
      <div style="margin-bottom:18px;">${shdr('2', 'Objectifs du projet')}${pvTextBlock(cdc.objectifs)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
        <div>${shdr('3', 'Périmètre')}${pvTextBlock(cdc.perimetre)}</div>
        <div>${shdr('4', 'Aspects fonctionnels')}${pvTextBlock(cdc.fonctionnel)}</div>
      </div>
      <div style="margin-bottom:18px;">${shdr('5', 'Aspects techniques')}${pvTextBlock(cdc.technique)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
        <div>${shdr('6', 'Ressources')}${pvTextBlock(cdc.ressources)}</div>
        <div>${shdr('R', 'Risques identifiés', 'risk')}${pvTextBlock(cdc.risques)}</div>
      </div>
      <div style="margin-bottom:18px;">${shdr('7', 'Jalons &amp; Planning')}
        <table style="width:100%;border-collapse:collapse;font-size:9.5px;"><thead><tr>
          <th style="${thS}width:35%;">Jalon / Phase</th>
          <th style="${thS}width:18%;">Date cible</th>
          <th style="${thS}">Description / Livrable</th>
        </tr></thead><tbody>${jalonRows}</tbody></table>
      </div>
      <div style="margin-bottom:18px;">${shdr('8', 'Budget')}${pvTextBlock(cdc.budget)}</div>
      <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;">
        <span>Cahier des Charges · ${escH(dv(cdc.nom_projet))} · ${escH(dv(cdc.service))}</span>
        <span>Généré le ${today} · Document confidentiel</span>
      </div>
    </div>
  </div>`
}

function buildCharterHtml(cdc) {
  const dv    = s => escH(s || '—')
  const today = new Date().toLocaleDateString('fr-FR')

  const bullets = text => {
    if (!text || !text.trim()) return '<p style="color:#94a3b8;">—</p>'
    return text.split('\n').filter(l => l.trim())
      .map(l =>
        `<div style="display:flex;gap:7px;margin-bottom:5px;align-items:flex-start;">` +
        `<span style="width:5px;height:5px;background:#94a3b8;border-radius:50%;margin-top:5px;flex-shrink:0;display:inline-block;"></span>` +
        `<span style="font-size:10.5px;color:#374151;line-height:1.55;">${escH(l.trim())}</span></div>`)
      .join('')
  }
  const numbered = text => {
    if (!text || !text.trim()) return '<p style="color:#94a3b8;">—</p>'
    return text.split('\n').filter(l => l.trim())
      .map((l, i) =>
        `<div style="display:flex;gap:8px;margin-bottom:5px;align-items:flex-start;">` +
        `<span style="min-width:18px;height:18px;background:#1e293b;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${i + 1}</span>` +
        `<span style="font-size:10.5px;color:#374151;line-height:1.55;">${escH(l.trim())}</span></div>`)
      .join('')
  }

  const th  = 'background:#f1f5f9;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:7px 10px;border:1px solid #e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;'
  const td  = 'padding:7px 10px;border:1px solid #e9eef5;'
  const tdL = td + 'font-weight:600;color:#1e293b;background:#f8fafc;'

  const jalonRows = (cdc.jalons || []).filter(r => r[0] || r[1] || r[2]).map(row => {
    const d = row[1] ? new Date(row[1]).toLocaleDateString('fr-FR') : '—'
    return `<tr><td style="${td}font-weight:600;color:#1e293b;">${escH(row[0] || '—')}</td><td style="${td}">${escH(d)}</td><td style="${td}">${escH(row[2] || '')}</td></tr>`
  }).join('') || `<tr><td colspan="3" style="${td}color:#94a3b8;text-align:center;">Aucun jalon renseigné</td></tr>`

  const secTitle = t =>
    `<div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1e293b;border-left:3px solid #1e293b;padding-left:8px;margin-bottom:10px;">${t}</div>`
  const box = content =>
    `<div style="background:#f8fafc;border:1px solid #e9eef5;border-radius:8px;padding:12px 14px;">${content}</div>`
  const sig = role =>
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">` +
    `<div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:4px;">${role}</div>` +
    `<div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:28px;">___________________________</div>` +
    `<div style="border-top:1px dashed #cbd5e1;margin-bottom:5px;"></div>` +
    `<div style="font-size:8.5px;color:#94a3b8;">Signature | Date : ___/___/______</div></div>`

  const infoCards = [
    ['Chef de Projet', cdc.chef_projet, cdc.service],
    ['Sponsor', cdc.sponsor, 'Commanditaire du projet'],
    ['Référence stratégique', cdc.reference, cdc.service],
  ].map(([lbl, val, sub]) =>
    box(`<div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;border-bottom:1.5px solid #e2e8f0;padding-bottom:5px;margin-bottom:10px;">${lbl}</div>` +
      `<div style="font-size:12px;font-weight:600;color:#1e293b;">${escH(val || '—')}</div>` +
      `<div style="font-size:10px;color:#64748b;margin-top:2px;">${escH(sub || '—')}</div>`)
  ).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><title>Charte de Projet — ${escH(cdc.nom_projet || 'Sans titre')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>*{font-family:'Inter',sans-serif;box-sizing:border-box;margin:0;padding:0;}body{background:#fff;color:#1e293b;font-size:11px;line-height:1.5;}.page{max-width:900px;margin:0 auto;padding:0 28px 40px;}.pbtn{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer;}@media print{.no-print{display:none!important;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
</head><body>
<div class="no-print" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:9px 20px;display:flex;justify-content:space-between;align-items:center;">
  <span style="font-size:10px;color:#64748b;">Charte de Projet · ${escH(cdc.nom_projet || 'Sans titre')} · ${today}</span>
  <div style="display:flex;gap:8px;">
    <button class="pbtn" style="background:#f1f5f9;color:#475569;" onclick="window.close()">✕ Fermer</button>
    <button class="pbtn" style="background:#1e293b;color:#fff;" onclick="window.print()">🖨 Imprimer / PDF</button>
  </div>
</div>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:28px 0 18px;border-bottom:3px solid #1e293b;margin-bottom:20px;">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-.4px;">Charte de Projet</h1>
      <p style="font-size:10px;color:#64748b;margin-top:4px;max-width:480px;line-height:1.6;">Ce document officialise les objectifs, le périmètre et les engagements du projet.<br/>Il doit être approuvé et signé par toutes les parties prenantes avant le démarrage.</p>
      <div style="display:flex;gap:20px;margin-top:12px;flex-wrap:wrap;">
        <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;">Projet</div><div style="font-size:11px;font-weight:600;color:#1e293b;margin-top:2px;">${dv(cdc.nom_projet)}</div></div>
        <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;">Référence</div><div style="font-size:11px;font-weight:600;color:#1e293b;margin-top:2px;">${dv(cdc.reference)}</div></div>
        <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;">Date d'émission</div><div style="font-size:11px;font-weight:600;color:#1e293b;margin-top:2px;">${today}</div></div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">${infoCards}</div>
  <div style="margin-bottom:18px;">${secTitle('Contexte du projet')}${box(`<div style="font-size:10.5px;color:#374151;line-height:1.65;">${escH(cdc.contexte || '—').replace(/\n/g, '<br/>')}</div>`)}</div>
  <div style="margin-bottom:18px;">${secTitle('Objectifs')}${box(bullets(cdc.objectifs))}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
    <div>${secTitle('Périmètre')}${box(bullets(cdc.perimetre))}</div>
    <div>${secTitle('Livrables attendus')}${box(numbered(cdc.fonctionnel))}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
    <div>${secTitle('Risques identifiés')}${box(numbered(cdc.risques))}</div>
    <div>${secTitle('Contraintes techniques')}${box(numbered(cdc.technique))}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
    <div>${secTitle('Ressources')}${box(bullets(cdc.ressources))}</div>
    <div>${secTitle('Budget')}${box(bullets(cdc.budget))}</div>
  </div>
  <div style="margin-bottom:18px;">${secTitle('Jalons &amp; Planning')}
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
      <thead><tr><th style="${th}width:35%">Jalon / Phase</th><th style="${th}width:18%">Date cible</th><th style="${th}">Description / Livrable</th></tr></thead>
      <tbody>${jalonRows}</tbody>
    </table>
  </div>
  <div style="margin-bottom:18px;">${secTitle('Comité de validation')}
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
      <thead><tr><th style="${th}width:30%">Rôle</th><th style="${th}width:35%">Nom</th><th style="${th}">Organisation</th></tr></thead>
      <tbody>
        <tr><td style="${tdL}">Chef de Projet</td><td style="${td}">${dv(cdc.chef_projet)}</td><td style="${td}">${dv(cdc.service)}</td></tr>
        <tr><td style="${tdL}">Sponsor</td><td style="${td}">${dv(cdc.sponsor)}</td><td style="${td}">${dv(cdc.service)}</td></tr>
        <tr><td style="${tdL}">Représentant MOA</td><td style="${td}">—</td><td style="${td}">—</td></tr>
        <tr><td style="${tdL}">Responsable Technique</td><td style="${td}">—</td><td style="${td}">—</td></tr>
      </tbody>
    </table>
  </div>
  <div style="margin-bottom:18px;">${secTitle('Approbation &amp; Signatures')}
    <p style="font-size:10px;color:#64748b;margin-bottom:14px;">En signant ce document, les soussignés confirment avoir pris connaissance du projet et s'engagent à soutenir sa réalisation dans le cadre défini.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;"><div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:4px;">Chef de Projet</div><div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:28px;">${dv(cdc.chef_projet)}</div><div style="border-top:1px dashed #cbd5e1;margin-bottom:5px;"></div><div style="font-size:8.5px;color:#94a3b8;">Signature | Date : ___/___/______</div></div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;"><div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:4px;">Sponsor</div><div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:28px;">${dv(cdc.sponsor)}</div><div style="border-top:1px dashed #cbd5e1;margin-bottom:5px;"></div><div style="font-size:8.5px;color:#94a3b8;">Signature | Date : ___/___/______</div></div>
      ${sig('Représentant Direction / MOA')}
      ${sig('Partie Prenante')}
      ${sig('Partie Prenante')}
      ${sig('Partie Prenante')}
    </div>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:24px;display:flex;justify-content:space-between;">
    <span style="font-size:8.5px;color:#94a3b8;">Charte de Projet · ${escH(cdc.nom_projet || '—')} · ${escH(cdc.service || '—')}</span>
    <span style="font-size:8.5px;color:#94a3b8;">Générée le ${today} · Document confidentiel</span>
  </div>
</div>
</body></html>`
}

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
  const { projet, estLecteur } = useProject()
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
    getCdc(projet.id)
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
      const { data } = await updateCdc(projet.id, JSON.stringify(cdc))
      setLastSaved(data.derniere_maj ? new Date(data.derniere_maj) : null)
      notify('Cahier des charges sauvegardé.')
    } catch {
      notify('Erreur lors de la sauvegarde.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Nettoyage du conteneur d'impression après impression
  useEffect(() => {
    const cleanup = () => {
      const el = document.getElementById('cdc-print-container')
      if (el) el.innerHTML = ''
    }
    window.addEventListener('afterprint', cleanup)
    return () => window.removeEventListener('afterprint', cleanup)
  }, [])

  // Export PDF via window.print()
  const handleExportPDF = () => {
    if (!document.getElementById('cdc-print-style')) {
      const style = document.createElement('style')
      style.id = 'cdc-print-style'
      style.textContent = `
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4; margin: 0; }
          #root { display: none !important; }
          #cdc-print-container { display: block !important; }
        }
      `
      document.head.appendChild(style)
    }
    let container = document.getElementById('cdc-print-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'cdc-print-container'
      document.body.appendChild(container)
    }
    container.innerHTML = buildPrintViewHtml(cdc)
    window.print()
  }

  // Génération de la Charte Projet dans une nouvelle fenêtre
  const handleOpenCharter = () => {
    const html = buildCharterHtml(cdc)
    const w = window.open('', '_blank')
    if (!w) { alert('Autorisez les popups pour générer la charte.'); return }
    w.document.write(html)
    w.document.close()
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
            hidden={estLecteur}
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
              <input className={inp} type="text" value={cdc[field] ?? ''} onChange={set(field)} placeholder={placeholder} disabled={estLecteur} />
            </div>
          ))}
          <div>
            <label className={lbl}>Date de début du projet</label>
            <input className={inp} type="date" value={cdc.date_debut ?? ''} onChange={set('date_debut')} disabled={estLecteur} />
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
            hidden={estLecteur}
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
                  <td className="py-2 pr-3 w-24"><input className={rowIn} value={row[0] ?? ''} onChange={setCell('history', ri, 0)} placeholder="1.0" disabled={estLecteur} /></td>
                  <td className="py-2 pr-3 w-36"><input className={rowIn} value={row[1] ?? ''} onChange={setCell('history', ri, 1)} placeholder="Auteur" disabled={estLecteur} /></td>
                  <td className="py-2 pr-3"><input className={rowIn} value={row[2] ?? ''} onChange={setCell('history', ri, 2)} placeholder="Description" disabled={estLecteur} /></td>
                  <td className="py-2 pr-3 w-36"><input className={rowIn} type="date" value={row[3] ?? ''} onChange={setCell('history', ri, 3)} disabled={estLecteur} /></td>
                  <td className="py-2 w-8 text-center">
                    {!estLecteur && <button onClick={removeRow('history', ri)} className="text-gray-200 hover:text-red-400 transition-colors text-sm">✕</button>}
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
          <textarea className={ta} value={cdc[field] ?? ''} onChange={set(field)} placeholder={placeholder} disabled={estLecteur} />
        </Card>
      ))}

      {/* ── Risques identifiés ─────────────────────────────────────────── */}
      <Card>
        <SectionHeader n="R" title="Risques identifiés" color="red" />
        <p className={help}>Listez les risques connus (1 par ligne). Ex : Dépassement budgétaire, Manque de ressources, Résistance au changement…</p>
        <textarea className={`${ta} min-h-[100px]`} value={cdc.risques ?? ''} onChange={set('risques')} placeholder="Un risque par ligne…" disabled={estLecteur} />
      </Card>

      {/* ── Jalons & Planning ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader n="7" title="Jalons & Planning" />
          <button
            onClick={addRow('jalons', ['', '', ''])}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            hidden={estLecteur}
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
                  <td className="py-2 pr-3 w-[34%]"><input className={rowIn} value={row[0] ?? ''} onChange={setCell('jalons', ri, 0)} placeholder="Ex : Lancement" disabled={estLecteur} /></td>
                  <td className="py-2 pr-3 w-32"><input className={rowIn} type="date" value={row[1] ?? ''} onChange={setCell('jalons', ri, 1)} disabled={estLecteur} /></td>
                  <td className="py-2 pr-3"><input className={rowIn} value={row[2] ?? ''} onChange={setCell('jalons', ri, 2)} placeholder="Description du livrable" disabled={estLecteur} /></td>
                  <td className="py-2 w-8 text-center">
                    {!estLecteur && <button onClick={removeRow('jalons', ri)} className="text-gray-200 hover:text-red-400 transition-colors text-sm">✕</button>}
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
        <textarea className={ta} value={cdc.budget ?? ''} onChange={set('budget')} placeholder="Décrivez le budget du projet…" disabled={estLecteur} />
      </Card>

      {/* ── Barre d'actions collante ────────────────────────────────────── */}
      <div className="sticky bottom-4 bg-white border border-gray-100 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-lg z-10">
        {lastSaved ? (
          <span className="text-xs text-gray-400">
            Sauvegardé le {lastSaved.toLocaleString('fr-FR')}
          </span>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            title="Exporter le CDC en PDF (impression)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Exporter PDF
          </button>
          <button
            onClick={handleOpenCharter}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            title="Générer la Charte Projet dans une nouvelle fenêtre"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            Charte Projet
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            hidden={estLecteur}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

    </div>
  )
}
