import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Maison Médicale</h1>
      <p>Connecté en tant que <b>{user?.username}</b> ({user?.role})</p>
      <button onClick={logout} style={{ padding: '8px 16px' }}>Se déconnecter</button>
    </div>
  )
}
