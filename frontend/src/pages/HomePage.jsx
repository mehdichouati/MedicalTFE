import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PROFESSIONAL_ROLES = ['MEDECIN', 'KINE', 'PSYCHOLOGUE']

export default function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Maison Médicale</h1>
      <p>Connecté en tant que <b>{user?.username}</b> ({user?.role})</p>
      <p>
        {user?.role === 'PATIENT' && (
          <>
            <Link to="/triage">Aide à l'orientation</Link>
            {' · '}
            <Link to="/history">Mon historique</Link>
            {' · '}
          </>
        )}
        {PROFESSIONAL_ROLES.includes(user?.role) && (
          <>
            <Link to="/my-appointments">Mes rendez-vous</Link>
            {' · '}
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Link to="/admin/dashboard">Tableau de bord</Link>
            {' · '}
          </>
        )}
        <Link to="/profile">Mon profil</Link>
      </p>
      <button onClick={logout} style={{ padding: '8px 16px' }}>Se déconnecter</button>
    </div>
  )
}