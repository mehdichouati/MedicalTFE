import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  MEDECIN: 'Médecin généraliste',
  KINE: 'Kinésithérapeute',
  PSYCHOLOGUE: 'Psychologue',
}

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #dbe2e8',
  fontSize: 15,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const LABEL_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: '#0a5c78',
  display: 'block',
  marginBottom: 6,
}

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  boxShadow: '0 2px 10px rgba(10,92,120,0.08)',
  border: '1px solid #eef1f4',
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
      <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ ...CARD_STYLE, padding: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h1 style={{ color: '#0a5c78', fontSize: 26, margin: 0 }}>Rendez-vous confirmé</h1>
            <p style={{ color: '#52606d', marginTop: 10 }}>Votre rendez-vous a bien été enregistré.</p>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => navigate(`/pay/${success.id}`)}
                style={{ padding: '10px 22px', background: '#0a5c78', color: '#fff', border: 'none', borderRadius: 24, fontSize: 14, cursor: 'pointer' }}
              >
                Payer maintenant
              </button>
              <Link to="/history">
                <button style={{ padding: '10px 22px', background: '#fff', color: '#0a5c78', border: '2px solid #0a5c78', borderRadius: 24, fontSize: 14, cursor: 'pointer' }}>
                  Voir mon historique
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ color: '#0a5c78', fontSize: 30, marginBottom: 4 }}>Prendre rendez-vous</h1>
        <p style={{ marginBottom: 24 }}>
          <Link to="/app" style={{ color: '#0a5c78', fontSize: 14 }}>← Retour à l'accueil</Link>
        </p>

        <form onSubmit={handleSubmit} style={CARD_STYLE}>
          {dependents.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={LABEL_STYLE}>Pour qui ?</label>
              <select value={bookingFor} onChange={(e) => setBookingFor(e.target.value)} style={INPUT_STYLE}>
                <option value="self">Moi-même ({user?.username})</option>
                {dependents.map((dep) => (
                  <option key={dep.id} value={dep.id}>{dep.username} ({dep.age} ans)</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={LABEL_STYLE}>Professionnel</label>
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required style={INPUT_STYLE}>
              <option value="">Sélectionner un professionnel</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} — {ROLE_LABELS[p.role]}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={LABEL_STYLE}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={INPUT_STYLE} />
          </div>

          {loadingSlots && <p style={{ fontSize: 14, color: '#52606d' }}>Chargement des créneaux...</p>}

          {!loadingSlots && professionalId && date && slots.length === 0 && (
            <p style={{ fontSize: 14, color: '#52606d' }}>Aucun créneau disponible à cette date.</p>
          )}

          {slots.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={LABEL_STYLE}>Créneau</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      type="button"
                      key={slot.start}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 20,
                        border: isSelected ? '2px solid #0a5c78' : '1px solid #dbe2e8',
                        background: isSelected ? '#eef5f8' : '#fff',
                        color: isSelected ? '#0a5c78' : '#1a1a2e',
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL_STYLE}>Motif (facultatif)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={INPUT_STYLE} />
          </div>

          {error && <p style={{ color: '#b3261e', fontSize: 14, marginBottom: 12 }}>{error}</p>}

          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            style={{
              width: '100%',
              padding: '12px 0',
              background: !selectedSlot || submitting ? '#a9c3cd' : '#0a5c78',
              color: '#fff',
              border: 'none',
              borderRadius: 24,
              fontSize: 15,
              cursor: !selectedSlot || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Réservation...' : 'Confirmer le rendez-vous'}
          </button>
        </form>
      </div>
    </div>
  )
}
