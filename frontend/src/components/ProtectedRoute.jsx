import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className={styles.loading}>Chargement...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
