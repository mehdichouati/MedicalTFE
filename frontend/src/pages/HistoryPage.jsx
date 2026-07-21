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

const ORIENTATION_STYLES = {
  URGENCE: {
    background: 'var(--color-urgence-bg)',
    border: '1px solid var(--color-urgence-border)',
    color: 'var(--color-urgence-text)',
  },
  CONSULTATION_SUR_PLACE: {
    background: 'var(--color-attention-bg)',
    border: '1px solid var(--color-attention-border)',
    color: 'var(--color-attention-text)',
  },
  TELECONSULTATION: {
    background: 'var(--color-info-bg)',
    border: '1px solid var(--color-info-border)',
    color: 'var(--color-info-text)',
  },
  REPOS: {
    background: 'var(--color-ok-bg)',
    border: '1px solid var(--color-ok-border)',
    color: 'var(--color-ok-text)',
  },
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPage() {
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient.get('/patients/history/')
      .then(({ data }) => setHistory(data))
      .catch(() => setError("Impossible de charger l'historique."))
      .finally(() => setLoading(false))
  }, [])

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
      <h1>Mon historique</h1>
      <p><Link to="/">Retour à l'accueil</Link></p>

      <h2 style={{ marginTop: 32 }}>Rendez-vous</h2>
      {history.appointments.length === 0 && (
        <p style={{ fontSize: 14 }}>Aucun rendez-vous pour le moment.</p>
      )}
      {history.appointments.map((appt) => (
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
            {appt.professional_username} ({appt.professional_role}) — {appt.medical_house_name}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            Statut : {STATUS_LABELS[appt.status] || appt.status}
            {appt.reason && ` — ${appt.reason}`}
          </p>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Évaluations d'orientation</h2>
      {history.triage_assessments.length === 0 && (
        <p style={{ fontSize: 14 }}>Aucune évaluation pour le moment.</p>
      )}
      {history.triage_assessments.map((assessment) => {
        const style = ORIENTATION_STYLES[assessment.orientation] || {}
        return (
          <div
            key={assessment.id}
            style={{ ...style, borderRadius: 8, padding: 16, marginBottom: 12 }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'inherit' }}>
              {assessment.orientation_display}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'inherit', opacity: 0.85 }}>
              {formatDateTime(assessment.created_at)}
            </p>
          </div>
        )
      })}

      <h2 style={{ marginTop: 32 }}>Paiements</h2>
      <p style={{ fontSize: 14 }}>Fonctionnalité à venir (F4).</p>

      <h2 style={{ marginTop: 32 }}>Documents</h2>
      <p style={{ fontSize: 14 }}>Fonctionnalité à venir (F5).</p>
    </div>
  )
}
