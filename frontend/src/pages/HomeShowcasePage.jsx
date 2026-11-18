import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'
import styles from './HomeShowcasePage.module.css'

// Categories de professionnels affichees sur la vitrine.
const CATEGORIES = [
  { role: 'MEDECIN', icon: '🩺' },
  { role: 'KINE', icon: '💪' },
  { role: 'PSYCHOLOGUE', icon: '🧠' },
]

// Actualites statiques (textes dans les fichiers de traduction).
const NEWS = ['news_1', 'news_2']

// F16 — Registres officiels permettant au patient de verifier lui-meme
// l'habilitation d'un professionnel.
const INAMI_SEARCH_URL = 'https://www.inami.fgov.be/fr/programmes-web/rechercher-un-dispensateur-de-soins'
const COMPSY_SEARCH_URL = 'https://www.compsy.be/en_GB/search'

// F16 — Affiche le numero INAMI au format officiel X-XXXXX-XX-XXX.
// Le numero de la Commission des Psychologues est affiche tel quel.
function formatLicenseNumber(member) {
  const number = member.license_number
  if (member.role !== 'PSYCHOLOGUE' && /^\d{11}$/.test(number)) {
    return `${number.slice(0, 1)}-${number.slice(1, 6)}-${number.slice(6, 8)}-${number.slice(8)}`
  }
  return number
}

function Stars({ rating }) {
  const rounded = Math.round(rating)
  return (
    <span className={styles.stars} aria-hidden="true">
      {'★'.repeat(rounded)}{'☆'.repeat(5 - rounded)}
    </span>
  )
}

