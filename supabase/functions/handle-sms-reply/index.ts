// supabase/functions/handle-sms-reply/index.ts
// When you reply to a question SMS on your phone, Twilio sends that reply here.
// This function saves your answer to Supabase, which triggers the realtime update
// on the visitor's waiting screen.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

serve(async (req) => {
  const formData = await req.formData()

  // Twilio sends the SMS body and the original message body
  const incomingMessage = formData.get('Body') as string  // your reply text
  const fromNumber = formData.get('From') as string       // your phone number

  // Security: only accept replies from your phone number
  const yourPhone = Deno.env.get('YOUR_PHONE_NUMBER') as string
  if (fromNumber !== yourPhone) {
    return new Response('Unauthorized', { status: 401 })
  }

  // The SMS format we send you is:
  // "[question-id] Question text here"
  // So we parse the question ID from the start of the original message

  // Twilio includes the message you're replying to via 'OriginalRepliedMessageSid'
  // We'll look up the question ID from the Twilio message SID
  const messageSid = formData.get('OriginalRepliedMessageSid') as string

  // Find the question that matches this Twilio message
  // (We store the Twilio SID when we send the initial SMS — see SETUP.md)
  const { data: question, error } = await supabase
    .from('questions')
    .select('id')
    .eq('twilio_message_sid', messageSid)
    .single()

  if (error || !question) {
    // Fallback: if no match found, log it
    console.error('Could not find question for message:', messageSid)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  // Save the answer and mark as answered — this triggers the realtime update
  await supabase
    .from('questions')
    .update({
      answer: incomingMessage,
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('id', question.id)

  // Return empty TwiML response (required by Twilio)
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  })
})
