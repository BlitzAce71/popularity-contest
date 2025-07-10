-- Fix admin tie-breaker voting by cleaning duplicates and using system user
-- This handles existing duplicate votes before applying constraints

-- Step 1: Remove duplicate votes (keep the most recent one for each user/matchup pair)
WITH duplicate_votes AS (
    SELECT 
        id,
        user_id,
        matchup_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, matchup_id 
            ORDER BY created_at DESC, is_admin_vote DESC
        ) as rn
    FROM public.votes
),
votes_to_delete AS (
    SELECT id 
    FROM duplicate_votes 
    WHERE rn > 1
)
DELETE FROM public.votes 
WHERE id IN (SELECT id FROM votes_to_delete);

-- Step 2: Now safely drop and recreate the constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_admin_vote;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_vote;

-- Add the original constraint back
ALTER TABLE public.votes ADD CONSTRAINT unique_user_matchup_vote 
    UNIQUE (user_id, matchup_id);

-- Step 3: Create a system admin user for tie-breaker votes
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

-- Step 4: Create corresponding user profile
INSERT INTO public.users (
    id,
    email,
    name,
    role,
    created_at
) VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'system-admin@popularity-contest.internal', 
    'System Admin (Tie-breaker)',
    'admin',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 5: Show what we cleaned up (optional - for verification)
SELECT 'Cleanup completed. System admin user created for tie-breaker votes.' as result;