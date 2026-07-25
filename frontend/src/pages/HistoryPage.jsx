import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

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

export default function HistoryPage() {
  const { t, i18n } = useTranslation()
  const [history, setHistory] = useState(null)
  const [payments, setPayments] = useState([])
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
  }, [t])

  const getPaymentForAppointment = (appointmentId) =>
    payments.find((p) => p.appointment === appointmentId)

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
    return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('common.loading')}</p>
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>
        <Link to="/">{t('common.back_to_home')}</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{t('history.title')}</h1>
      <p><Link to="/">{t('common.back_to_home')}</Link></p>

      <h2 style={{ marginTop: 32 }}>{t('history.appointments')}</h2>
      {history.appointments.length === 0 && (
        <p style={{ fontSize: 14 }}>{t('history.no_appointments')}</p>
      )}
      {history.appointments.map((appt) => {
        const payment = getPaymentForAppointment(appt.id)
        const canPay = appt.status !== 'CANCELLED' && (!payment || ['PENDING', 'FAILED'].includes(payment.status))

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
              {formatDateTime(appt.start_datetime, i18n.language)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>
              {appt.professional_username} ({appt.professional_role}) — {appt.medical_house_name}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>
              {t('history.status')} : {t(`status.${appt.status}`)}
              {appt.reason && ` — ${appt.reason}`}
            </p>
            {payment && (
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                {t('history.payment')} : {t(`status.${payment.status}`, payment.status_display)} ({payment.amount_eur} €)
                {payment.refunded_amount_cents > 0 && ` — ${t('history.refunded')} : ${(payment.refunded_amount_cents / 100).toFixed(2)} €`}
              </p>
            )}
            {canPay && (
              <p style={{ marginTop: 8 }}>
                <Link to={`/pay/${appt.id}`}>{t('history.pay_button')}</Link>
              </p>
            )}
            {appt.status === 'COMPLETED' && payment && ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status) && (
              <p style={{ marginTop: 8 }}>
                <button
                  onClick={() => downloadReceipt(appt.id)}
                  style={{ padding: '4px 12px', fontSize: 14 }}
                >
                  {t('history.download_receipt')}
                </button>
              </p>
            )}
          </div>
        )
      })}

      <h2 style={{ marginTop: 32 }}>{t('history.triage_section')}</h2>
      {history.triage_assessments.length === 0 && (
        <p style={{ fontSize: 14 }}>{t('history.no_triage')}</p>
      )}
      {history.triage_assessments.map((assessment) => {
        const style = ORIENTATION_STYLES[assessment.orientation] || {}
        return (
          <div
            key={assessment.id}
            style={{ ...style, borderRadius: 8, padding: 16, marginBottom: 12 }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'inherit' }}>
              {t(`orientation.${assessment.orientation}`)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'inherit', opacity: 0.85 }}>
              {formatDateTime(assessment.created_at, i18n.language)}
            </p>
          </div>
        )
      })}

      <h2 style={{ marginTop: 32 }}>{t('history.documents_section')}</h2>
      {documents.length === 0 && (
        <p style={{ fontSize: 14 }}>{t('history.no_documents')}</p>
      )}
      {documents.map((doc) => (
        <div
          key={doc.id}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>
            {doc.title}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            {t(`history.doc_type_${doc.document_type}`)} — {t('history.deposited_by')} {doc.uploaded_by_username} {t('history.on_date')} {formatDateTime(doc.uploaded_at, i18n.language)}
          </p>
          <p style={{ marginTop: 6 }}>
            <a href={doc.file} target="_blank" rel="noreferrer">{t('common.download')}</a>
          </p>
        </div>
      ))}
    </div>
  )
}