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
      await apiClient.post('/auth/register/', { ...form, role: 'PATIENT' })
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
          <label>{t('register.username')}</label><br />
          <input type="text" value={form.username} onChange={update('username')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>{t('register.email')}</label><br />
          <input type="email" value={form.email} onChange={update('email')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>{t('register.date_of_birth')}</label><br />
          <input type="date" value={form.date_of_birth} onChange={update('date_of_birth')} required className={styles.input} />
          <p className={styles.hint}>
            {t('register.minor_hint')}
          </p>
        </div>
        <div className={styles.field}>
          <label>{t('register.password')}</label><br />
          <input type="password" value={form.password} onChange={update('password')} required className={styles.input} />
        </div>
        <div className={styles.field}>
          <label>{t('register.confirm_password')}</label><br />
          <input type="password" value={form.password2} onChange={update('password2')} required className={styles.input} />
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

        {error && <p className={styles.error}>{error}</p>}
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