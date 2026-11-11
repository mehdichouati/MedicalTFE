import { useTranslation } from 'react-i18next'
import styles from './LanguageSwitcher.module.css'

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentCode = i18n.language?.slice(0, 2)
  const value = LANGUAGES.some((lang) => lang.code === currentCode) ? currentCode : 'fr'

  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      ))}
    </select>
  )
}