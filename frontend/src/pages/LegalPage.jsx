import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './LegalPage.module.css'

// Une seule page pour les deux documents legaux :
// kind="legal"   -> Mentions legales (/legal)
// kind="privacy" -> Politique de confidentialite RGPD (/privacy)
export default function LegalPage({ kind }) {
  const { t } = useTranslation()
  const [house, setHouse] = useState(null)

  // Coordonnees de la maison medicale (memes donnees que le footer).
  useEffect(() => {
    apiClient.get('/public/medical-house/')
      .then(({ data }) => setHouse(data))
      .catch(() => setHouse(null))
  }, [])

  const sections = t(`${kind}.sections`, { returnObjects: true })
  const houseName = house?.name || t('showcase.default_house_name')

  return (
    <article className={styles.page}>
      <h1 className={styles.title}>{t(`${kind}.title`)}</h1>
      <p className={styles.updated}>{t('legal_common.updated')}</p>
      <p className={styles.intro}>{t(`${kind}.intro`)}</p>

      {/* Identite de l'editeur / du responsable du traitement */}
      <section className={styles.identity}>
        <h2 className={styles.identityTitle}>{t(`${kind}.identity_title`)}</h2>
        <p className={styles.identityName}>{houseName}</p>
        {house && (
          <address className={styles.identityText}>
            {house.address}<br />
            {house.postal_code} {house.city}
          </address>
        )}
        <dl className={styles.identityList}>
          {house?.company_number && (
            <div>
              <dt>{t('legal_common.company_number')}</dt>
              <dd>{house.company_number}</dd>
            </div>
          )}
          {house?.phone_number && (
            <div>
              <dt>{t('legal_common.phone')}</dt>
              <dd><a href={`tel:${house.phone_number.replace(/\s/g, '')}`}>{house.phone_number}</a></dd>
            </div>
          )}
          {house?.email && (
            <div>
              <dt>{t('legal_common.email')}</dt>
              <dd><a href={`mailto:${house.email}`}>{house.email}</a></dd>
            </div>
          )}
        </dl>
      </section>

      {Array.isArray(sections) && sections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          {section.text && <p className={styles.text}>{section.text}</p>}
          {Array.isArray(section.items) && (
            <ul className={styles.list}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* Lien vers l'autre document legal */}
      <p className={styles.otherLink}>
        {kind === 'legal' ? (
          <Link to="/privacy">{t('footer.privacy')} →</Link>
        ) : (
          <Link to="/legal">{t('footer.legal_notice')} →</Link>
        )}
      </p>
    </article>
  )
}