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

function formatSlotTime(isoString) {
  return new Date(isoString).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

export default function BookAppointmentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

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

  useEffect(() => {
    apiClient.get('/public/medical-house/').then(({ data }) => setHouse(data)).catch(() => {})
    apiClient.get('/auth/dependents/')
      .then(({ data }) => setDependents(Array.isArray(data) ? data : data.results))
      .catch(() => {})
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
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Erreur lors de la réservation.')
    } finally {
      setSubmitting(false)
    }
  }

  const professionals = house?.staff?.filter((s) => Object.keys(ROLE_LABELS).includes(s.role)) || []

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
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={styles.input} />
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
      </div>
    </div>
  )
}