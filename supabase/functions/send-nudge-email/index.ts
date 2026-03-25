// supabase/functions/send-nudge-email/index.ts
// Sends a gentle email when someone's Thought balance hits zero.
// Tone matches the site — not pushy, not corporate.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'stillhuman.ai <hello@stillhuman.ai>'

serve(async (req) => {
  const { email } = await req.json()

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #18140f; padding: 40px 20px;">
      <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; margin-bottom: 32px;">
        STILLHUMAN.AI · ORGANIC INTELLIGENCE™
      </p>

      <p style="font-size: 18px; line-height: 1.85; margin-bottom: 20px;">
        That was your last Thought.
      </p>

      <p style="font-size: 16px; line-height: 1.85; color: #555; margin-bottom: 20px;">
        A person is still working on your question. You'll hear back.
      </p>

      <p style="font-size: 16px; line-height: 1.85; color: #555; margin-bottom: 32px;">
        If you have more to say — or more you've been sitting with — you can
        pick up more Thoughts whenever you're ready. No rush.
      </p>

      <a href="https://stillhuman.ai" style="display: inline-block; background: #18140f; color: #ece8de; text-decoration: none; padding: 14px 32px; font-family: monospace; font-size: 11px; letter-spacing: 0.15em;">
        GET MORE THOUGHTS
      </a>

      <p style="font-size: 13px; color: #aaa; margin-top: 40px; font-style: italic; line-height: 1.7;">
        1 Thought for $1 · 5 for $4 · 10 for $7<br/>
        Not therapy. Not advice. Just a person.
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "That was your last Thought.",
      html,
    }),
  })

  if (!res.ok) {
    console.error('Failed to send nudge email:', await res.text())
    return new Response('Email failed', { status: 500 })
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
