import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import apiClient from '../api/client'

const CARD_STYLE = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 16,
  color: '#e4e7eb',
}

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED']

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const loadReviews = () => {
    setLoading(true)
    apiClient.get('/reviews/')
      .then(({ data }) => setReviews(Array.isArray(data) ? data : data.results))
      .catch(() => setError('Impossible de charger les avis.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReviews()
  }, [])

  const handleModerate = async (reviewId, newStatus) => {
    setActionError('')
    try {
      await apiClient.patch(`/reviews/${reviewId}/moderate/`, { moderation_status: newStatus })
      loadReviews()
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Erreur lors de la modération.')
    }
  }

  const filteredReviews = reviews.filter((r) => r.moderation_status === statusFilter)

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>Modération des avis</h1>
          <Link to="/admin/dashboard" style={{ color: '#8ab4f8' }}>Retour au tableau de bord</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px',
                background: statusFilter === s ? '#5b8def' : '#1f2430',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
              }}
            >
              {s === 'PENDING' ? 'En attente' : s === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
            </button>
          ))}
        </div>

        {error && <p style={{ color: '#f28b82' }}>{error}</p>}
        {actionError && <p style={{ color: '#f28b82' }}>{actionError}</p>}

        {loading ? (
          <p style={{ color: '#9aa3b2' }}>Chargement...</p>
        ) : (
          <>
            {filteredReviews.length === 0 && <p style={{ color: '#9aa3b2' }}>Aucun avis dans cette catégorie.</p>}
            {filteredReviews.map((review) => (
              <div key={review.id} style={{ ...CARD_STYLE, marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {review.rating} / 5 {review.is_anonymous && <span style={{ fontSize: 12, color: '#9aa3b2' }}>(anonyme)</span>}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {review.is_anonymous ? 'Patient anonyme' : review.patient_username} — {formatDateTime(review.created_at)}
                </p>
                {review.comment && (
                  <p style={{ margin: '8px 0 0', fontSize: 14 }}>{review.comment}</p>
                )}
                {statusFilter === 'PENDING' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button onClick={() => handleModerate(review.id, 'APPROVED')} style={{ padding: '4px 12px' }}>
                      Approuver
                    </button>
                    <button onClick={() => handleModerate(review.id, 'REJECTED')} style={{ padding: '4px 12px' }}>
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
