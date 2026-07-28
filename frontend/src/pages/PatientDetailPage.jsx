import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

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

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 2px 10px rgba(10,92,120,0.06)',
  border: '1px solid #eef1f4',
  marginBottom: 12,
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
    <form onSubmit={handleSubmit} style={{ marginTop: 12, padding: 14, background: '#eef5f8', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ padding: 6, borderRadius: 8, border: '1px solid #dbe2e8' }}>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
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
      <button type="submit" disabled={submitting || !file || !title} style={{ marginLeft: 8, padding: '6px 14px', background: '#0a5c78', color: '#fff', border: 'none', borderRadius: 16 }}>
        {submitting ? 'Envoi...' : 'Déposer'}
      </button>
      {success && <p style={{ color: '#1f5c39', fontSize: 13, marginTop: 6 }}>Document envoyé.</p>}
      {error && <p style={{ color: '#b3261e', fontSize: 13, marginTop: 6 }}>{error}</p>}
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
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#b3261e' }}>{error}</p>
        <Link to="/my-patients" style={{ color: '#0a5c78' }}>← Retour à la liste</Link>
      </div>
    )
  }

  return (
    <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ color: '#0a5c78', fontSize: 28, marginBottom: 4 }}>
          Dossier de {history?.patient_username || '...'}
        </h1>
        <p style={{ marginBottom: 24 }}>
          <Link to="/my-patients" style={{ color: '#0a5c78', fontSize: 14 }}>← Retour à la liste</Link>
        </p>

        <h2 style={{ color: '#0a5c78', fontSize: 18 }}>Rendez-vous</h2>
        {history?.appointments?.length === 0 && <p style={{ color: '#52606d' }}>Aucun rendez-vous.</p>}
        {history?.appointments?.map((appt) => (
          <div key={appt.id} style={CARD_STYLE}>
            <p style={{ margin: 0, fontWeight: 700 }}>{formatDateTime(appt.start_datetime)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52606d' }}>
              {appt.status} {appt.reason && `— ${appt.reason}`}
            </p>
          </div>
        ))}

        <h2 style={{ color: '#0a5c78', fontSize: 18, marginTop: 28 }}>Documents</h2>
        {documents.length === 0 && <p style={{ color: '#52606d' }}>Aucun document accessible.</p>}
        {documents.map((doc) => (
          <div key={doc.id} style={CARD_STYLE}>
            <p style={{ margin: 0, fontWeight: 700 }}>{doc.title}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52606d' }}>
              {DOC_TYPE_LABELS[doc.document_type] || doc.document_type} — {doc.uploaded_by_username} — {formatDateTime(doc.uploaded_at)}
            </p>
            <p style={{ marginTop: 6 }}>
              <a href={doc.file} target="_blank" rel="noreferrer" style={{ color: '#0a5c78', fontSize: 13 }}>Télécharger</a>
            </p>
          </div>
        ))}

        {showUpload ? (
          <UploadForm patientId={id} role={user?.role} onUploaded={() => { setShowUpload(false); loadData() }} />
        ) : (
          <button
            onClick={() => setShowUpload(true)}
            style={{ marginTop: 12, padding: '8px 18px', background: '#fff', color: '#0a5c78', border: '1.5px solid #0a5c78', borderRadius: 20, cursor: 'pointer' }}
          >
            + Déposer un document
          </button>
        )}
      </div>
    </div>
  )
}
