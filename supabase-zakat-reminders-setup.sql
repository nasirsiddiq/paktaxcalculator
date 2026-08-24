-- Zakat Reminder feature — run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this in -> Run).
--
-- This creates the table that stores each signed-up user's Zakat due date,
-- and locks it down with Row Level Security so a user can only ever see or
-- change their OWN row — nobody else's, including via the public anon key
-- that the website embeds in its front-end code.

create extension if not exists "pgcrypto";

create table if not exists public.zakat_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  due_date date not null,
  due_date_hijri text,
  reporting_currency text,
  reminder_7day_sent boolean not null default false,
  reminder_dueday_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.zakat_reminders enable row level security;

drop policy if exists "Users can view own reminder" on public.zakat_reminders;
create policy "Users can view own reminder"
  on public.zakat_reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reminder" on public.zakat_reminders;
create policy "Users can insert own reminder"
  on public.zakat_reminders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reminder" on public.zakat_reminders;
create policy "Users can update own reminder"
  on public.zakat_reminders for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own reminder" on public.zakat_reminders;
create policy "Users can delete own reminder"
  on public.zakat_reminders for delete
  using (auth.uid() = user_id);

-- Note: the daily reminder-sending job (netlify/functions/send-zakat-reminders.js)
-- uses your Supabase SERVICE ROLE key, which bypasses these policies on purpose --
-- that's the only way a background job can read every user's row to send emails.
-- The service role key must stay a server-side secret (a Netlify environment
-- variable) and must never be pasted into the website's HTML/JS.
