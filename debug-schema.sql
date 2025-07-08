-- Debug query to check current tournament table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tournaments' 
AND table_schema = 'public'
ORDER BY ordinal_position;