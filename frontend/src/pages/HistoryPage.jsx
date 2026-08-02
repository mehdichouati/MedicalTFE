import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './HistoryPage.module.css'

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

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ReviewForm({ appointmentId, onSubmitted }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await apiClient.post('/reviews/', {
        appointment: appointmentId,
        rating,
        comment,
        is_anonymous: isAnonymous,
      })
      onSubmitted()
    } catch (err) {
      const detail = err.response?.data?.comment?.[0]
        || err.response?.data?.appointment?.[0]
        || err.response?.data?.detail
        || "Erreur lors de l'envoi de l'avis."
      setError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.reviewForm}>
      <div className={styles.reviewFormRow}>
        <label>Note : </label>
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className={styles.reviewSelect}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} / 5</option>
          ))}
        </select>
      </div>
      <textarea
        placeholder={rating <= 3 ? 'Commentaire (obligatoire pour cette note)' : 'Commentaire (facultatif)'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        className={styles.reviewTextarea}
      />
      <label className={styles.reviewCheckboxLabel}>
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
        Publier anonymement
      </label>
      {error && <p className={styles.reviewError}>{error}</p>}
      <button type="submit" disabled={submitting} className={styles.reviewSubmitButton}>
        {submitting ? '...' : "Envoyer l'avis"}
      </button>
    </form>
  )
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation()
  const [history, setHistory] = useState(null)
  const [payments, setPayments] = useState([])
  const [documents, setDocuments] = useState([])
  const [reviews, setReviews] = useState([])
  const [openReviewFor, setOpenReviewFor] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadReviews = () => {
    apiClient.get('/reviews/')
      .then(({ data }) => setReviews(Array.isArray(data) ? data : data.results))
      .catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      apiClient.get('/patients/history/'),
      apiClient.get('/payments/'),
      apiClient.get('/medical-documents/'),
    ])
      .then(([historyRes, paymentsRes, documentsRes]) => {
        setHistory(historyRes.data)
        setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : paymentsRes.data.results)
        setDocuments(Array.isArray(documentsRes.data) ? documentsRes.data : documentsRes.data.results)
      })
      .catch(() => setError(t('history.load_error')))
      .finally(() => setLoading(false))
    loadReviews()
  }, [t])

  const getPaymentForAppointment = (appointmentId) =>
    payments.find((p) => p.appointment === appointmentId)

  const getReviewForAppointment = (appointmentId) =>
    reviews.find((r) => r.appointment === appointmentId)

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

  if (loading) {
    return <p className={styles.loadingCenter}>{t('common.loading')}</p>
  }

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p className={styles.errorText}>{error}</p>
        <Link to="/app">{t('common.back_to_home')}</Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1>{t('history.title')}</h1>
      <p><Link to="/app">{t('common.back_to_home')}</Link></p>

      <h2 className={styles.sectionTitle}>{t('history.appointments')}</h2>
      {history.appointments.length === 0 && (
        <p className={styles.emptyText}>{t('history.no_appointments')}</p>
      )}
      <div className={styles.scrollableList}>
        {history.appointments.map((appt) => {
          const payment = getPaymentForAppointment(appt.id)
          const canPay = appt.status !== 'CANCELLED' && (!payment || ['PENDING', 'FAILED'].includes(payment.status))

          return (
            <div key={appt.id} className={styles.card}>
              <p className={styles.cardDate}>
                {formatDateTime(appt.start_datetime, i18n.language)}
              </p>
              <p className={styles.cardMeta}>
                {appt.professional_username} ({appt.professional_role}) — {appt.medical_house_name}
              </p>
              <p className={styles.cardMeta}>
                {t('history.status')} : {t(`status.${appt.status}`)}
                {appt.reason && ` — ${appt.reason}`}
              </p>
              {payment && (
                <p className={styles.cardMeta}>
                  {t('history.payment')} : {t(`status.${payment.status}`, payment.status_display)} ({payment.amount_eur} €)
                  {payment.refunded_amount_cents > 0 && ` — ${t('history.refunded')} : ${(payment.refunded_amount_cents / 100).toFixed(2)} €`}
                </p>
              )}
              {canPay && (
                <p className={styles.actionRow}>
                  <Link to={`/pay/${appt.id}`}>{t('history.pay_button')}</Link>
                </p>
              )}
              {appt.status === 'COMPLETED' && payment && ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status) && (
                <p className={styles.actionRow}>
                  <button onClick={() => downloadReceipt(appt.id)} className={styles.downloadButton}>
                    {t('history.download_receipt')}
                  </button>
                </p>
              )}

              {appt.status === 'COMPLETED' && (() => {
                const review = getReviewForAppointment(appt.id)
                if (review) {
                  return (
                    <p className={styles.reviewStatus}>
                      Votre avis ({review.rating}/5) — {review.moderation_status_display}
                    </p>
                  )
                }
                if (openReviewFor === appt.id) {
                  return (
                    <ReviewForm
                      appointmentId={appt.id}
                      onSubmitted={() => { setOpenReviewFor(null); loadReviews() }}
                    />
                  )
                }
                return (
                  <p className={styles.actionRow}>
                    <button onClick={() => setOpenReviewFor(appt.id)} className={styles.reviewOpenButton}>
                      Évaluer cette consultation
                    </button>
                  </p>
                )
              })()}
            </div>
          )
        })}
      </div>

      <h2 className={styles.sectionTitle}>{t('history.triage_section')}</h2>
      {history.triage_assessments.length === 0 && (
        <p className={styles.emptyText}>{t('history.no_triage')}</p>
      )}
      <div className={styles.scrollableList}>
        {history.triage_assessments.map((assessment) => {
          const style = ORIENTATION_STYLES[assessment.orientation] || {}
          return (
            <div key={assessment.id} className={styles.orientationCard} style={style}>
              <p className={styles.orientationTitle}>
                {t(`orientation.${assessment.orientation}`)}
              </p>
              <p className={styles.orientationDate}>
                {formatDateTime(assessment.created_at, i18n.language)}
              </p>
            </div>
          )
        })}
      </div>

      <h2 className={styles.sectionTitle}>{t('history.documents_section')}</h2>
      {documents.length === 0 && (
        <p className={styles.emptyText}>{t('history.no_documents')}</p>
      )}
      <div className={styles.scrollableList}>
        {documents.map((doc) => (
          <div key={doc.id} className={styles.card}>
            <p className={styles.docTitle}>{doc.title}</p>
            <p className={styles.docMeta}>
              {t(`history.doc_type_${doc.document_type}`)} — {t('history.deposited_by')} {doc.uploaded_by_username} {t('history.on_date')} {formatDateTime(doc.uploaded_at, i18n.language)}
            </p>
            <p className={styles.docLinkRow}>
              <a href={doc.file} target="_blank" rel="noreferrer">{t('common.download')}</a>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}