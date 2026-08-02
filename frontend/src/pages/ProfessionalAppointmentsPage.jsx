import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './ProfessionalAppointmentsPage.module.css'

const STATUS_COLORS = {
  PENDING: { background: '#fff8e8', color: '#8a6d00' },
  CONFIRMED: { background: '#eef5f8', color: '#0a5c78' },
  CANCELLED: { background: '#fdf2f2', color: '#b3261e' },
  COMPLETED: { background: '#eef6f0', color: '#1f5c39' },
  NO_SHOW: { background: '#fdf2f2', color: '#b3261e' },
}

const WEEKDAY_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const WEEKDAY_LABELS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toLocalISODate(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}

function toISODate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function UploadDocumentForm({ patientId, onUploaded }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('LAB_RESULT')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const DOCUMENT_TYPES = [
    { value: 'LAB_RESULT', label: t('history.doc_type_LAB_RESULT') },
    { value: 'REPORT', label: t('history.doc_type_REPORT') },
    { value: 'OTHER', label: t('history.doc_type_OTHER') },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !title) return
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const formData = new FormData()
      formData.append('patient', patientId)
      formData.append('document_type', documentType)
      formData.append('title', title)
      formData.append('file', file)
      await apiClient.post('/medical-documents/', formData)
      setTitle('')
      setFile(null)
      setSuccess(true)
      setTimeout(onUploaded, 1500)
    } catch (err) {
      console.error('Erreur upload document:', err.response?.data || err.message)
      const detail = err.response?.data?.detail
        || err.response?.data?.patient?.[0]
        || err.response?.data?.file?.[0]
        || t('professional_appointments.upload_error_generic')
      setError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.uploadForm}>
      <div className={styles.uploadFormRow}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={styles.select}>
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t('professional_appointments.upload_title_placeholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.titleInput}
        />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" disabled={submitting || !file || !title} className={styles.uploadButton}>
        {submitting ? t('professional_appointments.upload_submitting') : t('professional_appointments.upload_submit')}
      </button>
      {success && <p className={styles.uploadSuccessText}>{t('professional_appointments.document_uploaded')}</p>}
      {error && <p className={styles.uploadErrorText}>{error}</p>}
    </form>
  )
}

export default function ProfessionalAppointmentsPage() {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language?.startsWith('en')
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [uploadFormFor, setUploadFormFor] = useState(null)

  const now = new Date()
  const todayISO = toLocalISODate(now)

  const [calendarMonth, setCalendarMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selectedDate, setSelectedDate] = useState(todayISO)

  const loadAppointments = () => {
    setLoading(true)
    apiClient.get('/appointments/')
      .then(({ data }) => setAppointments(Array.isArray(data) ? data : data.results))
      .catch(() => setError(t('professional_appointments.load_error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  const handleAction = async (appointmentId, action) => {
    setActionError('')
    try {
      await apiClient.post(`/appointments/${appointmentId}/${action}/`)
      loadAppointments()
    } catch (err) {
      setActionError(err.response?.data?.detail || t('common.error_generic'))
    }
  }

  const goPrevMonth = () => {
    setCalendarMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  const goNextMonth = () => {
    setCalendarMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }
  const goToday = () => {
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDate(todayISO)
  }

  const appointmentDatesSet = new Set(
    appointments.map((appt) => toLocalISODate(new Date(appt.start_datetime)))
  )

  const dayAppointments = appointments
    .filter((appt) => toLocalISODate(new Date(appt.start_datetime)) === selectedDate)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1)
    .toLocaleDateString(isEnglish ? 'en-GB' : 'fr-BE', { month: 'long', year: 'numeric' })
  const weeks = buildMonthGrid(calendarMonth.year, calendarMonth.month)
  const weekdayLabels = isEnglish ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS_FR
  const selectedDateLabel = new Date(selectedDate + 'T00:00:00')
    .toLocaleDateString(isEnglish ? 'en-GB' : 'fr-BE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{t('professional_appointments.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>

        {actionError && <p className={styles.errorText}>{actionError}</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.calendarWrap}>
          <div className={styles.calendarHeader}>
            <button type="button" onClick={goPrevMonth} className={styles.calendarNavBtn}>‹</button>
            <span className={styles.calendarMonthLabel}>{monthLabel}</span>
            <button type="button" onClick={goNextMonth} className={styles.calendarNavBtn}>›</button>
          </div>
          <div className={styles.calendarGrid}>
            {weekdayLabels.map((wd, i) => (
              <div key={i} className={styles.calendarWeekday}>{wd}</div>
            ))}
            {weeks.flat().map((day, i) => {
              if (day === null) return <div key={i} className={styles.calendarDayEmpty} />
              const iso = toISODate(calendarMonth.year, calendarMonth.month, day)
              const isSelected = iso === selectedDate
              const hasAppointments = appointmentDatesSet.has(iso)
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedDate(iso)}
                  className={isSelected ? styles.calendarDaySelected : styles.calendarDay}
                >
                  {day}
                  {hasAppointments && !isSelected && <span className={styles.calendarDayDot} />}
                </button>
              )
            })}
          </div>
          <button type="button" onClick={goToday} className={styles.todayButton}>{t('professional_appointments.today_button')}</button>
        </div>

        <h2 className={styles.selectedDateTitle}>{selectedDateLabel}</h2>

        {loading ? (
          <p className={styles.loadingText}>{t('common.loading')}</p>
        ) : (
          <>
            {dayAppointments.length === 0 && (
              <p className={styles.loadingText}>{t('professional_appointments.no_appointments_today')}</p>
            )}
            {dayAppointments.map((appt) => {
              const statusColor = STATUS_COLORS[appt.status] || {}
              return (
                <div key={appt.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.appointmentDate}>{formatDateTime(appt.start_datetime, i18n.language)}</p>
                      <p className={styles.appointmentMeta}>
                        {t('professional_appointments.patient_label')} : {appt.patient_username}
                        {appt.reason && ` — ${appt.reason}`}
                      </p>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ background: statusColor.background, color: statusColor.color }}
                    >
                      {t(`status.${appt.status}`, appt.status)}
                    </span>
                  </div>

                  {appt.status === 'PENDING' && new Date(appt.start_datetime) <= new Date() && (
                    <div className={styles.actionsRow}>
                      <button onClick={() => handleAction(appt.id, 'mark-completed')} className={styles.btnPrimary}>
                        {t('professional_appointments.complete_button')}
                      </button>
                      <button onClick={() => handleAction(appt.id, 'mark-no-show')} className={styles.btnSecondary}>
                        {t('professional_appointments.no_show_button')}
                      </button>
                    </div>
                  )}

                  {appt.status === 'PENDING' && new Date(appt.start_datetime) > new Date() && (
                    <p className={styles.loadingText}>{t('professional_appointments.actions_available_after')}</p>
                  )}

                  {appt.status === 'COMPLETED' && user?.role === 'MEDECIN' && (
                    <div className={styles.documentSection}>
                      {uploadFormFor === appt.id ? (
                        <UploadDocumentForm
                          patientId={appt.patient}
                          onUploaded={() => setUploadFormFor(null)}
                        />
                      ) : (
                        <button onClick={() => setUploadFormFor(appt.id)} className={styles.btnSecondary}>
                          {t('professional_appointments.upload_document_button')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}