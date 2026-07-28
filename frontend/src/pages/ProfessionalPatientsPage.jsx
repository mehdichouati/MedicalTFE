import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import apiClient from '../api/client'

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 2px 10px rgba(10,92,120,0.06)',
  border: '1px solid #eef1f4',
  marginBottom: 12,
}

const INPUT_STYLE = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #dbe2e8',
  fontSize: 14,
}

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
    <div style={{ background: '#f7f9fb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ color: '#0a5c78', fontSize: 30, marginBottom: 4 }}>Dossiers patients</h1>
        <p style={{ marginBottom: 24 }}>
          <Link to="/app" style={{ color: '#0a5c78', fontSize: 14 }}>← Retour à l'accueil</Link>
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            placeholder="Rechercher un patient (nom, email...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT_STYLE, flex: 1, minWidth: 220 }}
          />
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={INPUT_STYLE}>
            <option value="last_name">Trier : Nom (A-Z)</option>
            <option value="-last_name">Trier : Nom (Z-A)</option>
            <option value="username">Trier : Utilisateur (A-Z)</option>
          </select>
        </div>

        {error && <p style={{ color: '#b3261e' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#52606d' }}>Chargement...</p>
        ) : (
          <>
            {patients.length === 0 && <p style={{ color: '#52606d' }}>Aucun patient trouvé.</p>}
            {patients.map((patient) => (
              <Link
                key={patient.id}
                to={`/patient/${patient.id}`}
                style={{ ...CARD_STYLE, display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{patient.username}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52606d' }}>
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