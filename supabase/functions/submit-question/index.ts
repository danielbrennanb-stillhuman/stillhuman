// supabase/functions/submit-question/index.ts
// Called by the frontend when someone submits a question.
// Checks balance, deducts one Thought, saves the question,
// and sends a nudge email if balance is now zero.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const { email, question } = await req.json()

  if (!email || !question) {
    return new Response(JSON.stringify({ error: 'Missing email or question' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check balance first
  const { data: wallet } = await supabase
    .from('wallets')
    .select('thoughts_remaining')
    .eq('email', email)
    .single()

  if (!wallet || wallet.thoughts_remaining < 1) {
    return new Response(JSON.stringify({
      error: 'no_thoughts',
      message: 'No Thoughts remaining. Please top up to continue.'
    }), {
      status: 402,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Atomically deduct one Thought
  const { data: success } = await supabase.rpc('deduct_thought', {
    user_email: email
  })

  if (!success) {
    return new Response(JSON.stringify({
      error: 'no_thoughts',
      message: 'No Thoughts remaining.'
    }), {
      status: 402,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Save the question
  const { data: questionRecord, error: questionError } = await supabase
    .from('questions')
    .insert({ email, question, tier: 'thought', status: 'pending' })
    .select('id')
    .single()

  if (questionError) {
    return new Response(JSON.stringify({ error: 'Failed to save question' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check remaining balance after deduction
  const { data: updatedWallet } = await supabase
    .from('wallets')
    .select('thoughts_remaining')
    .eq('email', email)
    .single()

  const remainingThoughts = updatedWallet?.thoughts_remaining ?? 0

  // Send email notification to owner via Resend
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const ownerEmail = Deno.env.get('OWNER_EMAIL')

  if (resendKey && ownerEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'stillhuman <onboarding@resend.dev>',
        to: ownerEmail,
        subject: `New question from ${email}`,
        text: `Someone asked:\n\n${question}\n\nFrom: ${email}\n\nLog in to Supabase to reply.`,
      }),
    })
  }

  // Send nudge email if balance is now zero
  if (remainingThoughts === 0) {
    await supabase.functions.invoke('send-nudge-email', {
      body: { email, remaining: 0 }
    })
  }

  return new Response(JSON.stringify({
    success: true,
    questionId: questionRecord.id,
    thoughtsRemaining: remainingThoughts,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
