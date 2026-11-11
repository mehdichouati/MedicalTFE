import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient, { fetchAllPages } from '../api/client'
import { getDateLocale } from '../i18n/dateLocale'
import styles from './SecretaryGuardianRequestsPage.module.css'

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED']

function formatDate(isoString, locale) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString(getDateLocale(locale), {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getErrorMessage(err, fallback) {
  const data = err.response?.data
  if (!data) return fallback
  if (data.detail) return data.detail
  const firstError = Object.values(data)[0]
  return Array.isArray(firstError) ? firstError[0] : firstError || fallback
}

// F15 — Validation des liens parentaux par le secretariat.
export default function SecretaryGuardianRequestsPage() {
  const { t, i18n } = useTranslation()

  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [rejectingId, setRejectingId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingId, setSubmittingId] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllPages('/auth/guardian-requests/', { status: statusFilter })
      setRequests(data)
    } catch {
      setError(t('guardian_requests.load_error'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, t])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleViewDocument = async (requestId) => {
    setError('')
    try {
      const { data } = await apiClient.get(`/auth/guardian-requests/${requestId}/document/`, {
        responseType: 'blob',
      })
      const fileUrl = URL.createObjectURL(data)
      window.open(fileUrl, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000)
    } catch {
      setError(t('guardian_requests.document_error'))
    }
  }

  const handleApprove = async (requestId) => {
    setSubmittingId(requestId)
    setError('')
    try {
      await apiClient.post(`/auth/guardian-requests/${requestId}/approve/`)
      loadRequests()
    } catch (err) {
      setError(getErrorMessage(err, t('guardian_requests.action_error')))
    } finally {
      setSubmittingId(null)
    }
  }

  const handleReject = async (requestId) => {
    if (!rejectionReason.trim()) return
    setSubmittingId(requestId)
    setError('')
    try {
      await apiClient.post(`/auth/guardian-requests/${requestId}/reject/`, {
        rejection_reason: rejectionReason.trim(),
      })
      setRejectingId(null)
      setRejectionReason('')
      loadRequests()
    } catch (err) {
      setError(getErrorMessage(err, t('guardian_requests.action_error')))
    } finally {
      setSubmittingId(null)
    }
  }

  const cancelReject = () => {
    setRejectingId(null)
    setRejectionReason('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{t('guardian_requests.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>
        <p className={styles.intro}>{t('guardian_requests.intro')}</p>

        <div className={styles.filterRow} role="tablist">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={statusFilter === status ? styles.filterButtonActive : styles.filterButton}
            >
              {t(`guardian_requests.filter_${status}`)}
            </button>
          ))}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        {loading ? (
          <p className={styles.loadingText}>{t('common.loading')}</p>
        ) : requests.length === 0 ? (
          <p className={styles.emptyText}>{t('guardian_requests.empty')}</p>
        ) : (
          requests.map((request) => (
            <article key={request.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardTitle}>
                  {request.minor_username}
                  <span className={styles.cardAge}>
                    {' '}— {t('dependents.age_years', { age: request.minor_age })}
                  </span>
                </p>
                <span className={`${styles.statusBadge} ${styles[`status${request.status}`]}`}>
                  {t(`dependents.status_${request.status}`)}
                </span>
              </div>

              <p className={styles.cardMeta}>
                {t('guardian_requests.guardian_label')} : {request.guardian_username} ({request.guardian_email})
              </p>
              <p className={styles.cardMeta}>
                {t('guardian_requests.birth_date_label')} : {formatDate(request.minor_date_of_birth, i18n.language)}
                {' · '}
                {t('guardian_requests.requested_on_label')} : {formatDate(request.created_at, i18n.language)}
              </p>

              {request.status !== 'PENDING' && request.reviewed_by_username && (
                <p className={styles.cardMeta}>
                  {t('guardian_requests.reviewed_by_label', {
                    name: request.reviewed_by_username,
                    date: formatDate(request.reviewed_at, i18n.language),
                  })}
                </p>
              )}
              {request.status === 'REJECTED' && request.rejection_reason && (
                <p className={styles.rejectionText}>
                  {t('dependents.rejection_reason_label')} : {request.rejection_reason}
                </p>
              )}

              {request.status === 'PENDING' && (
                <div className={styles.actions}>
                  {request.has_document ? (
                    <button
                      type="button"
                      onClick={() => handleViewDocument(request.id)}
                      className={styles.documentButton}
                    >
                      {t('guardian_requests.view_document')}
                    </button>
                  ) : (
                    <p className={styles.cardMeta}>{t('guardian_requests.no_document')}</p>
                  )}

                  {rejectingId === request.id ? (
                    <div className={styles.rejectForm}>
                      <label htmlFor={`reason-${request.id}`} className={styles.fieldLabel}>
                        {t('guardian_requests.reason_label')}
                      </label>
                      <input
                        id={`reason-${request.id}`}
                        type="text"
                        maxLength={255}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('guardian_requests.reason_placeholder')}
                        className={styles.input}
                      />
                      <div className={styles.buttonRow}>
                        <button
                          type="button"
                          onClick={() => handleReject(request.id)}
                          disabled={!rejectionReason.trim() || submittingId === request.id}
                          className={styles.rejectButton}
                        >
                          {t('guardian_requests.confirm_reject')}
                        </button>
                        <button type="button" onClick={cancelReject} className={styles.abortButton}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.buttonRow}>
                      <button
                        type="button"
                        onClick={() => handleApprove(request.id)}
                        disabled={submittingId === request.id}
                        className={styles.approveButton}
                      >
                        {t('guardian_requests.approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(request.id)}
                        disabled={submittingId === request.id}
                        className={styles.rejectOutlineButton}
                      >
                        {t('guardian_requests.reject')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}