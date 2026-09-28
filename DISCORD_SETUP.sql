-- Discord OAuth Integration Database Setup
-- Run this in Supabase SQL Editor

-- Create discord_accounts table
CREATE TABLE IF NOT EXISTS public.discord_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  discord_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  guild_count INTEGER DEFAULT 0,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.discord_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own Discord account"
ON public.discord_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own Discord account"
ON public.discord_accounts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own Discord account"
ON public.discord_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX discord_accounts_user_id_idx ON public.discord_accounts(user_id);
CREATE INDEX discord_accounts_discord_id_idx ON public.discord_accounts(discord_id);
