import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './HomePage.module.css'

const PROFESSIONAL_ROLES = ['MEDECIN', 'KINE', 'PSYCHOLOGUE']

function ActionCard({ to, icon, title, subtitle }) {
  return (
    <Link to={to} className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <p className={styles.cardTitle}>{title}</p>
      <p className={styles.cardSubtitle}>{subtitle}</p>
    </Link>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('home.title')}</h1>
            <p className={styles.subtitle}>
              {t('home.connected_as')} <b>{user?.username}</b> ({user?.role})
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        <div className={styles.cardGrid}>
          {user?.role === 'PATIENT' && (
            <>
              <ActionCard to="/book" icon="📅" title="Prendre rendez-vous" subtitle="Réservez une consultation" />
              <ActionCard to="/triage" icon="🩺" title={t('home.link_triage')} subtitle="Trouvez la bonne orientation" />
              <ActionCard to="/history" icon="📋" title={t('home.link_history')} subtitle="RDV, documents, paiements" />
            </>
          )}
          {PROFESSIONAL_ROLES.includes(user?.role) && (
            <>
              <ActionCard to="/my-appointments" icon="🗓️" title={t('home.link_my_appointments')} subtitle="Gérez vos consultations" />
              <ActionCard to="/my-patients" icon="📁" title="Consulter les dossiers" subtitle="Vos patients et leurs documents" />
            </>
          )}
          {user?.role === 'ADMIN' && (
            <ActionCard to="/admin/dashboard" icon="📊" title={t('home.link_dashboard')} subtitle="Statistiques et gestion" />
          )}
          <ActionCard to="/profile" icon="👤" title={t('home.link_profile')} subtitle="Vos informations, préférences" />
        </div>

        <button onClick={logout} className={styles.logoutButton}>
          {t('common.logout')}
        </button>
      </div>
    </div>
  )
}