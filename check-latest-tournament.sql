-- Check the most recently created tournament to see if it has a slug
SELECT id, name, slug, created_at 
FROM tournaments 
WHERE name = 'test this'
ORDER BY created_at DESC 
LIMIT 1;