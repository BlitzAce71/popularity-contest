-- Debug tournament creation and slug generation
-- Let's see what's actually happening when tournaments are created

-- 1. Check if our functions exist and work
SELECT 'Testing generate_slug function:' as test;
SELECT generate_slug('My Test Tournament Name') as generated_slug;

SELECT 'Testing generate_unique_slug function:' as test;
SELECT generate_unique_slug('My Test Tournament Name') as unique_slug;

-- 2. Check current tournaments and their slugs
SELECT 'Current tournaments with slugs:' as test;
SELECT id, name, slug, created_at 
FROM tournaments 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check if trigger exists
SELECT 'Checking if trigger exists:' as test;
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'tournament_slug_trigger';

-- 4. Test manual insert to see if trigger fires
SELECT 'Testing manual insert:' as test;
INSERT INTO tournaments (name, description, max_contestants, bracket_type, is_public, status, created_by)
VALUES (
    'Debug Test Tournament', 
    'Testing slug generation manually', 
    16, 
    'single-elimination', 
    true, 
    'draft',
    (SELECT id FROM auth.users LIMIT 1)
) 
RETURNING id, name, slug, created_at;

-- Check what we just inserted
SELECT 'Result of manual insert:' as test;
SELECT id, name, slug 
FROM tournaments 
WHERE name = 'Debug Test Tournament';

-- Clean up
DELETE FROM tournaments WHERE name = 'Debug Test Tournament';