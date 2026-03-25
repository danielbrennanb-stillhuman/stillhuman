# stillhuman.ai — Setup Guide

This guide will take you from zero to live. Every step is written assuming
no prior experience with terminals, git, or developer tools.

Estimated time: 2–3 hours, spread across a weekend.

---

## What you will create accounts for

You need four free accounts. Create them in this order:

1. **GitHub** — github.com (stores your code)
2. **Vercel** — vercel.com (publishes your website)
3. **Supabase** — supabase.com (the database)
4. **Stripe** — stripe.com (payments)
5. **Twilio** — twilio.com (SMS to your phone)

---

## STEP 1 — Install the tools on your computer

You only do this once.

### Install Node.js
1. Go to nodejs.org
2. Click the big green "LTS" download button
3. Open the downloaded file and follow the installer
4. When it's done, open Terminal (on Mac: press Cmd+Space, type "Terminal", press Enter)
5. Type exactly this and press Enter:
   ```
   node --version
   ```
6. You should see something like `v20.0.0` — any number is fine. This means it worked.

### Install the Supabase CLI
In Terminal, type exactly this and press Enter:
```
npm install -g supabase
```
Wait for it to finish. You'll see a lot of text — that's normal.

### Install Git
1. Go to git-scm.com/downloads
2. Download for your operating system
3. Open the installer and click through the defaults
4. When done, type this in Terminal:
   ```
   git --version
   ```
5. You should see a version number.

---

## STEP 2 — Put the code on GitHub

GitHub is where your code lives. Think of it as Google Drive for code.

1. Go to github.com and create a free account
2. Click the "+" button in the top right → "New repository"
3. Name it: `stillhuman`
4. Leave everything else as default
5. Click "Create repository"
6. GitHub will show you a page with instructions. Copy the URL — it looks like:
   `https://github.com/YOUR-USERNAME/stillhuman.git`

Now in Terminal:
```
cd Desktop
```
(This moves Terminal into your Desktop folder)

```
git clone https://github.com/YOUR-USERNAME/stillhuman.git
```
(This creates a folder called `stillhuman` on your Desktop)

Now, take all the files from this project folder (the ones Claude created)
and drag them into that `stillhuman` folder on your Desktop.

Then in Terminal:
```
cd stillhuman
git add .
git commit -m "initial commit"
git push
```

If it asks for your GitHub username and password, enter them.
Your code is now on GitHub.

---

## STEP 3 — Set up Stripe (payments)

1. Go to stripe.com and create an account
2. In the Stripe Dashboard, click "Products" in the left sidebar
3. Click "Add product"
4. Create three products, one at a time:

   **Product 1:**
   - Name: Standard Inference
   - Price: $1.00 USD, one time
   - Click Save

   **Product 2:**
   - Name: Extended Context
   - Price: $3.00 USD, one time
   - Click Save

   **Product 3:**
   - Name: Deep Reasoning
   - Price: $5.00 USD, one time
   - Click Save

5. After creating each product, click on it and find the "Price ID"
   It looks like: `price_1Abcdef...`
   Copy each one.

6. Open the file `src/stripe.js` in a text editor (TextEdit on Mac, Notepad on Windows)
   Replace the three placeholder values with your real Price IDs:
   ```
   ask:    'price_YOUR_REAL_ID_HERE',
   sit:    'price_YOUR_REAL_ID_HERE',
   really: 'price_YOUR_REAL_ID_HERE',
   ```
   Save the file.

7. In Stripe Dashboard → Developers → API Keys
   Copy your "Publishable key" — it starts with `pk_live_`

---

## STEP 4 — Set up Supabase (the database)

1. Go to supabase.com and create a free account
2. Click "New Project"
3. Name it `stillhuman`
4. Choose a strong database password (save it somewhere)
5. Choose the region closest to you
6. Click "Create new project" and wait ~2 minutes

7. When it's ready, click "SQL Editor" in the left sidebar
8. Click "New query"
9. Open the file `supabase/schema.sql` from this project in a text editor
10. Copy everything in that file and paste it into the SQL Editor
11. Click "Run" (the green button)
12. You should see "Success. No rows returned."

13. Now go to Project Settings → API
    Copy two values:
    - **Project URL** — looks like `https://abcdefg.supabase.co`
    - **anon public** key — a long string starting with `eyJ`

---

## STEP 5 — Create your environment file

1. In your `stillhuman` folder on your Desktop, find the file `.env.example`
2. Make a copy of it and name the copy exactly: `.env.local`
   (Note: files starting with `.` may be hidden on Mac.
   In Finder: press Cmd+Shift+. to show hidden files)

