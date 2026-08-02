import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './AdminUsersPage.module.css'

const ROLES = ['PATIENT', 'MEDECIN', 'KINE', 'PSYCHOLOGUE']

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
    <form onSubmit={handleSubmit} className={`${styles.card} ${styles.createFormWrap}`}>
      <h3 className={styles.createFormTitle}>{t('admin_users.create_button')}</h3>
      <div className={styles.createFormGrid}>
        <input placeholder={t('login.username')} value={form.username} onChange={update('username')} required className={styles.formInput} />
        <input placeholder={t('admin_users.email_placeholder')} type="email" value={form.email} onChange={update('email')} required className={styles.formInput} />
        <input placeholder={t('profile.info_section')} value={form.first_name} onChange={update('first_name')} className={styles.formInput} />
        <input placeholder={t('professional_appointments.patient_label')} value={form.last_name} onChange={update('last_name')} className={styles.formInput} />
        <input placeholder={t('profile.phone')} value={form.phone_number} onChange={update('phone_number')} className={styles.formInput} />
        <select value={form.role} onChange={update('role')} className={styles.formInput}>
          {ROLES.map((value) => (
            <option key={value} value={value}>{t(`roles.${value}`)}</option>
          ))}
        </select>
        <input placeholder={t('login.password')} type="password" value={form.password} onChange={update('password')} required className={styles.formInputWide} />
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" disabled={submitting} className={styles.formButton}>
          {submitting ? '...' : t('common.confirm')}
        </button>
        <button type="button" onClick={onCancel} className={styles.formButton}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') || ''
  const professionalsOnly = searchParams.get('professionals_only') === 'true'

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
    if (professionalsOnly) params.professionals_only = 'true'

    apiClient.get('/auth/admin/users/', { params })
      .then(({ data }) => {
        setUsers(data.results)
        setCount(data.count)
      })
      .catch(() => setError(t('common.error_generic')))
      .finally(() => setLoading(false))
  }, [page, ordering, debouncedSearch, role, activeFilter, professionalsOnly, t])

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
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('admin_users.title')}</h1>
          <Link to="/admin/dashboard" className={styles.backLink}>{t('common.back_to_dashboard')}</Link>
        </div>

        <div className={styles.filtersRow}>
          <input
            placeholder={t('admin_users.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={styles.selectInput}>
            <option value="">{t('admin_users.all_roles')}</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{t(`roles.${value}`)}</option>
            ))}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className={styles.selectInput}>
            <option value="">{t('admin_users.all_statuses')}</option>
            <option value="true">{t('admin_users.active')}</option>
            <option value="false">{t('admin_users.inactive')}</option>
          </select>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className={styles.selectInput}>
            <option value="last_name">{t('admin_users.sort_name_asc')}</option>
            <option value="-last_name">{t('admin_users.sort_name_desc')}</option>
            <option value="-created_at">{t('admin_users.sort_newest')}</option>
            <option value="created_at">{t('admin_users.sort_oldest')}</option>
          </select>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className={styles.createToggleButton}>
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

        {error && <p className={styles.pageErrorText}>{error}</p>}

        {loading ? (
          <p className={styles.mutedText}>{t('common.loading')}</p>
        ) : (
          <>
            {users.length === 0 && <p className={styles.mutedText}>{t('admin_users.no_users')}</p>}
            {users.map((user) => (
              <div key={user.id} className={`${styles.card} ${styles.userCard}`}>
                <div>
                  <p className={styles.userName}>
                    {user.full_name}
                    {!user.is_active && <span className={styles.deactivatedBadge}>{t('admin_users.deactivated_badge')}</span>}
                  </p>
                  <p className={styles.userMeta}>
                    {t(`roles.${user.role}`)} — {user.email}
                    {user.phone_number && ` — ${user.phone_number}`}
                  </p>
                </div>
                <div>
                  {confirmingId === user.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>{t('admin_users.confirm_question')}</span>
                      <button onClick={() => handleToggleActive(user)} className={styles.confirmButton}>{t('common.yes')}</button>
                      <button onClick={() => setConfirmingId(null)} className={styles.confirmButton}>{t('common.no')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingId(user.id)} className={styles.toggleActiveButton}>
                      {user.is_active ? t('admin_users.deactivate') : t('admin_users.reactivate')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className={styles.paginationButton}>{t('common.previous')}</button>
                <span>{t('common.page_of', { current: page, total: totalPages })}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className={styles.paginationButton}>{t('common.next')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}