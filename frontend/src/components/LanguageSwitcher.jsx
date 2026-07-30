import { useTranslation } from 'react-i18next'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <select
      className={styles.select}
      value={i18n.language?.startsWith('en') ? 'en' : 'fr'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>
  )
}
