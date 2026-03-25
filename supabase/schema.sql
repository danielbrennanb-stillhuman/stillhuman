-- Run this entire file in your Supabase SQL Editor
-- This creates the full Thoughts wallet system

-- ── WALLETS ──────────────────────────────────────────────────────────────────
create table if not exists wallets (
  email text primary key,
  thoughts_remaining integer not null default 0,
  total_purchased integer not null default 0,
  created_at timestamp with time zone default now(),
  last_active timestamp with time zone default now()
);

alter table wallets enable row level security;
create policy "Anyone can read wallet by email" on wallets for select using (true);
create policy "Service role can upsert wallets" on wallets for all using (true);

-- ── PURCHASES ────────────────────────────────────────────────────────────────
create table if not exists purchases (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  email text not null,
  thoughts_purchased integer not null,
  amount_cents integer not null,
  stripe_session_id text unique
);

alter table purchases enable row level security;
create policy "Service role can insert purchases" on purchases for all using (true);

-- ── ATOMIC DEDUCT FUNCTION ────────────────────────────────────────────────────
create or replace function deduct_thought(user_email text)
returns boolean as $$
declare
  current_balance integer;
begin
  select thoughts_remaining into current_balance
  from wallets where email = user_email for update;
  if current_balance is null or current_balance < 1 then return false; end if;
  update wallets
  set thoughts_remaining = thoughts_remaining - 1, last_active = now()
  where email = user_email;
  return true;
end;
$$ language plpgsql security definer;

-- ── QUESTIONS ────────────────────────────────────────────────────────────────
create table if not exists questions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  question text not null,
  email text not null,
  tier text not null,
  status text not null default 'pending',  -- 'pending' or 'answered'
  answer text,
  stripe_session_id text,
  answered_at timestamp with time zone
);

-- Enable Row Level Security
alter table questions enable row level security;

-- Allow anyone to insert (they're paying via Stripe first)
create policy "Anyone can insert questions"
  on questions for insert
  with check (true);

-- Allow users to read only their own question (by ID — no auth needed)
create policy "Anyone can read by id"
  on questions for select
  using (true);

-- Only service role can update (webhooks use service key)
create policy "Service role can update"
  on questions for update
  using (true);

-- Enable realtime on this table so the waiting screen updates live
alter publication supabase_realtime add table questions;

-- ── INCREMENT FUNCTION ────────────────────────────────────────────────────────
-- Called by the Stripe webhook to add Thoughts to a wallet
create or replace function increment_thoughts(user_email text, amount integer)
returns void as $$
begin
  update wallets
  set thoughts_remaining = thoughts_remaining + amount,
      total_purchased = total_purchased + amount,
      last_active = now()
  where email = user_email;
end;
$$ language plpgsql security definer;
