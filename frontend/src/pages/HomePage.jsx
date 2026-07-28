import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

const PROFESSIONAL_ROLES = ['MEDECIN', 'KINE', 'PSYCHOLOGUE']

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 14,
  padding: 22,
  boxShadow: '0 2px 10px rgba(10,92,120,0.08)',
  border: '1px solid #eef1f4',
  textDecoration: 'none',
  color: '#1a1a2e',
  display: 'block',
}

function ActionCard({ to, icon, title, subtitle }) {
  return (
    <Link to={to} style={CARD_STYLE}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#0a5c78' }}>{title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52606d' }}>{subtitle}</p>
    </Link>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h1 style={{ color: '#0a5c78', fontSize: 32, margin: 0 }}>{t('home.title')}</h1>
            <p style={{ color: '#52606d', marginTop: 6 }}>
              {t('home.connected_as')} <b>{user?.username}</b> ({user?.role})
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 32 }}>
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

        <button
          onClick={logout}
          style={{
            marginTop: 36,
            padding: '10px 22px',
            background: '#fff',
            color: '#0a5c78',
            border: '2px solid #0a5c78',
            borderRadius: 24,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {t('common.logout')}
        </button>
      </div>
    </div>
  )
}
