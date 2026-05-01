import { useTheme } from '../context/ThemeContext'
import logoCouleur from '../assets/QimInfo-LogoSymbole-Couleur.png'
import logoBlanc   from '../assets/QimInfo-LogoSymbole-Blanc.png'

/**
 * Logo Qim info — change automatiquement selon le thème.
 * - Thème clair → version couleur
 * - Thème sombre → version blanche
 *
 * Props :
 *   - className : classes Tailwind pour la taille (ex. "w-6 h-6")
 *   - alt       : texte alternatif (défaut "QimProject")
 */
export default function Logo({ className = 'w-6 h-6', alt = 'QimProject' }) {
  const { dark } = useTheme()
  return (
    <img
      src={dark ? logoBlanc : logoCouleur}
      alt={alt}
      className={`${className} object-contain select-none`}
      draggable={false}
    />
  )
}
