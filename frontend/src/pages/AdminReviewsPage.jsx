import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './AdminReviewsPage.module.css'

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED']

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminReviewsPage() {
  const { t, i18n } = useTranslation()
  const [reviews, setReviews] = useState([])
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const loadReviews = () => {
    setLoading(true)
    apiClient.get('/reviews/')
      .then(({ data }) => setReviews(Array.isArray(data) ? data : data.results))
      .catch(() => setError(t('admin_reviews.load_error')))
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
      setActionError(err.response?.data?.detail || t('admin_reviews.moderate_error'))
    }
  }

  const filteredReviews = reviews.filter((r) => r.moderation_status === statusFilter)

  const filterLabels = {
    PENDING: t('admin_reviews.filter_pending'),
    APPROVED: t('admin_reviews.filter_approved'),
    REJECTED: t('admin_reviews.filter_rejected'),
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('admin_reviews.title')}</h1>
          <Link to="/admin/dashboard" className={styles.backLink}>{t('common.back_to_dashboard')}</Link>
        </div>

        <div className={styles.filtersRow}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? styles.filterButtonActive : styles.filterButton}
            >
              {filterLabels[s]}
            </button>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {actionError && <p className={styles.errorText}>{actionError}</p>}

        {loading ? (
          <p className={styles.mutedText}>{t('admin_reviews.loading')}</p>
        ) : (
          <>
            {filteredReviews.length === 0 && <p className={styles.mutedText}>{t('admin_reviews.empty')}</p>}
            {filteredReviews.map((review) => (
              <div key={review.id} className={styles.card}>
                <p className={styles.rating}>
                  {review.rating} / 5 {review.is_anonymous && <span className={styles.anonymousTag}>{t('admin_reviews.anonymous_tag')}</span>}
                </p>
                <p className={styles.reviewMeta}>
                  {review.is_anonymous ? t('admin_reviews.anonymous_patient') : review.patient_username} — {formatDateTime(review.created_at, i18n.language)}
                </p>
                {review.comment && (
                  <p className={styles.reviewComment}>{review.comment}</p>
                )}
                {statusFilter === 'PENDING' && (
                  <div className={styles.moderationActions}>
                    <button onClick={() => handleModerate(review.id, 'APPROVED')} className={styles.moderationButton}>
                      {t('admin_reviews.approve_button')}
                    </button>
                    <button onClick={() => handleModerate(review.id, 'REJECTED')} className={styles.moderationButton}>
                      {t('admin_reviews.reject_button')}
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