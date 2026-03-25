// After you create products in Stripe, paste the Price IDs here.
// Instructions for getting these are in SETUP.md — Step 3.
export const STRIPE_PRICES = {
  ask:    'price_REPLACE_WITH_YOUR_STRIPE_PRICE_ID_1',  // $1 Standard Inference
  sit:    'price_REPLACE_WITH_YOUR_STRIPE_PRICE_ID_3',  // $3 Extended Context
  really: 'price_REPLACE_WITH_YOUR_STRIPE_PRICE_ID_5',  // $5 Deep Reasoning
}

export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
