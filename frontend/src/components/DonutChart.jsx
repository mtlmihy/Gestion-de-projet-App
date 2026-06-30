import React from 'react'

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const s = polarToCartesian(cx, cy, r, startAngle)
  const e = polarToCartesian(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

/**
 * DonutChart - SVG pur, cohérent avec SCurve et TimelineSVG.
 * @param {Array} slices  - [{ label, value, color }]
 * @param {string} title  - texte centre du donut (optionnel)
 * @param {number} size   - taille SVG (défaut 200)
 */
export default function DonutChart({ slices = [], title = '', size = 200 }) {
  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.38   // rayon extérieur
  const r  = size * 0.24   // rayon intérieur (trou)

  const total = slices.reduce((s, sl) => s + (sl.value || 0), 0)

  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[200px]">
        <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" className="stroke-gray-100 dark:stroke-slate-700" strokeWidth={R - r} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(size * 0.14)} className="fill-gray-400 dark:fill-slate-500">-</text>
      </svg>
    )
  }

  let currentAngle = 0
  const paths = slices
    .filter((sl) => sl.value > 0)
    .map((sl, i) => {
      const sweep = (sl.value / total) * 360
      const start = currentAngle
      const end   = currentAngle + sweep - (sweep > 5 ? 1 : 0)  // gap between segments
      currentAngle += sweep
      return (
        <path
          key={i}
          d={arcPath(cx, cy, (R + r) / 2, start, end)}
          fill="none"
          stroke={sl.color}
          strokeWidth={R - r}
          strokeLinecap="butt"
          opacity="0.92"
        >
          <title>{sl.label}: {sl.value} ({((sl.value / total) * 100).toFixed(1)}%)</title>
        </path>
      )
    })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[200px]">
      <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" className="stroke-gray-100 dark:stroke-slate-700" strokeWidth={R - r} />
      {paths}
      {title && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.round(size * 0.275)}
          fontWeight="800"
          className="fill-gray-900 dark:fill-slate-100"
        >
          {title}
        </text>
      )}
    </svg>
  )
}
