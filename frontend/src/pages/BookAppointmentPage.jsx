import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './BookAppointmentPage.module.css'

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED']

const WEEKDAY_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const WEEKDAY_LABELS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatSlotTime(isoString, locale) {
  return new Date(isoString).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function formatAppointmentDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function toISODate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7 // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function BookAppointmentPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isEnglish = i18n.language?.startsWith('en')

  const now = new Date()
  const todayISO = toISODate(now.getFullYear(), now.getMonth(), now.getDate())

  const [house, setHouse] = useState(null)
  const [dependents, setDependents] = useState([])
  const [bookingFor, setBookingFor] = useState('self')
  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  const [calendarMonth, setCalendarMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const [myAppointments, setMyAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [cancelSubmittingId, setCancelSubmittingId] = useState(null)
  const [cancelError, setCancelError] = useState('')

  const loadMyAppointments = () => {
    setLoadingAppointments(true)
    apiClient.get('/appointments/')
      .then(({ data }) => {
        const all = Array.isArray(data) ? data : data.results
        const nowISO = new Date().toISOString()
        setMyAppointments(all.filter((appt) => appt.start_datetime >= nowISO))
      })
      .catch(() => {})
      .finally(() => setLoadingAppointments(false))
  }

  useEffect(() => {
    apiClient.get('/public/medical-house/').then(({ data }) => setHouse(data)).catch(() => {})
    apiClient.get('/auth/dependents/')
      .then(({ data }) => setDependents(Array.isArray(data) ? data : data.results))
      .catch(() => {})
    loadMyAppointments()
  }, [])

  useEffect(() => {
    setSlots([])
    setSelectedSlot(null)
    if (!professionalId || !date || !house) return

    setLoadingSlots(true)
    apiClient.get('/appointments/available-slots/', {
      params: { professional: professionalId, medical_house: house.id, date },
    })
      .then(({ data }) => setSlots(data.slots))
      .catch(() => setError(t('book_appointment.error_slots')))
      .finally(() => setLoadingSlots(false))
  }, [professionalId, date, house, t])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSlot) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        professional: professionalId,
        medical_house: house.id,
        start_datetime: selectedSlot.start,
        end_datetime: selectedSlot.end,
        reason,
      }
      if (bookingFor !== 'self') {
        payload.patient = bookingFor
      }
      const { data } = await apiClient.post('/appointments/', payload)
      setSuccess(data)
      loadMyAppointments()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setError(Array.isArray(firstError) ? firstError[0] : firstError || t('book_appointment.error_booking'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelAppointment = async (id) => {
    setCancelSubmittingId(id)
    setCancelError('')
    try {
      await apiClient.delete(`/appointments/${id}/`)
      setCancellingId(null)
      loadMyAppointments()
    } catch (err) {
      setCancelError(err.response?.data?.detail || t('book_appointment.error_cancel'))
    } finally {
      setCancelSubmittingId(null)
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
  const isPrevDisabled = calendarMonth.year === now.getFullYear() && calendarMonth.month === now.getMonth()

  const professionals = house?.staff?.filter((s) => ['MEDECIN', 'KINE', 'PSYCHOLOGUE'].includes(s.role)) || []
  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1)
    .toLocaleDateString(isEnglish ? 'en-GB' : 'fr-BE', { month: 'long', year: 'numeric' })
  const weeks = buildMonthGrid(calendarMonth.year, calendarMonth.month)
  const weekdayLabels = isEnglish ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS_FR

  if (success) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✅</div>
            <h1 className={styles.successTitle}>{t('book_appointment.success_title')}</h1>
            <p className={styles.successText}>{t('book_appointment.success_text')}</p>
            <div className={styles.successActions}>
              <button onClick={() => navigate(`/pay/${success.id}`)} className={styles.btnPrimary}>
                {t('book_appointment.pay_now')}
              </button>
              <Link to="/history">
                <button className={styles.btnSecondary}>{t('book_appointment.view_history')}</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{t('book_appointment.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>

        <form onSubmit={handleSubmit} className={styles.formCard}>
          {dependents.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('book_appointment.for_whom_label')}</label>
              <select value={bookingFor} onChange={(e) => setBookingFor(e.target.value)} className={styles.input}>
                <option value="self">{t('book_appointment.myself_option', { username: user?.username })}</option>
                {dependents.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.username} ({t('dependents.age_years', { age: dep.age })})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('book_appointment.professional_label')}</label>
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required className={styles.input}>
              <option value="">{t('book_appointment.select_professional')}</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} — {t(`roles.${p.role}`, p.role)}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('book_appointment.date_label')}</label>
            <div className={styles.calendarWrap}>
              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  onClick={goPrevMonth}
                  disabled={isPrevDisabled}
                  className={styles.calendarNavBtn}
                >
                  ‹
                </button>
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
                  const isPast = iso < todayISO
                  const isSelected = iso === date
                  return (
                    <button
                      type="button"
                      key={i}
                      disabled={isPast}
                      onClick={() => setDate(iso)}
                      className={
                        isSelected ? styles.calendarDaySelected
                          : isPast ? styles.calendarDayDisabled
                            : styles.calendarDay
                      }
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {loadingSlots && <p className={styles.loadingText}>{t('book_appointment.loading_slots')}</p>}

          {!loadingSlots && professionalId && date && slots.length === 0 && (
            <p className={styles.loadingText}>{t('book_appointment.no_slots')}</p>
          )}

          {slots.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('book_appointment.slot_label')}</label>
              <div className={styles.slotsWrap}>
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      type="button"
                      key={slot.start}
                      onClick={() => setSelectedSlot(slot)}
                      className={isSelected ? styles.slotButtonSelected : styles.slotButton}
                    >
                      {formatSlotTime(slot.start, isEnglish ? 'en' : 'fr')}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('book_appointment.reason_label')}</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={styles.input} />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            className={!selectedSlot || submitting ? styles.submitButtonDisabled : styles.submitButton}
          >
            {submitting ? t('book_appointment.submitting') : t('book_appointment.submit')}
          </button>
        </form>

        <section className={styles.myAppointmentsSection}>
          <h2 className={styles.myAppointmentsTitle}>{t('book_appointment.my_appointments_title')}</h2>

          {loadingAppointments && <p className={styles.loadingText}>{t('book_appointment.loading')}</p>}
          {!loadingAppointments && myAppointments.length === 0 && (
            <p className={styles.loadingText}>{t('book_appointment.no_appointments')}</p>
          )}
          {cancelError && <p className={styles.errorText}>{cancelError}</p>}

          {myAppointments.map((appt) => {
            const isCancellable = CANCELLABLE_STATUSES.includes(appt.status)
            return (
              <div key={appt.id} className={styles.appointmentCard}>
                <div className={styles.appointmentInfo}>
                  <p className={styles.appointmentDate}>{formatAppointmentDateTime(appt.start_datetime, isEnglish ? 'en' : 'fr')}</p>
                  <p className={styles.appointmentMeta}>
                    {appt.professional_username} — {t(`roles.${appt.professional_role}`, appt.professional_role)}
                    {' — '}{appt.medical_house_name}
                  </p>
                  {appt.reason && (
                    <p className={styles.appointmentMeta}>{t('book_appointment.reason_prefix', { reason: appt.reason })}</p>
                  )}
                </div>
                <div className={styles.appointmentActions}>
                  <span className={styles[`statusBadge${appt.status}`] || styles.statusBadge}>
                    {t(`status.${appt.status}`, appt.status)}
                  </span>
                  {isCancellable && cancellingId !== appt.id && (
                    <button
                      type="button"
                      onClick={() => setCancellingId(appt.id)}
                      className={styles.cancelButton}
                    >
                      {t('book_appointment.cancel_button')}
                    </button>
                  )}
                  {isCancellable && cancellingId === appt.id && (
                    <div className={styles.cancelConfirmRow}>
                      <span className={styles.cancelConfirmText}>{t('book_appointment.confirm_cancel_question')}</span>
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(appt.id)}
                        disabled={cancelSubmittingId === appt.id}
                        className={styles.cancelConfirmBtn}
                      >
                        {cancelSubmittingId === appt.id ? '...' : t('book_appointment.yes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancellingId(null)}
                        className={styles.cancelAbortBtn}
                      >
                        {t('book_appointment.no')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}