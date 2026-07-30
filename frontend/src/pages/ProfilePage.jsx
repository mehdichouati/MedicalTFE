import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user, setUser } = useAuth()

  const [dependents, setDependents] = useState([])
  const [showDependentForm, setShowDependentForm] = useState(false)
  const [dependentForm, setDependentForm] = useState({
    username: '', email: '', date_of_birth: '', attestation: false,
  })
  const [dependentError, setDependentError] = useState('')
  const [dependentSaving, setDependentSaving] = useState(false)

  const loadDependents = () => {
    apiClient.get('/auth/dependents/')
      .then(({ data }) => setDependents(Array.isArray(data) ? data : data.results))
      .catch(() => {})
  }

  const handleDependentSubmit = async (e) => {
    e.preventDefault()
    setDependentError('')
    setDependentSaving(true)
    try {
      await apiClient.post('/auth/dependents/', dependentForm)
      setDependentForm({ username: '', email: '', date_of_birth: '', attestation: false })
      setShowDependentForm(false)
      loadDependents()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setDependentError(Array.isArray(firstError) ? firstError[0] : firstError || 'Erreur lors de la création.')
    } finally {
      setDependentSaving(false)
    }
  }

  const [phoneNumber, setPhoneNumber] = useState('')
  const [language, setLanguage] = useState('fr')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [emailEnabled, setEmailEnabled] = useState(true)
  const [notifMessage, setNotifMessage] = useState('')
  const [savingNotif, setSavingNotif] = useState(false)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoMessage, setPhotoMessage] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phone_number || '')
      setLanguage(user.language || 'fr')
    }
    apiClient.get('/notifications/preferences/')
      .then(({ data }) => setEmailEnabled(data.email_enabled))
      .catch(() => {})
    loadDependents()
  }, [user])

  const handleNotifSubmit = async (e) => {
    e.preventDefault()
    setNotifMessage('')
    setSavingNotif(true)
    try {
      await apiClient.patch('/notifications/preferences/', { email_enabled: emailEnabled })
      setNotifMessage(t('profile.profile_updated'))
    } catch {
      setNotifMessage(t('common.error_generic'))
    } finally {
      setSavingNotif(false)
    }
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileMessage('')
    setProfileError('')
    setSavingProfile(true)
    try {
      const { data } = await apiClient.patch('/auth/me/', {
        phone_number: phoneNumber,
        language,
      })
      setUser(data)
      i18n.changeLanguage(language)
      setProfileMessage(t('profile.profile_updated'))
    } catch {
      setProfileError(t('common.error_generic'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePhotoSubmit = async (e) => {
    e.preventDefault()
    if (!photoFile) return
    setPhotoMessage('')
    setPhotoError('')
    setSavingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('profile_photo', photoFile)
      const { data } = await apiClient.patch('/auth/me/', formData)
      setUser(data)
      setPhotoMessage(t('profile.photo_updated'))
    } catch {
      setPhotoError(t('common.error_generic'))
    } finally {
      setSavingPhoto(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword !== newPassword2) {
      setPasswordError(t('profile.password_mismatch'))
      return
    }

    setSavingPassword(true)
    try {
      await apiClient.post('/auth/me/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      })
      setPasswordMessage(t('profile.password_updated'))
      setOldPassword('')
      setNewPassword('')
      setNewPassword2('')
    } catch (err) {
      const detail = err.response?.data?.old_password?.[0]
        || err.response?.data?.new_password?.[0]
        || t('common.error_generic')
      setPasswordError(detail)
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <h1>{t('profile.title')}</h1>
      <p><Link to="/app">{t('common.back_to_home')}</Link></p>

      <section className={styles.section}>
        <h2>{t('profile.photo_section')}</h2>
        {user.profile_photo && (
          <img src={user.profile_photo} alt={t('profile.photo_section')} className={styles.avatar} />
        )}
        <form onSubmit={handlePhotoSubmit}>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          <button type="submit" disabled={savingPhoto || !photoFile} className={styles.sendButton}>
            {savingPhoto ? '...' : t('common.send')}
          </button>
          {photoMessage && <p className={styles.successText}>{photoMessage}</p>}
          {photoError && <p className={styles.errorText}>{photoError}</p>}
        </form>
      </section>

      <section className={styles.section}>
        <h2>{t('profile.info_section')}</h2>
        <form onSubmit={handleProfileSubmit}>
          <div className={styles.field}>
            <label>{t('profile.phone')}</label><br />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label>{t('profile.language')}</label><br />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={styles.input}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <button type="submit" disabled={savingProfile} className={styles.submitButton}>
            {savingProfile ? '...' : t('common.save')}
          </button>
          {profileMessage && <p className={styles.successText}>{profileMessage}</p>}
          {profileError && <p className={styles.errorText}>{profileError}</p>}
        </form>
      </section>

      <section className={styles.section}>
        <h2>{t('profile.password_section')}</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div className={styles.field}>
            <label>{t('profile.old_password')}</label><br />
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label>{t('profile.new_password')}</label><br />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label>{t('profile.confirm_password')}</label><br />
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          <button type="submit" disabled={savingPassword} className={styles.submitButton}>
            {savingPassword ? '...' : t('common.confirm')}
          </button>
          {passwordMessage && <p className={styles.successText}>{passwordMessage}</p>}
          {passwordError && <p className={styles.errorText}>{passwordError}</p>}
        </form>
      </section>

      <section className={styles.section}>
        <h2>{t('profile.notifications_section', 'Notifications')}</h2>
        <form onSubmit={handleNotifSubmit}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            {t('profile.email_notifications', 'Recevoir les notifications par email')}
          </label>
          <button type="submit" disabled={savingNotif} className={styles.notifSaveButton}>
            {savingNotif ? '...' : t('common.save')}
          </button>
          {notifMessage && <p className={styles.successText}>{notifMessage}</p>}
        </form>
      </section>

      {user.role === 'PATIENT' && (
        <section className={styles.section}>
          <h2>Mes enfants</h2>
          {dependents.length === 0 && <p>Aucun enfant rattaché.</p>}
          {dependents.map((dep) => (
            <div key={dep.id} className={styles.dependentCard}>
              <p className={styles.dependentName}>{dep.username}</p>
              <p className={styles.dependentMeta}>{dep.age} ans — {dep.email}</p>
            </div>
          ))}

          {showDependentForm ? (
            <form onSubmit={handleDependentSubmit} className={styles.dependentForm}>
              <div className={styles.field}>
                <label>Nom d'utilisateur de l'enfant</label><br />
                <input
                  type="text"
                  value={dependentForm.username}
                  onChange={(e) => setDependentForm({ ...dependentForm, username: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Email de l'enfant</label><br />
                <input
                  type="email"
                  value={dependentForm.email}
                  onChange={(e) => setDependentForm({ ...dependentForm, email: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Date de naissance</label><br />
                <input
                  type="date"
                  value={dependentForm.date_of_birth}
                  onChange={(e) => setDependentForm({ ...dependentForm, date_of_birth: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <label className={styles.attestationLabel}>
                <input
                  type="checkbox"
                  checked={dependentForm.attestation}
                  onChange={(e) => setDependentForm({ ...dependentForm, attestation: e.target.checked })}
                />
                Je certifie sur l'honneur être le représentant légal (parent ou tuteur) de ce mineur.
              </label>
              {dependentError && <p className={styles.errorText}>{dependentError}</p>}
              <div className={styles.dependentFormActions}>
                <button type="submit" disabled={dependentSaving} className={styles.submitButton}>
                  {dependentSaving ? '...' : 'Créer le compte'}
                </button>
                <button type="button" onClick={() => setShowDependentForm(false)} className={styles.submitButton}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowDependentForm(true)} className={styles.addDependentButton}>
              + Ajouter un enfant
            </button>
          )}
        </section>
      )}
    </div>
  )
}