-- Fix admin tie-breaker voting by allowing admins to have both regular and admin votes
-- Modify unique constraint to include is_admin_vote field

-- Drop the existing unique constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_vote;

-- Add new unique constraint that includes is_admin_vote
-- This allows one regular vote and one admin vote per user per matchup
ALTER TABLE public.votes ADD CONSTRAINT unique_user_matchup_admin_vote 
    UNIQUE (user_id, matchup_id, is_admin_vote);

COMMENT ON CONSTRAINT unique_user_matchup_admin_vote ON public.votes IS 
    'Allows users to have one regular vote and one admin tie-breaker vote per matchup';