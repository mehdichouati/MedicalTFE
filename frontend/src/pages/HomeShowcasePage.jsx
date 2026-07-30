import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import apiClient from '../api/client'
import styles from './HomeShowcasePage.module.css'

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
    <span className={styles.stars}>
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
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>{house?.name || 'Maison Médicale'}</h1>
          <p className={styles.heroSubtitle}>
            Des soins de proximité, une prise en charge humaine et coordonnée.
          </p>
          <div className={styles.heroActions}>
            <Link to="/login">
              <button className={styles.btnPrimary}>Se connecter</button>
            </Link>
            <Link to="/register">
              <button className={styles.btnSecondary}>Créer un compte</button>
            </Link>
          </div>
        </div>
        <div className={styles.heroImageWrap}>
          <img src="/images/facade.jpg" alt="Façade de la maison médicale" className={styles.heroImage} />
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <h2 className={styles.sectionTitle}>Pourquoi choisir {house?.name || 'notre maison médicale'} ?</h2>
        <div className={styles.highlightGrid}>
          {HIGHLIGHTS.map((h, i) => (
            <div key={i} className={styles.highlightCard}>
              <div className={styles.highlightIcon}>{h.icon}</div>
              <h3 className={styles.highlightTitle}>{h.title}</h3>
              <p className={styles.highlightText}>{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.waitingRoomSection}>
        <img src="/images/waiting_room.jpg" alt="Salle d'attente" className={styles.waitingRoomImage} />
        <div className={styles.waitingRoomText}>
          <h2 className={styles.waitingRoomTitle}>Un accueil pensé pour vous</h2>
          <p className={styles.waitingRoomBody}>
            Un espace calme et accessible, où chaque patient est pris en charge avec attention,
            de la prise de rendez-vous jusqu'au suivi post-consultation.
          </p>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <h2 className={styles.sectionTitleSm}>Notre équipe</h2>
        <img src="/images/team1.jpg" alt="Notre équipe" className={styles.teamImage} />
        <div className={styles.teamGrid}>
          {house?.staff?.map((member) => (
            <div key={member.id} className={styles.teamCard}>
              <div className={styles.teamAvatar}>{ROLE_ICONS[member.role] || '👤'}</div>
              <p className={styles.teamName}>{member.full_name}</p>
              <p className={styles.teamRole}>{ROLE_LABELS[member.role] || member.role}</p>
            </div>
          ))}
          {(!house?.staff || house.staff.length === 0) && (
            <p className={styles.emptyText}>Équipe à venir.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.reviewsHeading}>
          Avis de nos patients {house?.average_rating && <span className={styles.reviewsMeta}>({house.average_rating}/5 sur {house.review_count} avis)</span>}
        </h2>
        <div className={styles.reviewsGrid}>
          {house?.reviews?.map((review) => (
            <div key={review.id} className={styles.reviewCard}>
              <Stars rating={review.rating} />
              {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
              <p className={styles.reviewAuthor}>{review.author}</p>
            </div>
          ))}
          {(!house?.reviews || house.reviews.length === 0) && (
            <p className={styles.emptyText}>Aucun avis pour le moment.</p>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <h3 className={styles.footerTitle}>{house?.name}</h3>
        <p className={styles.footerText}>
          {house?.address}, {house?.postal_code} {house?.city}
        </p>
        {house?.phone_number && <p className={styles.footerTextSm}>{house.phone_number}</p>}
      </footer>
    </div>
  )
}