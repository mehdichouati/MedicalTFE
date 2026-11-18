import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './Footer.module.css'

export default function Footer() {
  const { t } = useTranslation()
  const [house, setHouse] = useState(null)

  // Recupere les coordonnees publiques de la maison medicale.
  useEffect(() => {
    apiClient.get('/public/medical-house/')
      .then(({ data }) => setHouse(data))
      .catch(() => setHouse(null))
  }, [])

  const houseName = house?.name || t('showcase.default_house_name')
  const currentYear = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <p className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">✚</span> {houseName}
            </p>
            <p className={styles.text}>{t('footer.tagline')}</p>
          </div>

          <div className={styles.column}>
            <h2 className={styles.title}>{t('footer.contact_title')}</h2>
            {house && (
              <address className={styles.address}>
                {house.address}<br />
                {house.postal_code} {house.city}
              </address>
            )}
            {house?.phone_number && (
              <a href={`tel:${house.phone_number.replace(/\s/g, '')}`} className={styles.link}>
                {house.phone_number}
              </a>
            )}
            {house?.email && (
              <a href={`mailto:${house.email}`} className={styles.link}>
                {house.email}
              </a>
            )}
          </div>

          <div className={styles.column}>
            <h2 className={styles.title}>{t('footer.emergency_title')}</h2>
            <a href="tel:1733" className={styles.link}>{t('footer.on_call')}</a>
            <a href="tel:112" className={styles.link}>{t('footer.emergency')}</a>
            <p className={styles.text}>{t('footer.hours_weekdays')}</p>
            <p className={styles.text}>{t('footer.hours_saturday')}</p>
          </div>

          <div className={styles.column}>
            <h2 className={styles.title}>{t('footer.legal_title')}</h2>
            {house?.company_number && (
              <p className={styles.text}>
                {t('footer.company_number', { number: house.company_number })}
              </p>
            )}
            <Link to="/legal" className={styles.link}>{t('footer.legal_notice')}</Link>
            <Link to="/privacy" className={styles.link}>{t('footer.privacy')}</Link>
          </div>
        </div>

        <p className={styles.bottom}>
          {t('footer.rights', { year: currentYear, name: houseName })}
        </p>
      </div>
    </footer>
  )
}