3. Open `.env.local` in a text editor and fill in your values:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...YOUR-FULL-ANON-KEY
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR-KEY
   ```

4. Save the file. **Never share this file with anyone.**

---

## STEP 6 — Deploy to Vercel (make it live on the internet)

1. Go to vercel.com and sign up with your GitHub account
2. Click "Add New Project"
3. Find your `stillhuman` repository and click "Import"
4. Under "Environment Variables", add these three (same as your .env.local):
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `VITE_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key
5. Click "Deploy"
6. Wait ~2 minutes. When it's done, Vercel gives you a URL like:
   `https://stillhuman-abc123.vercel.app`

Your site is now live. 🎉

---

## STEP 7 — Set up Twilio (SMS to your phone)

This is how questions get to you as text messages.

1. Go to twilio.com and create a free account
2. Verify your personal phone number during signup
3. In the Twilio Console, click "Get a phone number"
   Twilio will give you a number like +1 (234) 567-8900
   This is your stillhuman phone number.

4. Now deploy the Supabase Edge Functions.
   In Terminal, navigate to your project:
   ```
   cd ~/Desktop/stillhuman
   ```
   
   Log in to Supabase CLI:
   ```
   supabase login
   ```
   It will open a browser — click "Authorize".

   Link to your project (replace with your project ID from the Supabase URL):
   ```
   supabase link --project-ref YOUR-PROJECT-ID
   ```

   Set the secret environment variables:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR-SECRET-KEY
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR-WEBHOOK-SECRET
   supabase secrets set YOUR_PHONE_NUMBER=+1YOURNUMBER
   ```
   (Your Stripe secret key is in Stripe Dashboard → Developers → API Keys)
   (The webhook secret comes from Step 8 below)

   Deploy the functions:
   ```
   supabase functions deploy handle-stripe-webhook
   supabase functions deploy handle-sms-reply
   ```

5. In the Twilio Console → Phone Numbers → your number → Messaging:
   Under "A message comes in", select "Webhook" and paste:
   ```
   https://YOUR-PROJECT-ID.supabase.co/functions/v1/handle-sms-reply
   ```
   Click Save.

---

## STEP 8 — Connect Stripe to Supabase (webhooks)

This tells Stripe to notify your database when someone pays.

1. In Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL:
   ```
   https://YOUR-PROJECT-ID.supabase.co/functions/v1/handle-stripe-webhook
   ```
4. Click "Select events" → find and check `checkout.session.completed`
5. Click "Add endpoint"
6. On the webhook page, click "Reveal" next to "Signing secret"
   Copy it — it starts with `whsec_`
7. Go back to Terminal and run:
   ```
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR-SECRET-HERE
   ```

---

## STEP 9 — Connect your domain (optional but recommended)

1. Buy `stillhuman.ai` at namecheap.com or porkbun.com (~$15/year)
2. In Vercel → your project → Settings → Domains
3. Add your domain and follow Vercel's instructions to point it

---

## STEP 10 — Test the whole thing

1. Go to your live site
2. Submit a test question with a real email address
3. Use Stripe's test card number: `4242 4242 4242 4242`, any future date, any CVC
4. You should receive an SMS on your phone with the question
5. Reply to the SMS
6. The waiting page should update automatically

If anything doesn't work, the most common issue is a missing or wrong
environment variable. Double-check all your keys.

---

## HOW TO ANSWER A QUESTION (day to day)

When someone submits a question:
1. You receive a text message with their question
2. Read it. Think about it. Go for a walk.
3. When you're ready, reply to that text message.
4. Their waiting page updates automatically with your answer.
5. They also receive your answer by email (Twilio handles this).

That's it. That's the whole product.

---

## UPDATING THE SITE

Whenever you want to change the copy, design, or thought bubbles:
1. Make your changes in the files on your Desktop
2. In Terminal:
   ```
   cd ~/Desktop/stillhuman
   git add .
   git commit -m "describe what you changed"
   git push
   ```
3. Vercel automatically redeploys. Live in ~2 minutes.

---

## COSTS

At low volume (under 100 questions/month):
- Vercel: free
- Supabase: free
- Stripe: 2.9% + $0.30 per transaction (~$0.33 on a $1 question)
- Twilio: ~$1/month for the phone number + $0.0079 per SMS
- Domain: ~$15/year

Total monthly cost: under $5

---

## IF YOU GET STUCK

Every error message is searchable. Copy the exact text and search it.
Or bring it back here — paste the error and we'll figure it out together.
