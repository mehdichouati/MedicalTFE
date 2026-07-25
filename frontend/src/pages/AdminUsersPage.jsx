import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

const ROLES = ['PATIENT', 'MEDECIN', 'KINE', 'PSYCHOLOGUE']

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
  const { t } = useTranslation()
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
      setError(Array.isArray(firstError) ? firstError[0] : firstError || t('common.error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...CARD_STYLE, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, color: '#e4e7eb' }}>{t('admin_users.create_button')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder={t('login.username')} value={form.username} onChange={update('username')} required style={{ padding: 6 }} />
        <input placeholder="Email" type="email" value={form.email} onChange={update('email')} required style={{ padding: 6 }} />
        <input placeholder={t('profile.info_section')} value={form.first_name} onChange={update('first_name')} style={{ padding: 6 }} />
        <input placeholder={t('professional_appointments.patient_label')} value={form.last_name} onChange={update('last_name')} style={{ padding: 6 }} />
        <input placeholder={t('profile.phone')} value={form.phone_number} onChange={update('phone_number')} style={{ padding: 6 }} />
        <select value={form.role} onChange={update('role')} style={{ padding: 6 }}>
          {ROLES.map((value) => (
            <option key={value} value={value}>{t(`roles.${value}`)}</option>
          ))}
        </select>
        <input placeholder={t('login.password')} type="password" value={form.password} onChange={update('password')} required style={{ padding: 6, gridColumn: 'span 2' }} />
      </div>
      {error && <p style={{ color: '#f28b82', fontSize: 13, marginTop: 8 }}>{error}</p>}
      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <button type="submit" disabled={submitting} style={{ padding: '6px 16px' }}>
          {submitting ? '...' : t('common.confirm')}
        </button>
        <button type="button" onClick={onCancel} style={{ padding: '6px 16px' }}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
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
      .catch(() => setError(t('common.error_generic')))
      .finally(() => setLoading(false))
  }, [page, ordering, debouncedSearch, role, activeFilter, t])

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
      setError(t('common.error_generic'))
    }
  }

  const totalPages = Math.ceil(count / 20)

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>{t('admin_users.title')}</h1>
          <Link to="/admin/dashboard" style={{ color: '#8ab4f8' }}>{t('common.back_to_dashboard')}</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            placeholder={t('admin_users.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: 8, flex: 1, minWidth: 200 }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 8 }}>
            <option value="">{t('admin_users.all_roles')}</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{t(`roles.${value}`)}</option>
            ))}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={{ padding: 8 }}>
            <option value="">{t('admin_users.all_statuses')}</option>
            <option value="true">{t('admin_users.active')}</option>
            <option value="false">{t('admin_users.inactive')}</option>
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: 8 }}>
            <option value="last_name">{t('admin_users.sort_name_asc')}</option>
            <option value="-last_name">{t('admin_users.sort_name_desc')}</option>
            <option value="-created_at">{t('admin_users.sort_newest')}</option>
            <option value="created_at">{t('admin_users.sort_oldest')}</option>
          </select>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '8px 16px' }}>
            {showCreateForm ? t('admin_users.close') : t('admin_users.create_button')}
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
          <p style={{ color: '#9aa3b2' }}>{t('common.loading')}</p>
        ) : (
          <>
            {users.length === 0 && <p style={{ color: '#9aa3b2' }}>{t('admin_users.no_users')}</p>}
            {users.map((user) => (
              <div key={user.id} style={{ ...CARD_STYLE, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {user.full_name}
                    {!user.is_active && <span style={{ color: '#f28b82', fontSize: 12, marginLeft: 8 }}>{t('admin_users.deactivated_badge')}</span>}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                    {t(`roles.${user.role}`)} — {user.email}
                    {user.phone_number && ` — ${user.phone_number}`}
                  </p>
                </div>
                <div>
                  {confirmingId === user.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>{t('admin_users.confirm_question')}</span>
                      <button onClick={() => handleToggleActive(user)} style={{ padding: '4px 10px' }}>{t('common.yes')}</button>
                      <button onClick={() => setConfirmingId(null)} style={{ padding: '4px 10px' }}>{t('common.no')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingId(user.id)} style={{ padding: '6px 14px' }}>
                      {user.is_active ? t('admin_users.deactivate') : t('admin_users.reactivate')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', color: '#e4e7eb' }}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ padding: '4px 12px' }}>{t('common.previous')}</button>
                <span>{t('common.page_of', { current: page, total: totalPages })}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} style={{ padding: '4px 12px' }}>{t('common.next')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}