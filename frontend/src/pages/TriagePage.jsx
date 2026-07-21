import { useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'

const QUESTIONS = [
  {
    key: 'signe_gravite_immediat',
    label: "Ressentez-vous un signe de gravite immediate ? (difficulte a respirer, douleur thoracique, perte de connaissance, saignement important)",
  },
  {
    key: 'signe_visible_inquietant',
    label: "Avez-vous un signe visible inquietant ? (plaie ouverte, gonflement important, rougeur etendue, fievre elevee)",
  },
  {
    key: 'douleur_intense',
    label: "Ressentez-vous une douleur intense (8 a 10 sur 10) ?",
  },
  {
    key: 'impact_activites_quotidiennes',
    label: "Est-ce que cela vous empeche de mener vos activites quotidiennes ?",
  },
  {
    key: 'depuis_plus_de_3_jours',
    label: "Est-ce que cela dure depuis plus de 3 jours ?",
  },
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
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentQuestion = QUESTIONS[stepIndex]

  const handleAnswer = async (value) => {
    const updatedAnswers = { ...answers, [currentQuestion.key]: value }
    setAnswers(updatedAnswers)

    if (stepIndex + 1 < QUESTIONS.length) {
      setStepIndex(stepIndex + 1)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { data } = await apiClient.post('/triage-assessments/', updatedAnswers)
      setResult(data)
    } catch {
      setError("Une erreur est survenue lors du calcul de l'orientation.")
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
        <h1>Résultat de l'orientation</h1>
        <div style={{ ...style, padding: 20, borderRadius: 8, marginTop: 16 }}>
          <h2 style={{ margin: 0, color: 'inherit' }}>{result.orientation_display}</h2>
        </div>
        {result.orientation === 'URGENCE' && (
          <p style={{ marginTop: 16, fontWeight: 600, color: 'var(--color-urgence-text)' }}>
            Appelez immédiatement les secours (112) ou rendez-vous aux urgences les plus proches.
          </p>
        )}
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Ce résultat est une aide à l'orientation, pas un diagnostic médical.
          En cas de doute, contactez un professionnel de santé.
        </p>
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={restart} style={{ padding: '8px 16px' }}>
            Refaire une évaluation
          </button>
          <Link to="/">Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Aide à l'orientation</h1>
      <p style={{ fontSize: 14 }}>
        Question {stepIndex + 1} sur {QUESTIONS.length}
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
          Oui
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={submitting}
          style={{ padding: '10px 24px' }}
        >
          Non
        </button>
      </div>
      {submitting && <p style={{ marginTop: 16 }}>Calcul en cours...</p>}
    </div>
  )
}