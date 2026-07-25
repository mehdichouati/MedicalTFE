import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'

const QUESTION_KEYS = [
  { key: 'signe_gravite_immediat', labelKey: 'q1' },
  { key: 'signe_visible_inquietant', labelKey: 'q2' },
  { key: 'douleur_intense', labelKey: 'q3' },
  { key: 'impact_activites_quotidiennes', labelKey: 'q4' },
  { key: 'depuis_plus_de_3_jours', labelKey: 'q5' },
]

const ORIENTATION_STYLES = {
  URGENCE: {
    background: 'var(--color-urgence-bg)',
    border: '1px solid var(--color-urgence-border)',
    color: 'var(--color-urgence-text)',
  },
  CONSULTATION_SUR_PLACE: {
    background: 'var(--color-attention-bg)',
    border: '1px solid var(--color-attention-border)',
    color: 'var(--color-attention-text)',
  },
  TELECONSULTATION: {
    background: 'var(--color-info-bg)',
    border: '1px solid var(--color-info-border)',
    color: 'var(--color-info-text)',
  },
  REPOS: {
    background: 'var(--color-ok-bg)',
    border: '1px solid var(--color-ok-border)',
    color: 'var(--color-ok-text)',
  },
}

export default function TriagePage() {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const questions = QUESTION_KEYS.map((q) => ({ ...q, label: t(`triage.${q.labelKey}`) }))
  const currentQuestion = questions[stepIndex]

  const handleAnswer = async (value) => {
    const updatedAnswers = { ...answers, [currentQuestion.key]: value }
    setAnswers(updatedAnswers)

    if (stepIndex + 1 < questions.length) {
      setStepIndex(stepIndex + 1)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { data } = await apiClient.post('/triage-assessments/', updatedAnswers)
      setResult(data)
    } catch {
      setError(t('common.error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setStepIndex(0)
    setAnswers({})
    setResult(null)
    setError('')
  }

  if (result) {
    const style = ORIENTATION_STYLES[result.orientation] || {}
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>{t('triage.result_title')}</h1>
        <div style={{ ...style, padding: 20, borderRadius: 8, marginTop: 16 }}>
          <h2 style={{ margin: 0, color: 'inherit' }}>{t(`orientation.${result.orientation}`)}</h2>
        </div>
        {result.orientation === 'URGENCE' && (
          <p style={{ marginTop: 16, fontWeight: 600, color: 'var(--color-urgence-text)' }}>
            {t('triage.urgency_message')}
          </p>
        )}
        <p style={{ marginTop: 16, fontSize: 14 }}>
          {t('triage.disclaimer')}
        </p>
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={restart} style={{ padding: '8px 16px' }}>
            {t('triage.restart')}
          </button>
          <Link to="/">{t('common.back_to_home')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{t('triage.title')}</h1>
      <p style={{ fontSize: 14 }}>
        {t('triage.question_of', { current: stepIndex + 1, total: questions.length })}
      </p>
      <p style={{ fontSize: 18, margin: '24px 0', color: 'var(--color-text)' }}>{currentQuestion.label}</p>
      {error && <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="submit"
          onClick={() => handleAnswer(true)}
          disabled={submitting}
          style={{ padding: '10px 24px' }}
        >
          {t('common.yes')}
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={submitting}
          style={{ padding: '10px 24px' }}
        >
          {t('common.no')}
        </button>
      </div>
      {submitting && <p style={{ marginTop: 16 }}>{t('common.loading')}</p>}
    </div>
  )
}