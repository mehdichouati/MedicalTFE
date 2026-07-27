import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import apiClient from '../api/client'

const HIGHLIGHTS = [
  {
    icon: '🩺',
    title: 'Une équipe pluridisciplinaire',
    text: 'Médecins généralistes, kinésithérapeutes et psychologues réunis pour un suivi complet.',
  },
  {
    icon: '📅',
    title: 'Prise de rendez-vous simplifiée',
    text: 'Réservez en ligne en quelques clics, recevez vos rappels automatiquement.',
  },
  {
    icon: '🔒',
    title: 'Paiement et données sécurisés',
    text: 'Vos paiements et vos données de santé sont protégés selon les normes RGPD.',
  },
  {
    icon: '🤝',
    title: 'Une approche humaine',
    text: 'Un accompagnement personnalisé, à l\'écoute de chaque patient.',
  },
]

const ROLE_LABELS = {
  MEDECIN: 'Médecin généraliste',
  KINE: 'Kinésithérapeute',
  PSYCHOLOGUE: 'Psychologue',
}

const ROLE_ICONS = {
  MEDECIN: '🩺',
  KINE: '💪',
  PSYCHOLOGUE: '🧠',
}

function Stars({ rating }) {
  return (
    <span style={{ color: '#f0a94e' }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

export default function HomeShowcasePage() {
  const [house, setHouse] = useState(null)

  useEffect(() => {
    apiClient.get('/public/medical-house/')
      .then(({ data }) => setHouse(data))
      .catch(() => {})
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      {/* Hero */}
      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', padding: '48px 6vw', gap: 40 }}>
        <div style={{ flex: '1 1 380px' }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, color: '#0a5c78', lineHeight: 1.1, margin: 0 }}>
            {house?.name || 'Maison Médicale'}
          </h1>
          <p style={{ fontSize: 18, color: '#52606d', marginTop: 16 }}>
            Des soins de proximité, une prise en charge humaine et coordonnée.
          </p>
          <div style={{ marginTop: 28, display: 'flex', gap: 14 }}>
            <Link to="/login">
              <button style={{ padding: '12px 28px', background: '#0a5c78', color: '#fff', border: 'none', borderRadius: 24, fontSize: 15, cursor: 'pointer' }}>
                Se connecter
              </button>
            </Link>
            <Link to="/register">
              <button style={{ padding: '12px 28px', background: '#fff', color: '#0a5c78', border: '2px solid #0a5c78', borderRadius: 24, fontSize: 15, cursor: 'pointer' }}>
                Créer un compte
              </button>
            </Link>
          </div>
        </div>
        <div style={{ flex: '1 1 380px' }}>
          <img
            src="/images/facade.jpg"
            alt="Façade de la maison médicale"
            style={{ width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: 380 }}
          />
        </div>
      </section>

      {/* Pourquoi nous choisir */}
      <section style={{ padding: '48px 6vw', background: '#f7f9fb' }}>
        <h2 style={{ fontSize: 28, color: '#0a5c78', marginBottom: 24 }}>Pourquoi choisir {house?.name || 'notre maison médicale'} ?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {HIGHLIGHTS.map((h, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 28 }}>{h.icon}</div>
              <h3 style={{ fontSize: 16, margin: '10px 0 6px' }}>{h.title}</h3>
              <p style={{ fontSize: 14, color: '#52606d', margin: 0 }}>{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Salle d'attente */}
      <section style={{ padding: '48px 6vw', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 40 }}>
        <img
          src="/images/waiting_room.jpg"
          alt="Salle d'attente"
          style={{ flex: '1 1 380px', width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: 320 }}
        />
        <div style={{ flex: '1 1 320px' }}>
          <h2 style={{ fontSize: 26, color: '#0a5c78' }}>Un accueil pensé pour vous</h2>
          <p style={{ fontSize: 15, color: '#52606d', lineHeight: 1.6 }}>
            Un espace calme et accessible, où chaque patient est pris en charge avec attention,
            de la prise de rendez-vous jusqu'au suivi post-consultation.
          </p>
        </div>
      </section>

      {/* Equipe */}
      <section style={{ padding: '48px 6vw', background: '#f7f9fb' }}>
        <h2 style={{ fontSize: 26, color: '#0a5c78', marginBottom: 24 }}>Notre équipe</h2>
        <img
          src="/images/team1.jpg"
          alt="Notre équipe"
          style={{ width: '100%', objectFit: 'contain', borderRadius: 16, marginBottom: 28, background: '#fff' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {house?.staff?.map((member) => (
            <div
              key={member.id}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: 24,
                textAlign: 'center',
                boxShadow: '0 2px 10px rgba(10,92,120,0.08)',
                border: '1px solid #e4e7eb',
              }}
            >
              <div
                style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#eef5f8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 30, margin: '0 auto 14px',
                }}
              >
                {ROLE_ICONS[member.role] || '👤'}
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{member.full_name}</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#0a5c78', fontWeight: 600, letterSpacing: 0.3 }}>
                {ROLE_LABELS[member.role] || member.role}
              </p>
            </div>
          ))}
          {(!house?.staff || house.staff.length === 0) && (
            <p style={{ color: '#52606d' }}>Équipe à venir.</p>
          )}
        </div>
      </section>

      {/* Avis */}
      <section style={{ padding: '48px 6vw' }}>
        <h2 style={{ fontSize: 26, color: '#0a5c78' }}>
          Avis de nos patients {house?.average_rating && <span style={{ fontSize: 16, color: '#52606d' }}>({house.average_rating}/5 sur {house.review_count} avis)</span>}
        </h2>
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {house?.reviews?.map((review) => (
            <div key={review.id} style={{ background: '#fff', border: '1px solid #e4e7eb', borderRadius: 12, padding: 16 }}>
              <Stars rating={review.rating} />
              {review.comment && <p style={{ marginTop: 8, fontSize: 14, color: '#333' }}>{review.comment}</p>}
              <p style={{ marginTop: 8, fontSize: 12, color: '#9aa3b2' }}>{review.author}</p>
            </div>
          ))}
          {(!house?.reviews || house.reviews.length === 0) && (
            <p style={{ color: '#52606d' }}>Aucun avis pour le moment.</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a5c78', padding: '32px 6vw' }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>{house?.name}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#e4f0f5' }}>
          {house?.address}, {house?.postal_code} {house?.city}
        </p>
        {house?.phone_number && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#e4f0f5' }}>{house.phone_number}</p>}
      </footer>
    </div>
  )
}