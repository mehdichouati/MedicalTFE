import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

const DOCUMENT_TYPES = ['LAB_RESULT', 'REPORT', 'OTHER']

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function UploadDocumentForm({ patientId, onUploaded }) {
  const { t } = useTranslation()
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
        || t('common.error_generic')
      setError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 10, padding: 10, background: 'var(--color-info-bg)', borderRadius: 6 }}>
      <div style={{ marginBottom: 8 }}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ marginRight: 8 }}>
          {DOCUMENT_TYPES.map((value) => (
            <option key={value} value={value}>{t(`history.doc_type_${value}`)}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t('professional_appointments.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: 4 }}
        />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" disabled={submitting || !file || !title} style={{ marginLeft: 8, padding: '4px 12px' }}>
        {submitting ? '...' : t('common.send')}
      </button>
      {success && <p style={{ color: 'var(--color-ok-text)', fontSize: 13, marginTop: 6 }}>{t('professional_appointments.document_uploaded')}</p>}
      {error && <p style={{ color: 'var(--color-urgence-text)', fontSize: 13, marginTop: 6 }}>{error}</p>}
    </form>
  )
}

export default function ProfessionalAppointmentsPage() {
  const { t, i18n } = useTranslation()
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
      .catch(() => setError(t('history.load_error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAction = async (appointmentId, action) => {
    setActionError('')
    try {
      await apiClient.post(`/appointments/${appointmentId}/${action}/`)
      loadAppointments()
    } catch (err) {
      setActionError(err.response?.data?.detail || t('common.error_generic'))
    }
  }

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('common.loading')}</p>
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>
        <Link to="/app">{t('common.back_to_home')}</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{t('professional_appointments.title')}</h1>
      <p><Link to="/app">{t('common.back_to_home')}</Link></p>

      {actionError && <p style={{ color: 'var(--color-urgence-text)' }}>{actionError}</p>}

      {appointments.length === 0 && (
        <p style={{ fontSize: 14 }}>{t('professional_appointments.no_appointments')}</p>
      )}

      {appointments.map((appt) => (
        <div
          key={appt.id}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>
            {formatDateTime(appt.start_datetime, i18n.language)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            {t('professional_appointments.patient_label')} : {appt.patient_username}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            {t('history.status')} : {t(`status.${appt.status}`)}
            {appt.reason && ` — ${appt.reason}`}
          </p>

          {appt.status === 'PENDING' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
              <button onClick={() => handleAction(appt.id, 'mark-completed')} style={{ padding: '6px 14px' }}>
                {t('professional_appointments.complete_button')}
              </button>
              <button onClick={() => handleAction(appt.id, 'mark-no-show')} style={{ padding: '6px 14px' }}>
                {t('professional_appointments.no_show_button')}
              </button>
            </div>
          )}

          {appt.status === 'COMPLETED' && user?.role === 'MEDECIN' && (
            <div style={{ marginTop: 10 }}>
              {uploadFormFor === appt.id ? (
                <UploadDocumentForm
                  patientId={appt.patient}
                  onUploaded={() => setUploadFormFor(null)}
                />
              ) : (
                <button onClick={() => setUploadFormFor(appt.id)} style={{ padding: '6px 14px' }}>
                  {t('professional_appointments.upload_document_button')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}