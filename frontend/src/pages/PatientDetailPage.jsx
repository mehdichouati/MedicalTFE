import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './PatientDetailPage.module.css'

const DOC_TYPE_LABELS = {
  LAB_RESULT: 'Résultat de prise de sang',
  REPORT: 'Rapport médical',
  PRESCRIPTION_KINE: 'Prescription pour kinésithérapeute',
  PSY_NOTE: 'Note psychologique',
  OTHER: 'Autre document',
}

const DOCUMENT_TYPES_BY_ROLE = {
  MEDECIN: Object.keys(DOC_TYPE_LABELS),
  KINE: ['PRESCRIPTION_KINE'],
  PSYCHOLOGUE: ['PSY_NOTE'],
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function UploadForm({ patientId, role, onUploaded }) {
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
      setError(err.response?.data?.detail || "Erreur lors de l'envoi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.uploadForm}>
      <div className={styles.uploadFormRow}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={styles.select}>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
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
      {success && <p className={styles.successText}>Document envoyé.</p>}
      {error && <p className={styles.uploadErrorText}>{error}</p>}
    </form>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [history, setHistory] = useState(null)
  const [documents, setDocuments] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState('')

  const loadData = () => {
    apiClient.get('/patients/history/', { params: { patient: id } })
      .then(({ data }) => setHistory(data))
      .catch(() => setError("Impossible de charger le dossier de ce patient."))
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
        <Link to="/my-patients" className={styles.backLink}>← Retour à la liste</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          Dossier de {history?.patient_username || '...'}
        </h1>
        <p className={styles.backLinkRow}>
          <Link to="/my-patients" className={styles.backLink}>← Retour à la liste</Link>
        </p>

        <h2 className={styles.sectionTitle}>Rendez-vous</h2>
        {history?.appointments?.length === 0 && <p className={styles.emptyText}>Aucun rendez-vous.</p>}
        {history?.appointments?.map((appt) => (
          <div key={appt.id} className={styles.card}>
            <p className={styles.cardTitle}>{formatDateTime(appt.start_datetime)}</p>
            <p className={styles.cardMeta}>
              {appt.status} {appt.reason && `— ${appt.reason}`}
            </p>
          </div>
        ))}

        <h2 className={styles.sectionTitleSpaced}>Documents</h2>
        {documents.length === 0 && <p className={styles.emptyText}>Aucun document accessible.</p>}
        {documents.map((doc) => (
          <div key={doc.id} className={styles.card}>
            <p className={styles.cardTitle}>{doc.title}</p>
            <p className={styles.cardMeta}>
              {DOC_TYPE_LABELS[doc.document_type] || doc.document_type} — {doc.uploaded_by_username} — {formatDateTime(doc.uploaded_at)}
            </p>
            <p className={styles.docLinkRow}>
              <a href={doc.file} target="_blank" rel="noreferrer" className={styles.docLink}>Télécharger</a>
            </p>
          </div>
        ))}

        {showUpload ? (
          <UploadForm patientId={id} role={user?.role} onUploaded={() => { setShowUpload(false); loadData() }} />
        ) : (
          <button onClick={() => setShowUpload(true)} className={styles.addDocButton}>
            + Déposer un document
          </button>
        )}
      </div>
    </div>
  )
}