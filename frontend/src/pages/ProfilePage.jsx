import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user, setUser } = useAuth()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [language, setLanguage] = useState('fr')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

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
  }, [user])

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
      setProfileMessage('Profil mis à jour.')
    } catch {
      setProfileError('Une erreur est survenue.')
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
      setPhotoMessage('Photo mise à jour.')
    } catch {
      setPhotoError("Une erreur est survenue lors de l'envoi de la photo.")
    } finally {
      setSavingPhoto(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword !== newPassword2) {
      setPasswordError('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }

    setSavingPassword(true)
    try {
      await apiClient.post('/auth/me/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      })
      setPasswordMessage('Mot de passe modifié avec succès.')
      setOldPassword('')
      setNewPassword('')
      setNewPassword2('')
    } catch (err) {
      const detail = err.response?.data?.old_password?.[0]
        || err.response?.data?.new_password?.[0]
        || 'Une erreur est survenue.'
      setPasswordError(detail)
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Mon profil</h1>
      <p><Link to="/">Retour à l'accueil</Link></p>

      <section style={{ marginTop: 32 }}>
        <h2>Photo de profil</h2>
        {user.profile_photo && (
          <img
            src={user.profile_photo}
            alt="Photo de profil"
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', display: 'block', marginBottom: 12 }}
          />
        )}
        <form onSubmit={handlePhotoSubmit}>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          <button type="submit" disabled={savingPhoto || !photoFile} style={{ marginLeft: 12, padding: '6px 16px' }}>
            {savingPhoto ? 'Envoi...' : 'Envoyer'}
          </button>
          {photoMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{photoMessage}</p>}
          {photoError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{photoError}</p>}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Informations</h2>
        <form onSubmit={handleProfileSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Téléphone</label><br />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Langue</label><br />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <button type="submit" disabled={savingProfile} style={{ padding: '8px 16px' }}>
            {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {profileMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{profileMessage}</p>}
          {profileError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{profileError}</p>}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Changer le mot de passe</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Ancien mot de passe</label><br />
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Nouveau mot de passe</label><br />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Confirmer le nouveau mot de passe</label><br />
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={savingPassword} style={{ padding: '8px 16px' }}>
            {savingPassword ? 'Modification...' : 'Changer le mot de passe'}
          </button>
          {passwordMessage && <p style={{ color: 'var(--color-ok-text)', fontSize: 14 }}>{passwordMessage}</p>}
          {passwordError && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14 }}>{passwordError}</p>}
        </form>
      </section>
    </div>
  )
}
