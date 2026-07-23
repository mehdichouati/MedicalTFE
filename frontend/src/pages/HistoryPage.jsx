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

async function downloadReceipt(appointmentId) {
  const response = await apiClient.get(`/payments/receipt/${appointmentId}/`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `justificatif-paiement-rdv-${appointmentId}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function HistoryPage() {
  const [history, setHistory] = useState(null)
  const [payments, setPayments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.get('/patients/history/'),
      apiClient.get('/payments/'),
    ])
      .then(([historyRes, paymentsRes]) => {
        setHistory(historyRes.data)
        setPayments(paymentsRes.data)
      })
      .catch(() => setError("Impossible de charger l'historique."))
      .finally(() => setLoading(false))
  }, [])

  const getPaymentForAppointment = (appointmentId) =>
    payments.find((p) => p.appointment === appointmentId)

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
      {history.appointments.map((appt) => {
        const payment = getPaymentForAppointment(appt.id)
        const canPay = appt.status !== 'CANCELLED' && (!payment || payment.status === 'FAILED')

        return (
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
            {payment && (
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                Paiement : {payment.status_display} ({payment.amount_eur} €)
                {payment.refunded_amount_cents > 0 && ` — Remboursé : ${(payment.refunded_amount_cents / 100).toFixed(2)} €`}
              </p>
            )}
            {canPay && (
              <p style={{ marginTop: 8 }}>
                <Link to={`/pay/${appt.id}`}>Payer cette consultation</Link>
              </p>
            )}
           {appt.status === 'COMPLETED' && payment && ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status) && (
              <p style={{ marginTop: 8 }}>
                <button
                  onClick={() => downloadReceipt(appt.id)}
                  style={{ padding: '4px 12px', fontSize: 14 }}
                >
                  Télécharger le document justificatif
                </button>
              </p>
            )}
          </div>
        )
      })}

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

      <h2 style={{ marginTop: 32 }}>Documents</h2>
      <p style={{ fontSize: 14 }}>Fonctionnalité à venir (F5).</p>
    </div>
  )
}