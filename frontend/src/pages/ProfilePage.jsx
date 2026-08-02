import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './ProfilePage.module.css'

function CollapsibleSection({ title, isOpen, onToggle, children }) {
  return (
    <section className={styles.section}>
      <button type="button" onClick={onToggle} className={styles.sectionToggle}>
        <h2 className={styles.sectionToggleTitle}>{title}</h2>
        <span className={styles.sectionToggleIcon}>{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && <div className={styles.sectionContent}>{children}</div>}
    </section>
  )
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user, setUser } = useAuth()

  const [openSections, setOpenSections] = useState({})
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

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
      setDependentError(Array.isArray(firstError) ? firstError[0] : firstError || t('dependents.error_generic'))
    } finally {
      setDependentSaving(false)
    }
  }

  const [language, setLanguage] = useState('fr')
  const [usernameField, setUsernameField] = useState('')
  const [emailField, setEmailField] = useState('')
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
      setLanguage(user.language || 'fr')
      setUsernameField(user.username || '')
      setEmailField(user.email || '')
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
        language,
        username: usernameField,
        email: emailField,
      })
      setUser(data)
      i18n.changeLanguage(language)
      setProfileMessage(t('profile.profile_updated'))
    } catch (err) {
      const errData = err.response?.data
      const firstError = errData ? Object.values(errData)[0] : null
      setProfileError(Array.isArray(firstError) ? firstError[0] : firstError || t('common.error_generic'))
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

      <CollapsibleSection
        title={t('profile.photo_section')}
        isOpen={!!openSections.photo}
        onToggle={() => toggleSection('photo')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title={t('profile.info_section')}
        isOpen={!!openSections.info}
        onToggle={() => toggleSection('info')}
      >
        <form onSubmit={handleProfileSubmit}>
          <div className={styles.field}>
            <label>{t('profile.username')}</label><br />
            <input
              type="text"
              value={usernameField}
              onChange={(e) => setUsernameField(e.target.value)}
              required
              className={styles.input}
            />
            {usernameField !== user.username && (
              <p className={styles.emailChangeNote}>{t('profile.username_change_note')}</p>
            )}
          </div>
          <div className={styles.field}>
            <label>{t('profile.email')}</label><br />
            <input
              type="email"
              value={emailField}
              onChange={(e) => setEmailField(e.target.value)}
              required
              className={styles.input}
            />
            {emailField !== user.email && (
              <p className={styles.emailChangeNote}>{t('profile.email_verification_reset')}</p>
            )}
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
      </CollapsibleSection>

      <CollapsibleSection
        title={t('profile.password_section')}
        isOpen={!!openSections.password}
        onToggle={() => toggleSection('password')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title={t('profile.notifications_section', 'Notifications')}
        isOpen={!!openSections.notifications}
        onToggle={() => toggleSection('notifications')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title={t('profile.dpo_section')}
        isOpen={!!openSections.dpo}
        onToggle={() => toggleSection('dpo')}
      >
        <div className={styles.dpoBox}>
          <p>{t('profile.dpo_intro')}</p>
          <p>
            <strong>{t('profile.dpo_email_label')} : </strong>
            <a href="mailto:dpo@maisonmedicale.be">dpo@maisonmedicale.be</a>
          </p>
          <p className={styles.dpoLegalNote}>{t('profile.dpo_legal_note')}</p>
        </div>
      </CollapsibleSection>

      {user.role === 'PATIENT' && (
        <CollapsibleSection
          title={t('dependents.section_title')}
          isOpen={!!openSections.dependents}
          onToggle={() => toggleSection('dependents')}
        >
          {dependents.length === 0 && <p>{t('dependents.no_dependents')}</p>}
          {dependents.map((dep) => (
            <div key={dep.id} className={styles.dependentCard}>
              <p className={styles.dependentName}>{dep.username}</p>
              <p className={styles.dependentMeta}>{t('dependents.age_years', { age: dep.age })} — {dep.email}</p>
            </div>
          ))}

          {showDependentForm ? (
            <form onSubmit={handleDependentSubmit} className={styles.dependentForm}>
              <div className={styles.field}>
                <label>{t('dependents.username_label')}</label><br />
                <input
                  type="text"
                  value={dependentForm.username}
                  onChange={(e) => setDependentForm({ ...dependentForm, username: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>{t('dependents.email_label')}</label><br />
                <input
                  type="email"
                  value={dependentForm.email}
                  onChange={(e) => setDependentForm({ ...dependentForm, email: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>{t('dependents.date_of_birth_label')}</label><br />
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
                {t('dependents.attestation_label')}
              </label>
              {dependentError && <p className={styles.errorText}>{dependentError}</p>}
              <div className={styles.dependentFormActions}>
                <button type="submit" disabled={dependentSaving} className={styles.submitButton}>
                  {dependentSaving ? '...' : t('dependents.create_button')}
                </button>
                <button type="button" onClick={() => setShowDependentForm(false)} className={styles.submitButton}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowDependentForm(true)} className={styles.addDependentButton}>
              {t('dependents.add_button')}
            </button>
          )}
        </CollapsibleSection>
      )}
    </div>
  )
}