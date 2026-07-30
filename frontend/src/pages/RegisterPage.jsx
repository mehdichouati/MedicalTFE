import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '', phone_number: '', date_of_birth: '',
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
    <div className={styles.container}>
      <h1>Créer un compte</h1>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Nom d'utilisateur</label><br />
          <input type="text" value={form.username} onChange={update('username')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>Email</label><br />
          <input type="email" value={form.email} onChange={update('email')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>Téléphone</label><br />
          <input type="tel" value={form.phone_number} onChange={update('phone_number')} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>Date de naissance</label><br />
          <input type="date" value={form.date_of_birth} onChange={update('date_of_birth')} required className={styles.input} />
          <p className={styles.hint}>
            Les comptes des moins de 16 ans doivent être créés par un parent depuis son profil.
          </p>
        </div>
        <div className={styles.field}>
          <label>Mot de passe</label><br />
          <input type="password" value={form.password} onChange={update('password')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>Confirmer le mot de passe</label><br />
          <input type="password" value={form.password2} onChange={update('password2')} required className={styles.input} />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>
      <p className={styles.loginLink}>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  )
}