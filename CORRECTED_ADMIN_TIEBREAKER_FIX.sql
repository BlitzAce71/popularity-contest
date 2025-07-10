-- CORRECTED: Fix admin tie-breaker voting using a dedicated system user
-- Fixed to match actual database schema (users table has first_name/last_name, not name)

-- First, revert the constraint back to original (if it was changed)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_admin_vote;
ALTER TABLE public.votes ADD CONSTRAINT unique_user_matchup_vote 
    UNIQUE (user_id, matchup_id);

-- Create a system admin user for tie-breaker votes
INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'authenticated',
    'authenticated', 
    'system-admin@popularity-contest.internal',
    '',
    NOW(),
    NOW(),
    NOW(),
    '{"system_user": true, "name": "System Admin (Tie-breaker)"}',
    false
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding user profile (using correct column names)
INSERT INTO public.users (
    id,
    email,
    username,
    first_name,
    last_name,
    is_admin,
    created_at
) VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'system-admin@popularity-contest.internal', 
    'system-admin',
    'System Admin',
    '(Tie-breaker)',
    true,
    NOW()
) ON CONFLICT (id) DO NOTHING;