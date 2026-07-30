import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
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
      .catch(() => setError('Impossible de charger la liste des patients.'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, ordering])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Dossiers patients</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← Retour à l'accueil</Link>
        </p>

        <div className={styles.filtersRow}>
          <input
            placeholder="Rechercher un patient (nom, email...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={styles.selectInput}>
            <option value="last_name">Trier : Nom (A-Z)</option>
            <option value="-last_name">Trier : Nom (Z-A)</option>
            <option value="username">Trier : Utilisateur (A-Z)</option>
          </select>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        {loading ? (
          <p className={styles.loadingText}>Chargement...</p>
        ) : (
          <>
            {patients.length === 0 && <p className={styles.loadingText}>Aucun patient trouvé.</p>}
            {patients.map((patient) => (
              <Link key={patient.id} to={`/patient/${patient.id}`} className={styles.patientCard}>
                <p className={styles.patientName}>{patient.username}</p>
                <p className={styles.patientMeta}>
                  {patient.email}
                  {patient.age != null && ` — ${patient.age} ans`}
                </p>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  )
}