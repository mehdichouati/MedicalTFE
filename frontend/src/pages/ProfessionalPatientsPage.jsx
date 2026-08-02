import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './ProfessionalPatientsPage.module.css'

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function ProfessionalPatientsPage() {
  const { t } = useTranslation()
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('last_name')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const debouncedSearch = useDebouncedValue(search, 400)

  const loadPatients = useCallback(() => {
    setLoading(true)
    const params = { ordering }
    if (debouncedSearch) params.search = debouncedSearch

    apiClient.get('/my-patients/', { params })
      .then(({ data }) => setPatients(Array.isArray(data) ? data : data.results))
      .catch(() => setError(t('professional_patients.load_error')))
      .finally(() => setLoading(false))
  }, [debouncedSearch, ordering, t])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{t('professional_patients.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>

        <div className={styles.filtersRow}>
          <input
            placeholder={t('professional_patients.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={styles.selectInput}>
            <option value="last_name">{t('professional_patients.sort_name_asc')}</option>
            <option value="-last_name">{t('professional_patients.sort_name_desc')}</option>
            <option value="username">{t('professional_patients.sort_username_asc')}</option>
          </select>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        {loading ? (
          <p className={styles.loadingText}>{t('common.loading')}</p>
        ) : (
          <>
            {patients.length === 0 && <p className={styles.loadingText}>{t('professional_patients.no_patients')}</p>}
            {patients.map((patient) => (
              <Link key={patient.id} to={`/patient/${patient.id}`} className={styles.patientCard}>
                <p className={styles.patientName}>{patient.username}</p>
                <p className={styles.patientMeta}>
                  {patient.email}
                  {patient.age != null && ` — ${t('dependents.age_years', { age: patient.age })}`}
                </p>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  )
}