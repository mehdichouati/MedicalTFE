import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'

const ROLE_LABELS = {
  PATIENT: 'Patient',
  MEDECIN: 'Médecin généraliste',
  KINE: 'Kinésithérapeute',
  PSYCHOLOGUE: 'Psychologue',
}

const CARD_STYLE = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 16,
  color: '#e4e7eb',
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function CreateUserForm({ defaultRole, onCreated, onCancel }) {
  const [form, setForm] = useState({
    username: '', first_name: '', last_name: '', email: '',
    role: defaultRole || 'PATIENT', phone_number: '', password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await apiClient.post('/auth/admin/users/', form)
      onCreated()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Erreur lors de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...CARD_STYLE, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, color: '#e4e7eb' }}>Créer un compte</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder="Nom d'utilisateur" value={form.username} onChange={update('username')} required style={{ padding: 6 }} />
        <input placeholder="Email" type="email" value={form.email} onChange={update('email')} required style={{ padding: 6 }} />
        <input placeholder="Prénom" value={form.first_name} onChange={update('first_name')} style={{ padding: 6 }} />
        <input placeholder="Nom" value={form.last_name} onChange={update('last_name')} style={{ padding: 6 }} />
        <input placeholder="Téléphone" value={form.phone_number} onChange={update('phone_number')} style={{ padding: 6 }} />
        <select value={form.role} onChange={update('role')} style={{ padding: 6 }}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input placeholder="Mot de passe" type="password" value={form.password} onChange={update('password')} required style={{ padding: 6, gridColumn: 'span 2' }} />
      </div>
      {error && <p style={{ color: '#f28b82', fontSize: 13, marginTop: 8 }}>{error}</p>}
      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <button type="submit" disabled={submitting} style={{ padding: '6px 16px' }}>
          {submitting ? 'Création...' : 'Créer'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding: '6px 16px' }}>Annuler</button>
      </div>
    </form>
  )
}

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRole = searchParams.get('role') || ''

  const [users, setUsers] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState(initialRole)
  const [activeFilter, setActiveFilter] = useState('')
  const [ordering, setOrdering] = useState('last_name')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)

  const debouncedSearch = useDebouncedValue(search, 400)

  const loadUsers = useCallback(() => {
    setLoading(true)
    const params = { page, ordering }
    if (debouncedSearch) params.search = debouncedSearch
    if (role) params.role = role
    if (activeFilter) params.is_active = activeFilter

    apiClient.get('/auth/admin/users/', { params })
      .then(({ data }) => {
        setUsers(data.results)
        setCount(data.count)
      })
      .catch(() => setError('Impossible de charger les utilisateurs.'))
      .finally(() => setLoading(false))
  }, [page, ordering, debouncedSearch, role, activeFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, activeFilter])

  const handleToggleActive = async (user) => {
    try {
      const { data } = await apiClient.delete(`/auth/admin/users/${user.id}/`)
      setUsers(users.map((u) => (u.id === user.id ? data : u)))
      setConfirmingId(null)
    } catch {
      setError("Impossible de modifier le statut de l'utilisateur.")
    }
  }

  const totalPages = Math.ceil(count / 20)

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>Utilisateurs</h1>
          <Link to="/admin/dashboard" style={{ color: '#8ab4f8' }}>Retour au tableau de bord</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            placeholder="Rechercher nom, prénom, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: 8, flex: 1, minWidth: 200 }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 8 }}>
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={{ padding: 8 }}>
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: 8 }}>
            <option value="last_name">Trier : Nom (A-Z)</option>
            <option value="-last_name">Trier : Nom (Z-A)</option>
            <option value="-created_at">Trier : Plus récent</option>
            <option value="created_at">Trier : Plus ancien</option>
          </select>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '8px 16px' }}>
            {showCreateForm ? 'Fermer' : '+ Créer un compte'}
          </button>
        </div>

        {showCreateForm && (
          <CreateUserForm
            defaultRole={role || 'PATIENT'}
            onCreated={() => { setShowCreateForm(false); loadUsers() }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {error && <p style={{ color: '#f28b82' }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#9aa3b2' }}>Chargement...</p>
        ) : (
          <>
            {users.length === 0 && <p style={{ color: '#9aa3b2' }}>Aucun utilisateur trouvé.</p>}
            {users.map((user) => (
              <div key={user.id} style={{ ...CARD_STYLE, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {user.full_name}
                    {!user.is_active && <span style={{ color: '#f28b82', fontSize: 12, marginLeft: 8 }}>DÉSACTIVÉ</span>}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                    {ROLE_LABELS[user.role] || user.role} — {user.email}
                    {user.phone_number && ` — ${user.phone_number}`}
                  </p>
                </div>
                <div>
                  {confirmingId === user.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>Confirmer ?</span>
                      <button onClick={() => handleToggleActive(user)} style={{ padding: '4px 10px' }}>Oui</button>
                      <button onClick={() => setConfirmingId(null)} style={{ padding: '4px 10px' }}>Non</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingId(user.id)} style={{ padding: '6px 14px' }}>
                      {user.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', color: '#e4e7eb' }}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ padding: '4px 12px' }}>Précédent</button>
                <span>Page {page} / {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} style={{ padding: '4px 12px' }}>Suivant</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
