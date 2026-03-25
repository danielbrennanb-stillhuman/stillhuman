// After you create products in Stripe, paste the Price IDs here.
// Instructions for getting these are in SETUP.md — Step 3.
export const STRIPE_PRICES = {
  ask:    'price_1TEgNaKhA87PZ38DTXM1BGuJ',  // $1 Standard Inference
  sit:    'price_1TEgO0KhA87PZ38DPxmvQJOp',  // $3 Extended Context
  really: 'price_1TEgOKKhA87PZ38DrmogXZHC',  // $5 Deep Reasoning
}

export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
