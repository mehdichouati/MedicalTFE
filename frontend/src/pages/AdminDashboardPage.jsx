import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import apiClient from '../api/client'
import styles from './AdminDashboardPage.module.css'

const cardBase = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 20,
  color: '#e4e7eb',
}

function StatCard({ label, value, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className={onClick ? styles.statCard : styles.statCardStatic}
      style={{ ...cardBase, borderTop: `3px solid ${accent}` }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  )
}

function formatDateShort(isoDate, locale) {
  const d = new Date(isoDate)
  return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-BE', { day: '2-digit', month: '2-digit' })
}

export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/dashboard/admin/')
      .then(({ data }) => setData(data))
      .catch(() => setError(t('common.error_generic')))
  }, [t])

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error}</p>
        <Link to="/app" className={styles.backLink}>{t('common.back_to_home')}</Link>
      </div>
    )
  }

  if (!data) {
    return <p className={styles.loadingCenter}>{t('common.loading')}</p>
  }

  const { summary, daily_chart, by_medical_house, by_professional } = data
  const chartData = daily_chart.map((d) => ({ ...d, label: formatDateShort(d.date, i18n.language) }))

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('admin_dashboard.title')}</h1>
          <Link to="/app" className={styles.backLink}>{t('common.back_to_home')}</Link>
        </div>

        <div className={styles.cardGrid}>
         <StatCard label={t('admin_dashboard.appointments_today')} value={summary.appointments_today} accent="#5b8def" onClick={() => navigate('/admin/appointments?date=today')} />
          <StatCard label={t('admin_dashboard.pending')} value={summary.pending_appointments} accent="#f0a94e" onClick={() => navigate('/admin/appointments?status=PENDING')} />
          <StatCard label={t('admin_dashboard.completed')} value={summary.completed_appointments} accent="#4caf7d" onClick={() => navigate('/admin/appointments?status=COMPLETED')} />
          <StatCard label={t('admin_dashboard.cancelled_noshow')} value={summary.cancelled_appointments + summary.no_show_appointments} accent="#e0574f" onClick={() => navigate('/admin/appointments?status_in=CANCELLED,NO_SHOW')} />
          <StatCard label={t('admin_dashboard.net_revenue')} value={`${summary.net_revenue_eur.toFixed(2)} €`} accent="#c084fc" />
          <StatCard label={t('admin_dashboard.patients')} value={summary.total_patients} accent="#5b8def" onClick={() => navigate('/admin/users?role=PATIENT')} />
          <StatCard label={t('admin_dashboard.professionals')} value={summary.total_professionals} accent="#5b8def" onClick={() => navigate('/admin/users?professionals_only=true')} />
          <StatCard label={t('admin_dashboard.medical_houses')} value={summary.total_medical_houses} accent="#5b8def" />
          <StatCard label={t('admin_dashboard.reviews')} value={summary.pending_reviews ?? '—'} accent="#f0a94e" onClick={() => navigate('/admin/reviews')} />
        </div>

        <div className={`${styles.card} ${styles.chartCard}`}>
          <h2 className={styles.chartTitle}>{t('admin_dashboard.chart_title')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3440" />
              <XAxis dataKey="label" stroke="#9aa3b2" fontSize={12} />
              <YAxis yAxisId="left" stroke="#9aa3b2" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#9aa3b2" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1f2430', border: '1px solid #2e3440', color: '#e4e7eb' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="appointments" name={t('admin_dashboard.appointments_today').split(' ')[0]} stroke="#5b8def" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="revenue_eur" name={t('admin_dashboard.net_revenue')} stroke="#4caf7d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.twoColumnGrid}>
          <div className={styles.card}>
            <h2 className={styles.listSectionTitle}>{t('admin_dashboard.by_house')}</h2>
            {by_medical_house.map((house) => (
              <div key={house.id} className={styles.listRow}>
                <p className={styles.listRowName}>{house.name}</p>
                <p className={styles.listRowMeta}>
                  {house.total_appointments} — {house.completed} {t('admin_dashboard.completed').toLowerCase()}
                </p>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <h2 className={styles.listSectionTitle}>{t('admin_dashboard.top_professionals')}</h2>
            {by_professional.map((pro, i) => (
              <div key={i} className={styles.listRow}>
                <p className={styles.listRowName}>{pro.professional__username}</p>
                <p className={styles.listRowMeta}>
                  {pro.professional__role} — {pro.total}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}