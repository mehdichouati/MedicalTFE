import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import styles from './Header.module.css'

const PROFESSIONAL_ROLES = ['MEDECIN', 'KINE', 'PSYCHOLOGUE']

// Retourne les liens du menu principal selon le role de l'utilisateur.
function getNavLinks(role) {
  if (role === 'PATIENT') {
    return [
      { to: '/book', labelKey: 'home.link_book' },
      { to: '/triage', labelKey: 'home.link_triage' },
      { to: '/history', labelKey: 'home.link_history' },
    ]
  }
  if (PROFESSIONAL_ROLES.includes(role)) {
    return [
      { to: '/my-appointments', labelKey: 'home.link_my_appointments' },
      { to: '/planning', labelKey: 'home.link_planning' },
      { to: '/my-patients', labelKey: 'home.link_my_patients' },
    ]
  }
  if (role === 'SECRETAIRE') {
    return [
      { to: '/secretary', labelKey: 'home.link_secretary' },
      { to: '/secretary/guardian-requests', labelKey: 'home.link_guardian_requests' },
    ]
  }
  if (role === 'ADMIN') {
    return [{ to: '/admin/dashboard', labelKey: 'home.link_dashboard' }]
  }
  return []
}

// Ajoute la classe "active" au lien de la page courante.
function navLinkClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
}

export default function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  const toggleMenu = () => setMenuOpen((open) => !open)

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/')
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Le logo ramene toujours au site vitrine, connecte ou non. */}
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          <span className={styles.logoMark} aria-hidden="true">✚</span>
          <span className={styles.logoText}>{t('showcase.default_house_name')}</span>
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          aria-label={menuOpen ? t('nav.close_menu') : t('nav.open_menu')}
          onClick={toggleMenu}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>

        <nav
          id="main-nav"
          className={menuOpen ? `${styles.nav} ${styles.navOpen}` : styles.nav}
          aria-label={t('nav.main_label')}
        >
          <ul className={styles.navList}>
            <li>
              <NavLink to={user ? '/app' : '/'} end className={navLinkClass} onClick={closeMenu}>
                {t('nav.home')}
              </NavLink>
            </li>
            {user && getNavLinks(user.role).map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={navLinkClass} onClick={closeMenu}>
                  {t(link.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <LanguageSwitcher />
            {user ? (
              <>
                <NavLink to="/profile" className={navLinkClass} onClick={closeMenu}>
                  <span aria-hidden="true">👤</span> {user.username}
                </NavLink>
                <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                  {t('common.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={styles.loginLink} onClick={closeMenu}>
                  {t('showcase.login_button')}
                </Link>
                <Link to="/register" className={styles.registerLink} onClick={closeMenu}>
                  {t('showcase.register_button')}
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}