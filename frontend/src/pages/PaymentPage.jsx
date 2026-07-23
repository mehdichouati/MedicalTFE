import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import apiClient from '../api/client'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)

const CONSULTATION_PRICE_CENTS = 2500 // 25 EUR, prix fixe pour l'instant

function CheckoutForm({ appointmentId }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError('')

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/history`,
      },
    })

    if (confirmError) {
      setError(confirmError.message)
      setSubmitting(false)
    }
    // Si pas d'erreur, Stripe redirige automatiquement vers return_url.
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p style={{ color: 'var(--color-urgence-text)', fontSize: 14, marginTop: 12 }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{ marginTop: 16, padding: '10px 24px' }}
      >
        {submitting ? 'Traitement...' : `Payer ${(CONSULTATION_PRICE_CENTS / 100).toFixed(2)} €`}
      </button>
    </form>
  )
}

export default function PaymentPage() {
  const { appointmentId } = useParams()
  const [clientSecret, setClientSecret] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.post('/payments/create-intent/', {
      appointment: appointmentId,
      amount_cents: CONSULTATION_PRICE_CENTS,
    })
      .then(({ data }) => setClientSecret(data.client_secret))
      .catch(() => setError("Impossible d'initialiser le paiement."))
  }, [appointmentId])

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Paiement de la consultation</h1>
      <p><Link to="/history">Retour à mon historique</Link></p>

      {error && <p style={{ color: 'var(--color-urgence-text)' }}>{error}</p>}

      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm appointmentId={appointmentId} />
        </Elements>
      )}

      {!clientSecret && !error && <p>Chargement du formulaire de paiement...</p>}
    </div>
  )
}
