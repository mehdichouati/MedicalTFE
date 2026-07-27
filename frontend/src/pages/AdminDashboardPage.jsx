import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import apiClient from '../api/client'

const CARD_STYLE = {
  background: '#1f2430',
  borderRadius: 10,
  padding: 20,
  color: '#e4e7eb',
}

function StatCard({ label, value, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...CARD_STYLE,
        borderTop: `3px solid ${accent}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s ease',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <p style={{ margin: 0, fontSize: 13, color: '#9aa3b2' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700 }}>{value}</p>
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
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>
        <Link to="/">{t('common.back_to_home')}</Link>
      </div>
    )
  }

  if (!data) {
    return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('common.loading')}</p>
  }

  const { summary, daily_chart, by_medical_house, by_professional } = data
  const chartData = daily_chart.map((d) => ({ ...d, label: formatDateShort(d.date, i18n.language) }))

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>{t('admin_dashboard.title')}</h1>
          <Link to="/" style={{ color: '#8ab4f8' }}>{t('common.back_to_home')}</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label={t('admin_dashboard.appointments_today')} value={summary.appointments_today} accent="#5b8def" onClick={() => navigate('/admin/appointments')} />
          <StatCard label={t('admin_dashboard.pending')} value={summary.pending_appointments} accent="#f0a94e" onClick={() => navigate('/admin/appointments?status=PENDING')} />
          <StatCard label={t('admin_dashboard.completed')} value={summary.completed_appointments} accent="#4caf7d" onClick={() => navigate('/admin/appointments?status=COMPLETED')} />
          <StatCard label={t('admin_dashboard.cancelled_noshow')} value={summary.cancelled_appointments + summary.no_show_appointments} accent="#e0574f" onClick={() => navigate('/admin/appointments')} />
          <StatCard label={t('admin_dashboard.net_revenue')} value={`${summary.net_revenue_eur.toFixed(2)} €`} accent="#c084fc" />
          <StatCard label={t('admin_dashboard.patients')} value={summary.total_patients} accent="#5b8def" onClick={() => navigate('/admin/users?role=PATIENT')} />
          <StatCard label={t('admin_dashboard.professionals')} value={summary.total_professionals} accent="#5b8def" onClick={() => navigate('/admin/users')} />
          <StatCard label={t('admin_dashboard.medical_houses')} value={summary.total_medical_houses} accent="#5b8def" />
          <StatCard label="Avis patients" value={summary.pending_reviews ?? '—'} accent="#f0a94e" onClick={() => navigate('/admin/reviews')} />
        </div>

        <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>{t('admin_dashboard.chart_title')}</h2>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={CARD_STYLE}>
            <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>{t('admin_dashboard.by_house')}</h2>
            {by_medical_house.map((house) => (
              <div key={house.id} style={{ padding: '10px 0', borderBottom: '1px solid #2e3440' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{house.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {house.total_appointments} — {house.completed} {t('admin_dashboard.completed').toLowerCase()}
                </p>
              </div>
            ))}
          </div>

          <div style={CARD_STYLE}>
            <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>{t('admin_dashboard.top_professionals')}</h2>
            {by_professional.map((pro, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #2e3440' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{pro.professional__username}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
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