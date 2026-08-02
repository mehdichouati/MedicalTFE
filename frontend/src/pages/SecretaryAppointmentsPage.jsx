import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './SecretaryAppointmentsPage.module.css'

const WEEKDAY_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const WEEKDAY_LABELS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED']

function formatSlotTime(isoString, locale) {
  return new Date(isoString).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

export default function SecretaryAppointmentsPage() {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language?.startsWith('en')
  const now = new Date()
  const todayISO = toLocalISODate(now)

  const [house, setHouse] = useState(null)
  const [professionalId, setProfessionalId] = useState('')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [calendarMonth, setCalendarMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selectedDate, setSelectedDate] = useState(todayISO)

  const [cancellingId, setCancellingId] = useState(null)
  const [cancelSubmittingId, setCancelSubmittingId] = useState(null)
  const [cancelError, setCancelError] = useState('')

  const [patientUsername, setPatientUsername] = useState('')
  const [lookedUpPatient, setLookedUpPatient] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [reason, setReason] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadAppointments = () => {
    setLoading(true)
    apiClient.get('/appointments/')
      .then(({ data }) => setAppointments(Array.isArray(data) ? data : data.results))
      .catch(() => setError(t('secretary.load_error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    apiClient.get('/public/medical-house/').then(({ data }) => setHouse(data)).catch(() => {})
    loadAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const professionals = house?.staff?.filter((s) => ['MEDECIN', 'KINE', 'PSYCHOLOGUE'].includes(s.role)) || []

  useEffect(() => {
    if (!professionalId && professionals.length > 0) {
      setProfessionalId(String(professionals[0].id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionals.length])

  useEffect(() => {
    setSlots([])
    setSelectedSlot(null)
    if (!professionalId || !selectedDate || !house) return
    setLoadingSlots(true)
    apiClient.get('/appointments/available-slots/', {
      params: { professional: professionalId, medical_house: house.id, date: selectedDate },
    })
      .then(({ data }) => setSlots(data.slots))
      .catch(() => {})
      .finally(() => setLoadingSlots(false))
  }, [professionalId, selectedDate, house])

  const handleLookupPatient = async () => {
    if (!patientUsername.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setLookedUpPatient(null)
    try {
      const { data } = await apiClient.get('/patients/lookup/', { params: { username: patientUsername.trim() } })
      setLookedUpPatient(data)
    } catch (err) {
      setLookupError(err.response?.data?.detail || t('secretary.lookup_error'))
    } finally {
      setLookupLoading(false)
    }
  }

  const handleCreateAppointment = async (e) => {
    e.preventDefault()
    if (!lookedUpPatient || !selectedSlot || !house) return
    setCreating(true)
    setCreateError('')
    try {
      await apiClient.post('/appointments/', {
        professional: professionalId,
        medical_house: house.id,
        patient: lookedUpPatient.id,
        start_datetime: selectedSlot.start,
        end_datetime: selectedSlot.end,
        reason,
      })
      setPatientUsername('')
      setLookedUpPatient(null)
      setSelectedSlot(null)
      setReason('')
      loadAppointments()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setCreateError(Array.isArray(firstError) ? firstError[0] : firstError || t('secretary.create_error'))
    } finally {
      setCreating(false)
    }
  }

  const handleCancelAppointment = async (id) => {
    setCancelSubmittingId(id)
    setCancelError('')
    try {
      await apiClient.delete(`/appointments/${id}/`)
      setCancellingId(null)
      loadAppointments()
    } catch (err) {
      setCancelError(err.response?.data?.detail || t('secretary.cancel_error'))
    } finally {
      setCancelSubmittingId(null)
    }
  }

  const goPrevMonth = () => {
    setCalendarMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  const goNextMonth = () => {
    setCalendarMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }
  const goToday = () => {
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDate(todayISO)
  }

  const dayAppointments = appointments
    .filter((appt) => String(appt.professional) === String(professionalId) && toLocalISODate(new Date(appt.start_datetime)) === selectedDate)
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
        <h1 className={styles.title}>{t('secretary.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('secretary.professional_label')}</label>
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={styles.input}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} — {t(`roles.${p.role}`, p.role)}</option>
            ))}
          </select>
        </div>

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
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedDate(iso)}
                  className={isSelected ? styles.calendarDaySelected : styles.calendarDay}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <button type="button" onClick={goToday} className={styles.todayButton}>{t('secretary.today_button')}</button>
        </div>

        <h2 className={styles.selectedDateTitle}>{selectedDateLabel}</h2>

        {loading ? (
          <p className={styles.loadingText}>{t('common.loading')}</p>
        ) : (
          <>
            {dayAppointments.length === 0 && <p className={styles.loadingText}>{t('secretary.no_appointments_today')}</p>}
            {cancelError && <p className={styles.errorText}>{cancelError}</p>}
            {dayAppointments.map((appt) => {
              const isCancellable = CANCELLABLE_STATUSES.includes(appt.status)
              return (
                <div key={appt.id} className={styles.card}>
                  <div className={styles.cardInfo}>
                    <p className={styles.cardDate}>{formatSlotTime(appt.start_datetime, i18n.language)} — {appt.patient_username}</p>
                    <p className={styles.cardMeta}>
                      {t(`status.${appt.status}`, appt.status)}
                      {appt.reason && ` — ${appt.reason}`}
                    </p>
                  </div>
                  {isCancellable && cancellingId !== appt.id && (
                    <button onClick={() => setCancellingId(appt.id)} className={styles.cancelButton}>
                      {t('secretary.cancel_button')}
                    </button>
                  )}
                  {isCancellable && cancellingId === appt.id && (
                    <div className={styles.confirmRow}>
                      <span>{t('secretary.confirm_cancel_question')}</span>
                      <button
                        onClick={() => handleCancelAppointment(appt.id)}
                        disabled={cancelSubmittingId === appt.id}
                        className={styles.confirmBtn}
                      >
                        {cancelSubmittingId === appt.id ? '...' : t('common.yes')}
                      </button>
                      <button onClick={() => setCancellingId(null)} className={styles.abortBtn}>
                        {t('common.no')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        <section className={styles.newAppointmentSection}>
          <h2 className={styles.selectedDateTitle}>{t('secretary.new_appointment_title')}</h2>

          <div className={styles.lookupRow}>
            <input
              type="text"
              placeholder={t('secretary.patient_username_placeholder')}
              value={patientUsername}
              onChange={(e) => { setPatientUsername(e.target.value); setLookedUpPatient(null) }}
              className={styles.input}
            />
            <button type="button" onClick={handleLookupPatient} disabled={lookupLoading} className={styles.lookupButton}>
              {lookupLoading ? '...' : t('secretary.lookup_button')}
            </button>
          </div>
          {lookupError && <p className={styles.errorText}>{lookupError}</p>}
          {lookedUpPatient && (
            <p className={styles.foundPatientText}>
              {t('secretary.patient_found', { name: lookedUpPatient.full_name })}
            </p>
          )}

          {lookedUpPatient && (
            <form onSubmit={handleCreateAppointment} className={styles.form}>
              {loadingSlots && <p className={styles.loadingText}>{t('secretary.loading_slots')}</p>}
              {!loadingSlots && slots.length === 0 && (
                <p className={styles.loadingText}>{t('secretary.no_slots')}</p>
              )}
              {slots.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t('secretary.slot_label')}</label>
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
                <label className={styles.fieldLabel}>{t('secretary.reason_label')}</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={styles.input} />
              </div>
              {createError && <p className={styles.errorText}>{createError}</p>}
              <button type="submit" disabled={!selectedSlot || creating} className={styles.submitButton}>
                {creating ? t('secretary.creating') : t('secretary.create_button')}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}