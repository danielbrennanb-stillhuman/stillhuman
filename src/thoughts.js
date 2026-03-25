// src/thoughts.js
// Thought bundle definitions.
// After creating these products in Stripe, replace the price IDs below.
// Instructions in SETUP.md Step 3.

export const BUNDLES = [
  {
    id: 'one',
    thoughts: 1,
    price: '$1',
    priceCents: 100,
    label: 'One Thought',
    description: 'For when you have one thing you\'ve been sitting with.',
    priceId: 'price_1TEgNaKhA87PZ38DTXM1BGuJ',
  },
  {
    id: 'five',
    thoughts: 5,
    price: '$4',
    priceCents: 400,
    label: 'Five Thoughts',
    description: 'For when there\'s more than one thing.',
    priceId: 'price_1TEt61KhA87PZ38Dt0peaV6s',
    perThought: '$0.80 each',
  },
  {
    id: 'ten',
    thoughts: 10,
    price: '$7',
    priceCents: 700,
    label: 'Ten Thoughts',
    description: 'For the people who have a lot going on.',
    priceId: 'price_1TEt78KhA87PZ38DCKs5llMQ',
    perThought: '$0.70 each',
  },
]

// Check a wallet balance by email
export async function getBalance(supabase, email) {
  const { data } = await supabase
    .from('wallets')
    .select('thoughts_remaining')
    .eq('email', email.toLowerCase().trim())
    .single()
  return data?.thoughts_remaining ?? 0
}

// Redirect to Stripe Checkout to purchase a bundle
export async function purchaseBundle(bundle, email) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ priceId: bundle.priceId, email, origin: window.location.origin }),
  })

  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  } else {
    console.error('Checkout error:', data)
    alert('Something went wrong starting checkout. Please try again.')
  }
}

// Submit a question — calls the Supabase edge function
export async function submitQuestion(supabaseUrl, email, question) {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${supabaseUrl}/functions/v1/submit-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ email, question }),
  })
  return res.json()
}
