import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '', date_of_birth: '', health_data_consent: false,
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // N1 — Le role n'est plus envoye : le backend cree toujours un patient.
      await apiClient.post('/auth/register/', form)
      await login(form.username, form.password)
      navigate('/app')
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setError(Array.isArray(firstError) ? firstError[0] : firstError || t('register.error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>{t('register.title')}</h1>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="register-username">{t('register.username')}</label><br />
          <input
            id="register-username"
            type="text"
            value={form.username}
            onChange={update('username')}
            autoComplete="username"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="register-email">{t('register.email')}</label><br />
          <input
            id="register-email"
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="register-date-of-birth">{t('register.date_of_birth')}</label><br />
          <input
            id="register-date-of-birth"
            type="date"
            value={form.date_of_birth}
            onChange={update('date_of_birth')}
            autoComplete="bday"
            required
            className={styles.input}
          />
          <p className={styles.hint}>
            {t('register.minor_hint')}
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-password">{t('register.password')}</label><br />
          <input
            id="register-password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="register-password2">{t('register.confirm_password')}</label><br />
          <input
            id="register-password2"
            type="password"
            value={form.password2}
            onChange={update('password2')}
            autoComplete="new-password"
            required
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.consentLabel}>
            <input
              type="checkbox"
              checked={form.health_data_consent}
              onChange={(e) => setForm({ ...form, health_data_consent: e.target.checked })}
              required
            />
            {t('register.health_data_consent_label')}
          </label>
          <p className={styles.hint}>{t('register.health_data_consent_note')}</p>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>
      <p className={styles.loginLink}>
        {t('register.already_account')} <Link to="/login">{t('register.login_link')}</Link>
      </p>
    </div>
  )
}