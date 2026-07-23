import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'

const STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirme',
  CANCELLED: 'Annule',
  COMPLETED: 'Termine',
  NO_SHOW: 'Absence',
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ProfessionalAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  const loadAppointments = () => {
    setLoading(true)
    apiClient.get('/appointments/')
      .then(({ data }) => setAppointments(data))
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

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: 80 }}>Chargement...</p>
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>
        <Link to="/">Retour à l'accueil</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Mes rendez-vous</h1>
      <p><Link to="/">Retour à l'accueil</Link></p>

      {actionError && <p style={{ color: 'var(--color-urgence-text)' }}>{actionError}</p>}

      {appointments.length === 0 && (
        <p style={{ fontSize: 14 }}>Aucun rendez-vous pour le moment.</p>
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
            {formatDateTime(appt.start_datetime)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            Patient : {appt.patient_username}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            Statut : {STATUS_LABELS[appt.status] || appt.status}
            {appt.reason && ` — ${appt.reason}`}
          </p>

          {appt.status === 'PENDING' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
              <button onClick={() => handleAction(appt.id, 'mark-completed')} style={{ padding: '6px 14px' }}>
                Terminer la consultation
              </button>
              <button onClick={() => handleAction(appt.id, 'mark-no-show')} style={{ padding: '6px 14px' }}>
                Signaler une absence
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
