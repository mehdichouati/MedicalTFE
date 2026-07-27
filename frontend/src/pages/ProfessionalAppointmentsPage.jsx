import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

const DOCUMENT_TYPES = [
  { value: 'LAB_RESULT', label: 'Résultat de prise de sang' },
  { value: 'REPORT', label: 'Rapport médical' },
  { value: 'OTHER', label: 'Autre document' },
]

const STATUS_STYLES = {
  PENDING: { bg: '#fff8e8', color: '#8a6d00', label: 'En attente' },
  CONFIRMED: { bg: '#eef5f8', color: '#0a5c78', label: 'Confirmé' },
  CANCELLED: { bg: '#fdf2f2', color: '#b3261e', label: 'Annulé' },
  COMPLETED: { bg: '#eef6f0', color: '#1f5c39', label: 'Terminé' },
  NO_SHOW: { bg: '#fdf2f2', color: '#b3261e', label: 'Absence' },
}

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 14,
  padding: 20,
  boxShadow: '0 2px 10px rgba(10,92,120,0.06)',
  border: '1px solid #eef1f4',
  marginBottom: 14,
}

const BTN_PRIMARY = {
  padding: '8px 16px',
  background: '#0a5c78',
  color: '#fff',
  border: 'none',
  borderRadius: 20,
  fontSize: 13,
  cursor: 'pointer',
}

const BTN_SECONDARY = {
  padding: '8px 16px',
  background: '#fff',
  color: '#0a5c78',
  border: '1.5px solid #0a5c78',
  borderRadius: 20,
  fontSize: 13,
  cursor: 'pointer',
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
    <form onSubmit={handleSubmit} style={{ marginTop: 12, padding: 14, background: '#eef5f8', borderRadius: 10 }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ padding: 6, borderRadius: 8, border: '1px solid #dbe2e8' }}>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Titre du document"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: 6, borderRadius: 8, border: '1px solid #dbe2e8', flex: 1 }}
        />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" disabled={submitting || !file || !title} style={{ ...BTN_PRIMARY, marginLeft: 8 }}>
        {submitting ? 'Envoi...' : 'Déposer'}
      </button>
      {success && <p style={{ color: '#1f5c39', fontSize: 13, marginTop: 6 }}>Document envoyé avec succès.</p>}
      {error && <p style={{ color: '#b3261e', fontSize: 13, marginTop: 6 }}>{error}</p>}
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
    <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ color: '#0a5c78', fontSize: 30, marginBottom: 4 }}>Mes rendez-vous</h1>
        <p style={{ marginBottom: 24 }}>
          <Link to="/app" style={{ color: '#0a5c78', fontSize: 14 }}>← Retour à l'accueil</Link>
        </p>

        {actionError && <p style={{ color: '#b3261e' }}>{actionError}</p>}
        {error && <p style={{ color: '#b3261e' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#52606d' }}>Chargement...</p>
        ) : (
          <>
            {appointments.length === 0 && <p style={{ color: '#52606d' }}>Aucun rendez-vous pour le moment.</p>}
            {appointments.map((appt) => {
              const statusStyle = STATUS_STYLES[appt.status] || {}
              return (
                <div key={appt.id} style={CARD_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: '#52606d' }}>
                        Patient : {appt.patient_username}
                        {appt.reason && ` — ${appt.reason}`}
                      </p>
                    </div>
                    <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {statusStyle.label || appt.status}
                    </span>
                  </div>

                  {appt.status === 'PENDING' && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                      <button onClick={() => handleAction(appt.id, 'mark-completed')} style={BTN_PRIMARY}>
                        Terminer la consultation
                      </button>
                      <button onClick={() => handleAction(appt.id, 'mark-no-show')} style={BTN_SECONDARY}>
                        Signaler une absence
                      </button>
                    </div>
                  )}

                  {appt.status === 'COMPLETED' && user?.role === 'MEDECIN' && (
                    <div style={{ marginTop: 14 }}>
                      {uploadFormFor === appt.id ? (
                        <UploadDocumentForm
                          patientId={appt.patient}
                          onUploaded={() => setUploadFormFor(null)}
                        />
                      ) : (
                        <button onClick={() => setUploadFormFor(appt.id)} style={BTN_SECONDARY}>
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
