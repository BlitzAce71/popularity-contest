-- Test slug generation functionality
-- Run this to verify the triggers and functions are working properly

-- Test 1: Check if slug functions exist
SELECT 'generate_slug function exists' as test, 
       generate_slug('My Awesome Tournament Test') as result;

SELECT 'generate_unique_slug function exists' as test,
       generate_unique_slug('My Awesome Tournament Test') as result;

-- Test 2: Check existing tournaments have slugs
SELECT name, slug, id 
FROM tournaments 
ORDER BY created_at DESC 
LIMIT 5;

-- Test 3: Test inserting a new tournament manually to see if trigger works
INSERT INTO tournaments (name, description, created_by, max_contestants, bracket_type, is_public, status)
VALUES (
    'Test Tournament for Slugs', 
    'Testing slug generation', 
    (SELECT id FROM auth.users LIMIT 1), 
    16, 
    'single-elimination', 
    true, 
    'draft'
) RETURNING id, name, slug;

-- Clean up test tournament
DELETE FROM tournaments WHERE name = 'Test Tournament for Slugs';