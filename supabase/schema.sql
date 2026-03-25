-- Run this entire file in your Supabase SQL Editor (Step 4 of SETUP.md)
-- It creates the questions table and enables realtime updates

create table questions (
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
