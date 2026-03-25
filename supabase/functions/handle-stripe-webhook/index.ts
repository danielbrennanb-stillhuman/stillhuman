// supabase/functions/handle-stripe-webhook/index.ts
// Fires when someone completes a Stripe Checkout session.
// Credits their Thought balance in Supabase and logs the purchase.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

// Maps Stripe Price IDs to Thoughts — replace with your real IDs
const PRICE_TO_THOUGHTS: Record<string, number> = {
  'price_1TEgNaKhA87PZ38DTXM1BGuJ': 1,
  'price_1TEt61KhA87PZ38Dt0peaV6s': 5,
  'price_1TEt78KhA87PZ38DCKs5llMQ': 10,
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body, signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') as string
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = session.customer_email
    const priceId = session.metadata?.price_id
    const thoughtsToAdd = PRICE_TO_THOUGHTS[priceId ?? ''] ?? 0

    if (!email || thoughtsToAdd === 0) {
      console.error('Missing email or unrecognised price ID', { email, priceId })
      return new Response('Bad data', { status: 400 })
    }

    // Upsert wallet — creates if new, then increment separately for returning users
    await supabase.from('wallets').upsert(
      { email, thoughts_remaining: 0, total_purchased: 0 },
      { onConflict: 'email', ignoreDuplicates: true }
    )

    // Atomically increment balance
    await supabase.rpc('increment_thoughts', {
      user_email: email,
      amount: thoughtsToAdd,
    })

    // Log the purchase
    await supabase.from('purchases').insert({
      email,
      thoughts_purchased: thoughtsToAdd,
      amount_cents: session.amount_total ?? 0,
      stripe_session_id: session.id,
    })

    console.log(`Credited ${thoughtsToAdd} Thoughts to ${email}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
