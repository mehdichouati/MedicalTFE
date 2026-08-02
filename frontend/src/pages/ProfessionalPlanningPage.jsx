import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './ProfessionalPlanningPage.module.css'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function formatDateTime(isoString, locale) {
  return new Date(isoString).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ProfessionalPlanningPage() {
  const { t, i18n } = useTranslation()
  const [house, setHouse] = useState(null)
  const [availabilities, setAvailabilities] = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [availForm, setAvailForm] = useState({ weekday: '0', start_time: '09:00', end_time: '17:00' })
  const [availSubmitting, setAvailSubmitting] = useState(false)
  const [availError, setAvailError] = useState('')
  const [deletingAvailId, setDeletingAvailId] = useState(null)

  const [absenceForm, setAbsenceForm] = useState({ start_datetime: '', end_datetime: '', reason: '' })
  const [absenceSubmitting, setAbsenceSubmitting] = useState(false)
  const [absenceError, setAbsenceError] = useState('')
  const [deletingAbsenceId, setDeletingAbsenceId] = useState(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      apiClient.get('/availabilities/'),
      apiClient.get('/absences/'),
    ])
      .then(([availRes, absenceRes]) => {
        setAvailabilities(Array.isArray(availRes.data) ? availRes.data : availRes.data.results)
        setAbsences(Array.isArray(absenceRes.data) ? absenceRes.data : absenceRes.data.results)
      })
      .catch(() => setError(t('planning.load_error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    apiClient.get('/public/medical-house/').then(({ data }) => setHouse(data)).catch(() => {})
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddAvailability = async (e) => {
    e.preventDefault()
    if (!house) return
    setAvailSubmitting(true)
    setAvailError('')
    try {
      await apiClient.post('/availabilities/', {
        medical_house: house.id,
        weekday: Number(availForm.weekday),
        start_time: availForm.start_time,
        end_time: availForm.end_time,
      })
      loadData()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setAvailError(Array.isArray(firstError) ? firstError[0] : firstError || t('planning.error_generic'))
    } finally {
      setAvailSubmitting(false)
    }
  }

  const handleDeleteAvailability = async (id) => {
    try {
      await apiClient.delete(`/availabilities/${id}/`)
      setDeletingAvailId(null)
      loadData()
    } catch {
      setAvailError(t('planning.error_generic'))
    }
  }

  const handleAddAbsence = async (e) => {
    e.preventDefault()
    setAbsenceSubmitting(true)
    setAbsenceError('')
    try {
      await apiClient.post('/absences/', {
        start_datetime: absenceForm.start_datetime,
        end_datetime: absenceForm.end_datetime,
        reason: absenceForm.reason,
      })
      setAbsenceForm({ start_datetime: '', end_datetime: '', reason: '' })
      loadData()
    } catch (err) {
      const data = err.response?.data
      const firstError = data ? Object.values(data)[0] : null
      setAbsenceError(Array.isArray(firstError) ? firstError[0] : firstError || t('planning.error_generic'))
    } finally {
      setAbsenceSubmitting(false)
    }
  }

  const handleDeleteAbsence = async (id) => {
    try {
      await apiClient.delete(`/absences/${id}/`)
      setDeletingAbsenceId(null)
      loadData()
    } catch {
      setAbsenceError(t('planning.error_generic'))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{t('planning.title')}</h1>
        <p className={styles.backLinkRow}>
          <Link to="/app" className={styles.backLink}>← {t('common.back_to_home')}</Link>
        </p>

        {error && <p className={styles.errorText}>{error}</p>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('planning.availabilities_section')}</h2>

          {loading ? (
            <p className={styles.loadingText}>{t('common.loading')}</p>
          ) : (
            <>
              {availabilities.length === 0 && <p className={styles.loadingText}>{t('planning.no_availabilities')}</p>}
              {availabilities.map((a) => (
                <div key={a.id} className={styles.card}>
                  <p className={styles.cardText}>
                    {t(`planning.weekday_${a.weekday}`)} — {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                  </p>
                  {deletingAvailId === a.id ? (
                    <div className={styles.confirmRow}>
                      <span>{t('planning.confirm_delete_question')}</span>
                      <button onClick={() => handleDeleteAvailability(a.id)} className={styles.confirmBtn}>{t('common.yes')}</button>
                      <button onClick={() => setDeletingAvailId(null)} className={styles.abortBtn}>{t('common.no')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingAvailId(a.id)} className={styles.deleteButton}>
                      {t('planning.delete_button')}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          <form onSubmit={handleAddAvailability} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>{t('planning.weekday_label')}</label><br />
                <select
                  value={availForm.weekday}
                  onChange={(e) => setAvailForm({ ...availForm, weekday: e.target.value })}
                  className={styles.input}
                >
                  {WEEKDAYS.map((wd) => (
                    <option key={wd} value={wd}>{t(`planning.weekday_${wd}`)}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>{t('planning.start_time_label')}</label><br />
                <input
                  type="time"
                  value={availForm.start_time}
                  onChange={(e) => setAvailForm({ ...availForm, start_time: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>{t('planning.end_time_label')}</label><br />
                <input
                  type="time"
                  value={availForm.end_time}
                  onChange={(e) => setAvailForm({ ...availForm, end_time: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
            </div>
            {availError && <p className={styles.errorText}>{availError}</p>}
            <button type="submit" disabled={availSubmitting || !house} className={styles.submitButton}>
              {availSubmitting ? t('planning.adding') : t('planning.add_availability_button')}
            </button>
          </form>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('planning.absences_section')}</h2>

          {loading ? (
            <p className={styles.loadingText}>{t('common.loading')}</p>
          ) : (
            <>
              {absences.length === 0 && <p className={styles.loadingText}>{t('planning.no_absences')}</p>}
              {absences.map((a) => (
                <div key={a.id} className={styles.card}>
                  <p className={styles.cardText}>
                    {formatDateTime(a.start_datetime, i18n.language)} → {formatDateTime(a.end_datetime, i18n.language)}
                    {a.reason && ` — ${a.reason}`}
                  </p>
                  {deletingAbsenceId === a.id ? (
                    <div className={styles.confirmRow}>
                      <span>{t('planning.confirm_delete_question')}</span>
                      <button onClick={() => handleDeleteAbsence(a.id)} className={styles.confirmBtn}>{t('common.yes')}</button>
                      <button onClick={() => setDeletingAbsenceId(null)} className={styles.abortBtn}>{t('common.no')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingAbsenceId(a.id)} className={styles.deleteButton}>
                      {t('planning.delete_button')}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          <form onSubmit={handleAddAbsence} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label>{t('planning.start_date_label')}</label><br />
                <input
                  type="datetime-local"
                  value={absenceForm.start_datetime}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, start_datetime: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>{t('planning.end_date_label')}</label><br />
                <input
                  type="datetime-local"
                  value={absenceForm.end_datetime}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, end_datetime: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label>{t('planning.reason_label')}</label><br />
              <input
                type="text"
                value={absenceForm.reason}
                onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                className={styles.input}
              />
            </div>
            {absenceError && <p className={styles.errorText}>{absenceError}</p>}
            <button type="submit" disabled={absenceSubmitting} className={styles.submitButton}>
              {absenceSubmitting ? t('planning.adding') : t('planning.add_absence_button')}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}