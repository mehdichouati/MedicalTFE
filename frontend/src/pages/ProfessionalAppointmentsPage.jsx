import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './ProfessionalAppointmentsPage.module.css'

const DOCUMENT_TYPES = [
  { value: 'LAB_RESULT', label: 'Résultat de prise de sang' },
  { value: 'REPORT', label: 'Rapport médical' },
  { value: 'OTHER', label: 'Autre document' },
]

const STATUS_STYLES = {
  PENDING: { background: '#fff8e8', color: '#8a6d00', label: 'En attente' },
  CONFIRMED: { background: '#eef5f8', color: '#0a5c78', label: 'Confirmé' },
  CANCELLED: { background: '#fdf2f2', color: '#b3261e', label: 'Annulé' },
  COMPLETED: { background: '#eef6f0', color: '#1f5c39', label: 'Terminé' },
  NO_SHOW: { background: '#fdf2f2', color: '#b3261e', label: 'Absence' },
}

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function UploadDocumentForm({ patientId, onUploaded }) {
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('LAB_RESULT')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !title) return
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const formData = new FormData()
      formData.append('patient', patientId)
      formData.append('document_type', documentType)
      formData.append('title', title)
      formData.append('file', file)
      await apiClient.post('/medical-documents/', formData)
      setTitle('')
      setFile(null)
      setSuccess(true)
      setTimeout(onUploaded, 1500)
    } catch (err) {
      console.error('Erreur upload document:', err.response?.data || err.message)
      const detail = err.response?.data?.detail
        || err.response?.data?.patient?.[0]
        || err.response?.data?.file?.[0]
        || "Erreur lors de l'envoi du document."
      setError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.uploadForm}>
      <div className={styles.uploadFormRow}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={styles.select}>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Titre du document"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.titleInput}
        />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" disabled={submitting || !file || !title} className={styles.uploadButton}>
        {submitting ? 'Envoi...' : 'Déposer'}
      </button>
      {success && <p className={styles.uploadSuccessText}>Document envoyé avec succès.</p>}
      {error && <p className={styles.uploadErrorText}>{error}</p>}
    </form>
  )
}

export default function ProfessionalAppointmentsPage() {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [uploadFormFor, setUploadFormFor] = useState(null)

  const loadAppointments = () => {
    setLoading(true)
    apiClient.get('/appointments/')
      .then(({ data }) => setAppointments(Array.isArray(data) ? data : data.results))
      .catch(() => setError('Impossible de charger vos rendez-vous.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  const handleAction = async (appointmentId, action) => {
    setActionError('')
    try {
      await apiClient.post(`/appointments/${appointmentId}/${action}/`)
      loadAppointments()
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Une erreur est survenue.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Mes rendez-vous</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← Retour à l'accueil</Link>
        </p>

        {actionError && <p className={styles.errorText}>{actionError}</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {loading ? (
          <p className={styles.loadingText}>Chargement...</p>
        ) : (
          <>
            {appointments.length === 0 && <p className={styles.loadingText}>Aucun rendez-vous pour le moment.</p>}
            {appointments.map((appt) => {
              const statusStyle = STATUS_STYLES[appt.status] || {}
              return (
                <div key={appt.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.appointmentDate}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
                      <p className={styles.appointmentMeta}>
                        Patient : {appt.patient_username}
                        {appt.reason && ` — ${appt.reason}`}
                      </p>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ background: statusStyle.background, color: statusStyle.color }}
                    >
                      {statusStyle.label || appt.status}
                    </span>
                  </div>

                  {appt.status === 'PENDING' && new Date(appt.start_datetime) <= new Date() && (
                    <div className={styles.actionsRow}>
                      <button onClick={() => handleAction(appt.id, 'mark-completed')} className={styles.btnPrimary}>
                        Terminer la consultation
                      </button>
                      <button onClick={() => handleAction(appt.id, 'mark-no-show')} className={styles.btnSecondary}>
                        Signaler une absence
                      </button>
                    </div>
                  )}

                  {appt.status === 'PENDING' && new Date(appt.start_datetime) > new Date() && (
                    <p className={styles.loadingText}>Actions disponibles après l'heure du rendez-vous.</p>
                  )}

                  {appt.status === 'COMPLETED' && user?.role === 'MEDECIN' && (
                    <div className={styles.documentSection}>
                      {uploadFormFor === appt.id ? (
                        <UploadDocumentForm
                          patientId={appt.patient}
                          onUploaded={() => setUploadFormFor(null)}
                        />
                      ) : (
                        <button onClick={() => setUploadFormFor(appt.id)} className={styles.btnSecondary}>
                          Déposer un document médical
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}