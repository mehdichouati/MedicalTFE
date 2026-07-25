import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']

const CARD_STYLE = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 16,
  color: '#e4e7eb',
}

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminAppointmentsPage() {
  const { t, i18n } = useTranslation()
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
        if (Array.isArray(data)) {
          setAppointments(data)
          setCount(data.length)
        } else {
          setAppointments(data.results)
          setCount(data.count)
        }
      })
      .catch(() => setError(t('common.error_generic')))
      .finally(() => setLoading(false))
  }, [page, ordering, statusFilter, t])

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
          <h1 style={{ color: '#fff', margin: 0 }}>{t('admin_appointments.title')}</h1>
          <Link to="/admin/dashboard" style={{ color: '#8ab4f8' }}>{t('common.back_to_dashboard')}</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 8 }}>
            <option value="">{t('admin_appointments.all_statuses')}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{t(`status.${value}`)}</option>
            ))}
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: 8 }}>
            <option value="-start_datetime">{t('admin_appointments.sort_newest')}</option>
            <option value="start_datetime">{t('admin_appointments.sort_oldest')}</option>
          </select>
        </div>

        {error && <p style={{ color: '#f28b82' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#9aa3b2' }}>{t('common.loading')}</p>
        ) : (
          <>
            {appointments.length === 0 && <p style={{ color: '#9aa3b2' }}>{t('admin_appointments.no_appointments')}</p>}
            {appointments.map((appt) => (
              <div key={appt.id} style={{ ...CARD_STYLE, marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {t('professional_appointments.patient_label')} : {appt.patient_username} — {t(`roles.${appt.professional_role}`)} : {appt.professional_username}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {appt.medical_house_name} — {t('history.status')} : {t(`status.${appt.status}`)}
                  {appt.reason && ` — ${appt.reason}`}
                </p>
              </div>
            ))}

            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', color: '#e4e7eb' }}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ padding: '4px 12px' }}>{t('common.previous')}</button>
                <span>{t('common.page_of', { current: page, total: totalPages })}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} style={{ padding: '4px 12px' }}>{t('common.next')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}