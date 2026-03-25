// supabase/functions/create-checkout-session/index.ts
// Creates a Stripe Checkout session server-side and returns the URL.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { priceId, email, origin } = await req.json()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    customer_email: email,
    success_url: `${origin}/?purchased=true&email=${encodeURIComponent(email)}`,
    cancel_url: `${origin}/`,
    metadata: { price_id: priceId },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
