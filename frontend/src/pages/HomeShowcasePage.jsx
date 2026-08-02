import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './HomeShowcasePage.module.css'

const HIGHLIGHTS = [
  { icon: '🩺', titleKey: 'showcase.highlight_1_title', textKey: 'showcase.highlight_1_text' },
  { icon: '📅', titleKey: 'showcase.highlight_2_title', textKey: 'showcase.highlight_2_text' },
  { icon: '🔒', titleKey: 'showcase.highlight_3_title', textKey: 'showcase.highlight_3_text' },
  { icon: '🤝', titleKey: 'showcase.highlight_4_title', textKey: 'showcase.highlight_4_text' },
]

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
  const { t } = useTranslation()
  const [house, setHouse] = useState(null)
  const reviewsScrollRef = useRef(null)

  const scrollReviews = (direction) => {
    if (!reviewsScrollRef.current) return
    const amount = 300
    reviewsScrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  useEffect(() => {
    apiClient.get('/public/medical-house/')
      .then(({ data }) => setHouse(data))
      .catch(() => {})
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <LanguageSwitcher />
      </div>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>{house?.name || t('showcase.default_house_name')}</h1>
          <p className={styles.heroSubtitle}>
            {t('showcase.hero_subtitle')}
          </p>
          <div className={styles.heroActions}>
            <Link to="/login">
              <button className={styles.btnPrimary}>{t('showcase.login_button')}</button>
            </Link>
            <Link to="/register">
              <button className={styles.btnSecondary}>{t('showcase.register_button')}</button>
            </Link>
          </div>
        </div>
        <div className={styles.heroImageWrap}>
          <img src="/images/facade.jpg" alt={t('showcase.facade_alt')} className={styles.heroImage} />
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <h2 className={styles.sectionTitle}>
          {t('showcase.why_choose_title', { name: house?.name || t('showcase.default_house_name_lowercase') })}
        </h2>
        <div className={styles.highlightGrid}>
          {HIGHLIGHTS.map((h, i) => (
            <div key={i} className={styles.highlightCard}>
              <div className={styles.highlightIcon}>{h.icon}</div>
              <h3 className={styles.highlightTitle}>{t(h.titleKey)}</h3>
              <p className={styles.highlightText}>{t(h.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.waitingRoomSection}>
        <img src="/images/waiting_room.jpg" alt={t('showcase.waiting_room_alt')} className={styles.waitingRoomImage} />
        <div className={styles.waitingRoomText}>
          <h2 className={styles.waitingRoomTitle}>{t('showcase.waiting_room_title')}</h2>
          <p className={styles.waitingRoomBody}>
            {t('showcase.waiting_room_body')}
          </p>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <h2 className={styles.sectionTitleSm}>{t('showcase.team_title')}</h2>
        <img src="/images/team1.jpg" alt={t('showcase.team_alt')} className={styles.teamImage} />
        <div className={styles.teamGrid}>
          {house?.staff?.map((member) => (
            <div key={member.id} className={styles.teamCard}>
              <div className={styles.teamAvatar}>{ROLE_ICONS[member.role] || '👤'}</div>
              <p className={styles.teamName}>{member.full_name}</p>
              <p className={styles.teamRole}>{t(`roles.${member.role}`, member.role)}</p>
            </div>
          ))}
          {(!house?.staff || house.staff.length === 0) && (
            <p className={styles.emptyText}>{t('showcase.team_empty')}</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.reviewsHeading}>
          {t('showcase.reviews_title')}{' '}
          {house?.average_rating && (
            <span className={styles.reviewsMeta}>
              {t('showcase.reviews_meta', { rating: house.average_rating, count: house.review_count })}
            </span>
          )}
        </h2>
        {house?.reviews && house.reviews.length > 0 ? (
          <div className={styles.reviewsCarouselWrap}>
            <button type="button" onClick={() => scrollReviews('left')} className={styles.carouselArrow} aria-label={t('showcase.reviews_prev')}>
              ‹
            </button>
            <div className={styles.reviewsCarousel} ref={reviewsScrollRef}>
              {house.reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <Stars rating={review.rating} />
                  {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
                  <p className={styles.reviewAuthor}>{review.author}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => scrollReviews('right')} className={styles.carouselArrow} aria-label={t('showcase.reviews_next')}>
              ›
            </button>
          </div>
        ) : (
          <p className={styles.emptyText}>{t('showcase.reviews_empty')}</p>
        )}
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