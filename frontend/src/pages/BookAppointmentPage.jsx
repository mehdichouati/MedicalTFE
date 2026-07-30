import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './BookAppointmentPage.module.css'

const ROLE_LABELS = {
  MEDECIN: 'Médecin généraliste',
  KINE: 'Kinésithérapeute',
  PSYCHOLOGUE: 'Psychologue',
}

const STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
  COMPLETED: 'Terminé',
  NO_SHOW: 'Absence',
}

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED']

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function formatSlotTime(isoString) {
  return new Date(isoString).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function formatAppointmentDateTime(isoString) {
  return new Date(isoString).toLocaleString('fr-BE', {
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
  const { user } = useAuth()
  const navigate = useNavigate()

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
      .catch(() => setError("Impossible de charger les créneaux."))
      .finally(() => setLoadingSlots(false))
  }, [professionalId, date, house])

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
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Erreur lors de la réservation.')
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
      setCancelError(err.response?.data?.detail || "Erreur lors de l'annulation.")
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

  const professionals = house?.staff?.filter((s) => Object.keys(ROLE_LABELS).includes(s.role)) || []
  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1)
    .toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
  const weeks = buildMonthGrid(calendarMonth.year, calendarMonth.month)

  if (success) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✅</div>
            <h1 className={styles.successTitle}>Rendez-vous confirmé</h1>
            <p className={styles.successText}>Votre rendez-vous a bien été enregistré.</p>
            <div className={styles.successActions}>
              <button onClick={() => navigate(`/pay/${success.id}`)} className={styles.btnPrimary}>
                Payer maintenant
              </button>
              <Link to="/history">
                <button className={styles.btnSecondary}>Voir mon historique</button>
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
        <h1 className={styles.title}>Prendre rendez-vous</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← Retour à l'accueil</Link>
        </p>

        <form onSubmit={handleSubmit} className={styles.formCard}>
          {dependents.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Pour qui ?</label>
              <select value={bookingFor} onChange={(e) => setBookingFor(e.target.value)} className={styles.input}>
                <option value="self">Moi-même ({user?.username})</option>
                {dependents.map((dep) => (
                  <option key={dep.id} value={dep.id}>{dep.username} ({dep.age} ans)</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Professionnel</label>
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required className={styles.input}>
              <option value="">Sélectionner un professionnel</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} — {ROLE_LABELS[p.role]}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Date</label>
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
                {WEEKDAY_LABELS.map((wd, i) => (
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

          {loadingSlots && <p className={styles.loadingText}>Chargement des créneaux...</p>}

          {!loadingSlots && professionalId && date && slots.length === 0 && (
            <p className={styles.loadingText}>Aucun créneau disponible à cette date.</p>
          )}

          {slots.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Créneau</label>
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
                      {formatSlotTime(slot.start)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Motif (facultatif)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={styles.input} />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            className={!selectedSlot || submitting ? styles.submitButtonDisabled : styles.submitButton}
          >
            {submitting ? 'Réservation...' : 'Confirmer le rendez-vous'}
          </button>
        </form>

        <section className={styles.myAppointmentsSection}>
          <h2 className={styles.myAppointmentsTitle}>Mes rendez-vous</h2>

          {loadingAppointments && <p className={styles.loadingText}>Chargement...</p>}
          {!loadingAppointments && myAppointments.length === 0 && (
            <p className={styles.loadingText}>Vous n'avez aucun rendez-vous pour le moment.</p>
          )}
          {cancelError && <p className={styles.errorText}>{cancelError}</p>}

          {myAppointments.map((appt) => {
            const isCancellable = CANCELLABLE_STATUSES.includes(appt.status)
            return (
              <div key={appt.id} className={styles.appointmentCard}>
                <div className={styles.appointmentInfo}>
                  <p className={styles.appointmentDate}>{formatAppointmentDateTime(appt.start_datetime)}</p>
                  <p className={styles.appointmentMeta}>
                    {appt.professional_username} — {ROLE_LABELS[appt.professional_role] || appt.professional_role}
                    {' — '}{appt.medical_house_name}
                  </p>
                  {appt.reason && <p className={styles.appointmentMeta}>Motif : {appt.reason}</p>}
                </div>
                <div className={styles.appointmentActions}>
                  <span className={styles[`statusBadge${appt.status}`] || styles.statusBadge}>
                    {STATUS_LABELS[appt.status] || appt.status}
                  </span>
                  {isCancellable && cancellingId !== appt.id && (
                    <button
                      type="button"
                      onClick={() => setCancellingId(appt.id)}
                      className={styles.cancelButton}
                    >
                      Annuler
                    </button>
                  )}
                  {isCancellable && cancellingId === appt.id && (
                    <div className={styles.cancelConfirmRow}>
                      <span className={styles.cancelConfirmText}>Confirmer ?</span>
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(appt.id)}
                        disabled={cancelSubmittingId === appt.id}
                        className={styles.cancelConfirmBtn}
                      >
                        {cancelSubmittingId === appt.id ? '...' : 'Oui'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancellingId(null)}
                        className={styles.cancelAbortBtn}
                      >
                        Non
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