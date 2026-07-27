import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

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
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{t('profile.title')}</h1>
      <p><Link to="/app">{t('common.back_to_home')}</Link></p>

      <section style={{ marginTop: 32 }}>
        <h2>{t('profile.photo_section')}</h2>
        {user.profile_photo && (
          <img
            src={user.profile_photo}
            alt={t('profile.photo_section')}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', display: 'block', marginBottom: 12 }}
          />
        )}
        <form onSubmit={handlePhotoSubmit}>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          <button type="submit" disabled={savingPhoto || !photoFile} style={{ marginLeft: 12, padding: '6px 16px' }}>
            {savingPhoto ? '...' : t('common.send')}
          </button>
          {photoMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{photoMessage}</p>}
          {photoError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{photoError}</p>}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>{t('profile.info_section')}</h2>
        <form onSubmit={handleProfileSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>{t('profile.phone')}</label><br />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>{t('profile.language')}</label><br />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <button type="submit" disabled={savingProfile} style={{ padding: '8px 16px' }}>
            {savingProfile ? '...' : t('common.save')}
          </button>
          {profileMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{profileMessage}</p>}
          {profileError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{profileError}</p>}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>{t('profile.password_section')}</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>{t('profile.old_password')}</label><br />
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>{t('profile.new_password')}</label><br />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>{t('profile.confirm_password')}</label><br />
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={savingPassword} style={{ padding: '8px 16px' }}>
            {savingPassword ? '...' : t('common.confirm')}
          </button>
          {passwordMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{passwordMessage}</p>}
          {passwordError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{passwordError}</p>}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>{t('profile.notifications_section', 'Notifications')}</h2>
        <form onSubmit={handleNotifSubmit}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            {t('profile.email_notifications', 'Recevoir les notifications par email')}
          </label>
          <button type="submit" disabled={savingNotif} style={{ marginTop: 12, padding: '8px 16px' }}>
            {savingNotif ? '...' : t('common.save')}
          </button>
          {notifMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{notifMessage}</p>}
        </form>
      </section>

      {user.role === 'PATIENT' && (
        <section style={{ marginTop: 32 }}>
          <h2>Mes enfants</h2>
          {dependents.length === 0 && <p style={{ fontSize: 14 }}>Aucun enfant rattaché.</p>}
          {dependents.map((dep) => (
            <div key={dep.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{dep.username}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>{dep.age} ans — {dep.email}</p>
            </div>
          ))}

          {showDependentForm ? (
            <form onSubmit={handleDependentSubmit} style={{ marginTop: 12, padding: 12, background: 'var(--color-info-bg)', borderRadius: 8 }}>
              <div style={{ marginBottom: 10 }}>
                <label>Nom d'utilisateur de l'enfant</label><br />
                <input
                  type="text"
                  value={dependentForm.username}
                  onChange={(e) => setDependentForm({ ...dependentForm, username: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8 }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Email de l'enfant</label><br />
                <input
                  type="email"
                  value={dependentForm.email}
                  onChange={(e) => setDependentForm({ ...dependentForm, email: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8 }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Date de naissance</label><br />
                <input
                  type="date"
                  value={dependentForm.date_of_birth}
                  onChange={(e) => setDependentForm({ ...dependentForm, date_of_birth: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={dependentForm.attestation}
                  onChange={(e) => setDependentForm({ ...dependentForm, attestation: e.target.checked })}
                />
                Je certifie sur l'honneur être le représentant légal (parent ou tuteur) de ce mineur.
              </label>
              {dependentError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 13, marginTop: 8 }}>{dependentError}</p>}
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button type="submit" disabled={dependentSaving} style={{ padding: '6px 16px' }}>
                  {dependentSaving ? '...' : 'Créer le compte'}
                </button>
                <button type="button" onClick={() => setShowDependentForm(false)} style={{ padding: '6px 16px' }}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowDependentForm(true)} style={{ marginTop: 8, padding: '8px 16px' }}>
              + Ajouter un enfant
            </button>
          )}
        </section>
      )}
    </div>
  )
}