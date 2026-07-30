import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import apiClient from '../api/client'
import styles from './AdminReviewsPage.module.css'

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
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Modération des avis</h1>
          <Link to="/admin/dashboard" className={styles.backLink}>Retour au tableau de bord</Link>
        </div>

        <div className={styles.filtersRow}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? styles.filterButtonActive : styles.filterButton}
            >
              {s === 'PENDING' ? 'En attente' : s === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
            </button>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {actionError && <p className={styles.errorText}>{actionError}</p>}

        {loading ? (
          <p className={styles.mutedText}>Chargement...</p>
        ) : (
          <>
            {filteredReviews.length === 0 && <p className={styles.mutedText}>Aucun avis dans cette catégorie.</p>}
            {filteredReviews.map((review) => (
              <div key={review.id} className={styles.card}>
                <p className={styles.rating}>
                  {review.rating} / 5 {review.is_anonymous && <span className={styles.anonymousTag}>(anonyme)</span>}
                </p>
                <p className={styles.reviewMeta}>
                  {review.is_anonymous ? 'Patient anonyme' : review.patient_username} — {formatDateTime(review.created_at)}
                </p>
                {review.comment && (
                  <p className={styles.reviewComment}>{review.comment}</p>
                )}
                {statusFilter === 'PENDING' && (
                  <div className={styles.moderationActions}>
                    <button onClick={() => handleModerate(review.id, 'APPROVED')} className={styles.moderationButton}>
                      Approuver
                    </button>
                    <button onClick={() => handleModerate(review.id, 'REJECTED')} className={styles.moderationButton}>
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