import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'

const STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
  COMPLETED: 'Terminé',
  NO_SHOW: 'Absence',
}

const CARD_STYLE = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 16,
  color: '#e4e7eb',
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [ordering, setOrdering] = useState('-start_datetime')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAppointments = useCallback(() => {
    setLoading(true)
    const params = { page, ordering }
    if (statusFilter) params.status = statusFilter

    apiClient.get('/appointments/', { params })
      .then(({ data }) => {
        // L'API peut renvoyer soit une liste paginee, soit une liste simple
        if (Array.isArray(data)) {
          setAppointments(data)
          setCount(data.length)
        } else {
          setAppointments(data.results)
          setCount(data.count)
        }
      })
      .catch(() => setError('Impossible de charger les rendez-vous.'))
      .finally(() => setLoading(false))
  }, [page, ordering, statusFilter])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const totalPages = Math.ceil(count / 20) || 1

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>Rendez-vous</h1>
          <Link to="/admin/dashboard" style={{ color: '#8ab4f8' }}>Retour au tableau de bord</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 8 }}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: 8 }}>
            <option value="-start_datetime">Trier : Plus récent</option>
            <option value="start_datetime">Trier : Plus ancien</option>
          </select>
        </div>

        {error && <p style={{ color: '#f28b82' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#9aa3b2' }}>Chargement...</p>
        ) : (
          <>
            {appointments.length === 0 && <p style={{ color: '#9aa3b2' }}>Aucun rendez-vous trouvé.</p>}
            {appointments.map((appt) => (
              <div key={appt.id} style={{ ...CARD_STYLE, marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{formatDateTime(appt.start_datetime)}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  Patient : {appt.patient_username} — Professionnel : {appt.professional_username} ({appt.professional_role})
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {appt.medical_house_name} — Statut : {STATUS_LABELS[appt.status] || appt.status}
                  {appt.reason && ` — ${appt.reason}`}
                </p>
              </div>
            ))}

            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', color: '#e4e7eb' }}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ padding: '4px 12px' }}>Précédent</button>
                <span>Page {page} / {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} style={{ padding: '4px 12px' }}>Suivant</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
