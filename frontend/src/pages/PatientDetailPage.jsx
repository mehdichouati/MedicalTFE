import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './PatientDetailPage.module.css'

const DOCUMENT_TYPES_BY_ROLE = {
  MEDECIN: ['LAB_RESULT', 'REPORT', 'PRESCRIPTION_KINE', 'PSY_NOTE', 'OTHER'],
  KINE: ['PRESCRIPTION_KINE'],
  PSYCHOLOGUE: ['PSY_NOTE'],
}

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function UploadForm({ patientId, role, onUploaded }) {
  const { t } = useTranslation()
  const availableTypes = DOCUMENT_TYPES_BY_ROLE[role] || []
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState(availableTypes[0] || 'OTHER')
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
      setTimeout(onUploaded, 1200)
    } catch (err) {
      setError(err.response?.data?.detail || t('patient_detail.upload_error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.uploadForm}>
      <div className={styles.uploadFormRow}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={styles.select}>
          {availableTypes.map((docType) => (
            <option key={docType} value={docType}>{t(`history.doc_type_${docType}`, docType)}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t('patient_detail.upload_title_placeholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.titleInput}
        />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" disabled={submitting || !file || !title} className={styles.uploadButton}>
        {submitting ? t('patient_detail.upload_submitting') : t('patient_detail.upload_submit')}
      </button>
      {success && <p className={styles.successText}>{t('patient_detail.upload_success')}</p>}
      {error && <p className={styles.uploadErrorText}>{error}</p>}
    </form>
  )
}

export default function PatientDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const { user } = useAuth()
  const [history, setHistory] = useState(null)
  const [documents, setDocuments] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState('')

  const loadData = () => {
    apiClient.get('/patients/history/', { params: { patient: id } })
      .then(({ data }) => setHistory(data))
      .catch(() => setError(t('patient_detail.load_error')))
    apiClient.get('/medical-documents/', { params: { patient: id } })
      .then(({ data }) => setDocuments(Array.isArray(data) ? data : data.results))
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p className={styles.errorText}>{error}</p>
        <Link to="/my-patients" className={styles.backLink}>{t('patient_detail.back_link')}</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          {t('patient_detail.title', { username: history?.patient_username || '...' })}
        </h1>
        <p className={styles.backLinkRow}>
          <Link to="/my-patients" className={styles.backLink}>{t('patient_detail.back_link')}</Link>
        </p>

        <h2 className={styles.sectionTitle}>{t('patient_detail.appointments_section')}</h2>
        {history?.appointments?.length === 0 && <p className={styles.emptyText}>{t('patient_detail.no_appointments')}</p>}
        {history?.appointments?.map((appt) => (
          <div key={appt.id} className={styles.card}>
            <p className={styles.cardTitle}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
            <p className={styles.cardMeta}>
              {t(`status.${appt.status}`, appt.status)} {appt.reason && `— ${appt.reason}`}
            </p>
          </div>
        ))}

        <h2 className={styles.sectionTitleSpaced}>{t('patient_detail.documents_section')}</h2>
        {documents.length === 0 && <p className={styles.emptyText}>{t('patient_detail.no_documents')}</p>}
        {documents.map((doc) => (
          <div key={doc.id} className={styles.card}>
            <p className={styles.cardTitle}>{doc.title}</p>
            <p className={styles.cardMeta}>
              {t(`history.doc_type_${doc.document_type}`, doc.document_type)} — {doc.uploaded_by_username} — {formatDateTime(doc.uploaded_at, i18n.language)}
            </p>
            <p className={styles.docLinkRow}>
              <a href={doc.file} target="_blank" rel="noreferrer" className={styles.docLink}>{t('patient_detail.download')}</a>
            </p>
          </div>
        ))}

        {showUpload ? (
          <UploadForm patientId={id} role={user?.role} onUploaded={() => { setShowUpload(false); loadData() }} />
        ) : (
          <button onClick={() => setShowUpload(true)} className={styles.addDocButton}>
            {t('patient_detail.add_document_button')}
          </button>
        )}
      </div>
    </div>
  )
}