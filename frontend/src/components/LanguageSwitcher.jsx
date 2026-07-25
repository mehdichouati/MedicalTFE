import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <select
      value={i18n.language?.startsWith('en') ? 'en' : 'fr'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      style={{ padding: 4 }}
    >
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>
  )
}
