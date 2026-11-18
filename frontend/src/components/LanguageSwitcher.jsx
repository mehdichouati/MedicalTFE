import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './LanguageSwitcher.module.css'

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
]

// Icone globe dessinee en SVG (pas d'emoji, rendu identique partout).
function GlobeIcon() {
  return (
    <svg
      className={styles.globe}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  )
}

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const languageCode = i18n.language?.slice(0, 2)
  const currentCode = LANGUAGES.some((lang) => lang.code === languageCode) ? languageCode : 'fr'

  // Ferme le menu au clic en dehors ou avec la touche Echap.
  useEffect(() => {
    if (!open) return undefined

    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const changeLanguage = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Version ordinateur : bouton globe + menu deroulant */}
      <div className={styles.dropdown}>
        <button
          type="button"
          className={styles.toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t('nav.language_label')}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <GlobeIcon />
          <span>{currentCode.toUpperCase()}</span>
          <span className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} aria-hidden="true">
            ▾
          </span>
        </button>

        {open && (
          <ul className={styles.menu} role="listbox" aria-label={t('nav.language_label')}>
            {LANGUAGES.map((lang) => {
              const isActive = lang.code === currentCode
              return (
                <li key={lang.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={isActive ? `${styles.option} ${styles.optionActive}` : styles.option}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    <span className={styles.code}>{lang.code.toUpperCase()}</span>
                    <span lang={lang.code}>{lang.label}</span>
                    {isActive && <span className={styles.check} aria-hidden="true">✓</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Version mobile : pastilles FR / EN / NL */}
      <div className={styles.pills} role="group" aria-label={t('nav.language_label')}>
        <GlobeIcon />
        {LANGUAGES.map((lang) => {
          const isActive = lang.code === currentCode
          return (
            <button
              key={lang.code}
              type="button"
              aria-pressed={isActive}
              title={lang.label}
              className={isActive ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              onClick={() => changeLanguage(lang.code)}
            >
              {lang.code.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}