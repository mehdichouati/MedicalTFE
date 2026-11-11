import { Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return <p className={styles.loading}>{t('common.loading')}</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}