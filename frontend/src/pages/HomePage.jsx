import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

const PROFESSIONAL_ROLES = ['MEDECIN', 'KINE', 'PSYCHOLOGUE']

export default function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('home.title')}</h1>
        <LanguageSwitcher />
      </div>
      <p>{t('home.connected_as')} <b>{user?.username}</b> ({user?.role})</p>
      <p>
        {user?.role === 'PATIENT' && (
          <>
            <Link to="/triage">{t('home.link_triage')}</Link>
            {' · '}
            <Link to="/history">{t('home.link_history')}</Link>
            {' · '}
          </>
        )}
        {PROFESSIONAL_ROLES.includes(user?.role) && (
          <>
            <Link to="/my-appointments">{t('home.link_my_appointments')}</Link>
            {' · '}
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Link to="/admin/dashboard">{t('home.link_dashboard')}</Link>
            {' · '}
          </>
        )}
        <Link to="/profile">{t('home.link_profile')}</Link>
      </p>
      <button onClick={logout} style={{ padding: '8px 16px' }}>{t('common.logout')}</button>
    </div>
  )
}