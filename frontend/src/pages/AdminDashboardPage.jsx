import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

function formatDateShort(isoDate) {
  const d = new Date(isoDate)
  return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/dashboard/admin/')
      .then(({ data }) => setData(data))
      .catch(() => setError("Impossible de charger le tableau de bord."))
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>
        <Link to="/">Retour à l'accueil</Link>
      </div>
    )
  }

  if (!data) {
    return <p style={{ textAlign: 'center', marginTop: 80 }}>Chargement...</p>
  }

  const { summary, daily_chart, by_medical_house, by_professional } = data
  const chartData = daily_chart.map((d) => ({ ...d, label: formatDateShort(d.date) }))

  return (
    <div style={{ background: '#12151c', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', margin: 0 }}>Tableau de bord administrateur</h1>
          <Link to="/" style={{ color: '#8ab4f8' }}>Retour à l'accueil</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="Rendez-vous aujourd'hui" value={summary.appointments_today} accent="#5b8def" onClick={() => navigate('/admin/appointments')} />
          <StatCard label="En attente" value={summary.pending_appointments} accent="#f0a94e" onClick={() => navigate('/admin/appointments?status=PENDING')} />
          <StatCard label="Terminés" value={summary.completed_appointments} accent="#4caf7d" onClick={() => navigate('/admin/appointments?status=COMPLETED')} />
          <StatCard label="Annulés / Absences" value={summary.cancelled_appointments + summary.no_show_appointments} accent="#e0574f" onClick={() => navigate('/admin/appointments')} />
          <StatCard label="Revenu net" value={`${summary.net_revenue_eur.toFixed(2)} €`} accent="#c084fc" />
          <StatCard label="Patients" value={summary.total_patients} accent="#5b8def" onClick={() => navigate('/admin/users?role=PATIENT')} />
          <StatCard label="Professionnels" value={summary.total_professionals} accent="#5b8def" onClick={() => navigate('/admin/users')} />
          <StatCard label="Maisons médicales" value={summary.total_medical_houses} accent="#5b8def" />
        </div>

        <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>Activité des 14 derniers jours</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3440" />
              <XAxis dataKey="label" stroke="#9aa3b2" fontSize={12} />
              <YAxis yAxisId="left" stroke="#9aa3b2" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#9aa3b2" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1f2430', border: '1px solid #2e3440', color: '#e4e7eb' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="appointments" name="Rendez-vous" stroke="#5b8def" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="revenue_eur" name="Revenu (€)" stroke="#4caf7d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={CARD_STYLE}>
            <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>Par maison médicale</h2>
            {by_medical_house.map((house) => (
              <div key={house.id} style={{ padding: '10px 0', borderBottom: '1px solid #2e3440' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{house.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {house.total_appointments} rendez-vous — {house.completed} terminés
                </p>
              </div>
            ))}
          </div>

          <div style={CARD_STYLE}>
            <h2 style={{ marginTop: 0, fontSize: 16, color: '#e4e7eb' }}>Top professionnels</h2>
            {by_professional.map((pro, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #2e3440' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{pro.professional__username}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9aa3b2' }}>
                  {pro.professional__role} — {pro.total} rendez-vous
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
