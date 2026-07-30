import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/client'
import styles from './TriagePage.module.css'

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
      <div className={styles.container}>
        <h1>{t('triage.result_title')}</h1>
        <div className={styles.resultBox} style={style}>
          <h2 className={styles.resultTitle}>{t(`orientation.${result.orientation}`)}</h2>
        </div>
        {result.orientation === 'URGENCE' && (
          <p className={styles.urgencyMessage}>
            {t('triage.urgency_message')}
          </p>
        )}
        <p className={styles.disclaimer}>
          {t('triage.disclaimer')}
        </p>
        <div className={styles.actionsRow}>
          <button onClick={restart} className={styles.restartButton}>
            {t('triage.restart')}
          </button>
          <Link to="/app">{t('common.back_to_home')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1>{t('triage.title')}</h1>
      <p className={styles.questionProgress}>
        {t('triage.question_of', { current: stepIndex + 1, total: questions.length })}
      </p>
      <p className={styles.questionText}>{currentQuestion.label}</p>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.answersRow}>
        <button
          type="submit"
          onClick={() => handleAnswer(true)}
          disabled={submitting}
          className={styles.answerButton}
        >
          {t('common.yes')}
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={submitting}
          className={styles.answerButton}
        >
          {t('common.no')}
        </button>
      </div>
      {submitting && <p className={styles.loadingText}>{t('common.loading')}</p>}
    </div>
  )
}