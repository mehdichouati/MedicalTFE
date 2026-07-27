import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '', phone_number: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await apiClient.post('/auth/register/', { ...form, role: 'PATIENT' })
      await login(form.username, form.password)
      navigate('/app')
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Erreur lors de la création du compte.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Créer un compte</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Nom d'utilisateur</label><br />
          <input type="text" value={form.username} onChange={update('username')} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label><br />
          <input type="email" value={form.email} onChange={update('email')} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Téléphone</label><br />
          <input type="tel" value={form.phone_number} onChange={update('phone_number')} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Mot de passe</label><br />
          <input type="password" value={form.password} onChange={update('password')} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Confirmer le mot de passe</label><br />
          <input type="password" value={form.password2} onChange={update('password2')} required style={{ width: '100%', padding: 8 }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: '8px 16px' }}>
          {submitting ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  )
}
