import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './AdminAppointmentsPage.module.css'

const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminAppointmentsPage() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const dateFilter = searchParams.get('date') || ''
  const statusInFilter = searchParams.get('status_in') || ''
  const [appointments, setAppointments] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [ordering, setOrdering] = useState('-start_datetime')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAppointments = useCallback(() => {
    setLoading(true)
    const params = { page, ordering }
    if (statusFilter) params.status = statusFilter
    if (dateFilter) params.date = dateFilter
    if (statusInFilter) params.status_in = statusInFilter

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
  }, [page, ordering, statusFilter, dateFilter, statusInFilter, t])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const totalPages = Math.ceil(count / 20) || 1

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('admin_appointments.title')}</h1>
          <Link to="/admin/dashboard" className={styles.backLink}>{t('common.back_to_dashboard')}</Link>
        </div>

        <div className={styles.filtersRow}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.selectInput}>
            <option value="">{t('admin_appointments.all_statuses')}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{t(`status.${value}`)}</option>
            ))}
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={styles.selectInput}>
            <option value="-start_datetime">{t('admin_appointments.sort_newest')}</option>
            <option value="start_datetime">{t('admin_appointments.sort_oldest')}</option>
          </select>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        {loading ? (
          <p className={styles.mutedText}>{t('common.loading')}</p>
        ) : (
          <>
            {appointments.length === 0 && <p className={styles.mutedText}>{t('admin_appointments.no_appointments')}</p>}
            {appointments.map((appt) => (
              <div key={appt.id} className={styles.card}>
                <p className={styles.appointmentDate}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
                <p className={styles.appointmentMeta}>
                  {t('professional_appointments.patient_label')} : {appt.patient_username} — {t(`roles.${appt.professional_role}`)} : {appt.professional_username}
                </p>
                <p className={styles.appointmentMeta}>
                  {appt.medical_house_name} — {t('history.status')} : {t(`status.${appt.status}`)}
                  {appt.reason && ` — ${appt.reason}`}
                </p>
              </div>
            ))}

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className={styles.paginationButton}>{t('common.previous')}</button>
                <span>{t('common.page_of', { current: page, total: totalPages })}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className={styles.paginationButton}>{t('common.next')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}