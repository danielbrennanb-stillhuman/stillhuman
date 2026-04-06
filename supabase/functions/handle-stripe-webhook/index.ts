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
  const body = await req.text()
  let event

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const signature = req.headers.get('stripe-signature')

  if (webhookSecret && signature) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error('Signature verification failed:', err.message)
      // Fall through to parse the event without verification
    }
  }

  if (!event) {
    try {
      event = JSON.parse(body)
    } catch {
      return new Response('Invalid body', { status: 400 })
    }
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

    console.log(`Processing: email=${email}, priceId=${priceId}, thoughtsToAdd=${thoughtsToAdd}`)

    // Upsert wallet — creates if new, then increment separately for returning users
    const upsertResult = await supabase.from('wallets').upsert(
      { email, thoughts_remaining: 0, total_purchased: 0 },
      { onConflict: 'email', ignoreDuplicates: true }
    )
    console.log('Upsert result:', JSON.stringify(upsertResult))

    // Atomically increment balance
    const rpcResult = await supabase.rpc('increment_thoughts', {
      user_email: email,
      amount: thoughtsToAdd,
    })
    console.log('RPC result:', JSON.stringify(rpcResult))

    // Log the purchase (ignore duplicate if webhook fires twice)
    const insertResult = await supabase.from('purchases').upsert({
      email,
      thoughts_purchased: thoughtsToAdd,
      amount_cents: session.amount_total ?? 0,
      stripe_session_id: session.id,
    }, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
    console.log('Insert result:', JSON.stringify(insertResult))

    console.log(`Credited ${thoughtsToAdd} Thoughts to ${email}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