export default function HomeShowcasePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const [house, setHouse] = useState(null)
  const [openCategory, setOpenCategory] = useState(null)

  useEffect(() => {
    apiClient.get('/public/medical-house/')
      .then(({ data }) => setHouse(data))
      .catch(() => setHouse(null))
  }, [])

  // Fait defiler jusqu'a la section demandee (ex. /#professionnels).
  useEffect(() => {
    if (!location.hash) return
    const section = document.getElementById(location.hash.slice(1))
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash, house])

  const staff = house?.staff || []
  const latestReview = house?.reviews?.find((review) => review.comment)
  const bookingLink = user?.role === 'PATIENT' ? '/book' : user ? '/app' : '/login'

  const toggleCategory = (role) => {
    setOpenCategory((current) => (current === role ? null : role))
  }

  const formatRating = (rating) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(rating)

  return (
    <div className={styles.page}>
      {/* ----- Bandeau d'informations rapides ----- */}
      <div className={styles.infoBar}>
        <div className={styles.infoBarInner}>
          {house?.phone_number && (
            <a href={`tel:${house.phone_number.replace(/\s/g, '')}`} className={styles.infoItem}>
              <span aria-hidden="true">📞</span> {house.phone_number}
            </a>
          )}
          <span className={`${styles.infoItem} ${styles.infoHours}`}>
            <span aria-hidden="true">🕐</span> {t('footer.hours_weekdays')} · {t('footer.hours_saturday')}
          </span>
          <span className={`${styles.infoItem} ${styles.infoEmergency}`}>
            <a href="tel:1733">{t('footer.on_call')}</a> · <a href="tel:112">{t('footer.emergency')}</a>
          </span>
        </div>
      </div>

      {/* ----- Bandeau principal (hero) ----- */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.heroHouse}>{house?.name || t('showcase.default_house_name')}</p>
          <h1 className={styles.heroTitle}>{t('showcase.hero_title')}</h1>
          <p className={styles.heroSubtitle}>{t('showcase.hero_subtitle')}</p>
          <div className={styles.heroActions}>
            <Link to={bookingLink} className={styles.btnPrimary}>
              <span aria-hidden="true">📅</span> {t('showcase.hero_book')}
            </Link>
            <a href="#professionnels" className={styles.btnSecondary}>
              {t('showcase.hero_team')}
            </a>
          </div>
        </div>
        <div className={styles.heroImageWrap}>
          <img src="/images/facade.jpg" alt={t('showcase.facade_alt')} className={styles.heroImage} />
        </div>
      </section>

      {/* ----- Nos professionnels ----- */}
      <section id="professionnels" className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('nav.professionals')}</h2>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const count = staff.filter((member) => member.role === category.role).length
            const isOpen = openCategory === category.role
            return (
              <button
                key={category.role}
                type="button"
                className={isOpen ? `${styles.categoryCard} ${styles.categoryCardOpen}` : styles.categoryCard}
                aria-expanded={isOpen}
                aria-controls="team-list"
                onClick={() => toggleCategory(category.role)}
              >
                <span className={styles.categoryIcon} aria-hidden="true">{category.icon}</span>
                <span className={styles.categoryTitle}>{t(`showcase.category_${category.role}`)}</span>
                <span className={styles.categoryCount}>{t('showcase.practitioners_count', { count })}</span>
                <span className={styles.categoryLink}>
                  {isOpen ? t('showcase.hide_team') : t('showcase.see_team')} {isOpen ? '↑' : '→'}
                </span>
              </button>
            )
          })}
        </div>

        {openCategory && (
          <div id="team-list" className={styles.teamGrid}>
            {staff.filter((member) => member.role === openCategory).map((member) => (
              <div key={member.id} className={styles.teamCard}>
                <p className={styles.teamName}>{member.full_name}</p>
                <p className={styles.teamRole}>{t(`roles.${member.role}`, member.role)}</p>
                {member.license_number && (
                  <p className={styles.teamLicense}>
                    {member.role === 'PSYCHOLOGUE' ? t('showcase.license_compsy') : t('showcase.license_inami')}
                    {' '}{formatLicenseNumber(member)}
                  </p>
                )}
              </div>
            ))}
            {staff.every((member) => member.role !== openCategory) && (
              <p className={styles.emptyText}>{t('showcase.team_empty')}</p>
            )}
          </div>
        )}
      </section>

      {/* ----- Infos pratiques ----- */}
      <section id="infos-pratiques" className={styles.practical}>
        <div className={styles.practicalInner}>
          <h2 className={styles.srOnly}>{t('nav.practical_info')}</h2>
          <div className={styles.practicalItem}>
            <h3 className={styles.practicalTitle}><span aria-hidden="true">🕐</span> {t('showcase.hours_title')}</h3>
            <p className={styles.practicalText}>
              {t('footer.hours_weekdays')}<br />
              {t('footer.hours_saturday')}
            </p>
          </div>
          <div className={styles.practicalItem}>
            <h3 className={styles.practicalTitle}><span aria-hidden="true">📍</span> {t('showcase.address_title')}</h3>
            {house && (
              <address className={styles.practicalText}>
                {house.address}<br />
                {house.postal_code} {house.city}
              </address>
            )}
          </div>
          <div className={styles.practicalItem}>
            <h3 className={styles.practicalTitle}><span aria-hidden="true">✅</span> {t('showcase.verify_title')}</h3>
            <p className={styles.practicalText}>{t('showcase.verify_text')}</p>
            <a href={INAMI_SEARCH_URL} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
              {t('showcase.verify_inami')}
            </a>
            <a href={COMPSY_SEARCH_URL} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
              {t('showcase.verify_compsy')}
            </a>
          </div>
        </div>
      </section>

      {/* ----- Actualites ----- */}
      <section id="actualites" className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('nav.news')}</h2>
        <div className={styles.newsGrid}>
          {NEWS.map((key) => (
            <article key={key} className={styles.newsCard}>
              <p className={styles.newsDate}>{t(`showcase.${key}_date`)}</p>
              <h3 className={styles.newsTitle}>{t(`showcase.${key}_title`)}</h3>
              <p className={styles.newsText}>{t(`showcase.${key}_text`)}</p>
            </article>
          ))}
          <article className={`${styles.newsCard} ${styles.newsCardWarning}`}>
            <p className={styles.newsDate}>{t('showcase.news_fee_label')}</p>
            <h3 className={styles.newsTitle}>{t('showcase.news_fee_title')}</h3>
            <p className={styles.newsText}>{t('showcase.news_fee_text')}</p>
          </article>
        </div>
      </section>

      {/* ----- Avis des patients ----- */}
      <section className={styles.sectionReviews}>
        <h2 className={styles.srOnly}>{t('showcase.reviews_title')}</h2>
        <div className={styles.reviewSummary}>
          {house?.average_rating ? (
            <>
              <p className={styles.reviewScore}>{formatRating(house.average_rating)}/5</p>
              <div>
                <Stars rating={house.average_rating} />
                <p className={styles.reviewMeta}>
                  {t('showcase.reviews_count', { count: house.review_count })}
                  {latestReview && <> · « {latestReview.comment} »</>}
                </p>
              </div>
            </>
          ) : (
            <p className={styles.emptyText}>{t('showcase.reviews_empty')}</p>
          )}
        </div>
      </section>
    </div>
  )
}
