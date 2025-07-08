-- GET COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor to see the actual structure of all tables

-- Get complete schema information for all tables
SELECT 
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    c.udt_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND t.table_name IN (
    'contestants', 
    'matchups', 
    'results', 
    'rounds', 
    'tournaments', 
    'users', 
    'vote_drafts', 
    'vote_results', 
    'votes'
)
ORDER BY 
    t.table_name, 
    c.ordinal_position;

-- Also get constraint information
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name IN (
    'contestants', 
    'matchups', 
    'results', 
    'rounds', 
    'tournaments', 
    'users', 
    'vote_drafts', 
    'vote_results', 
    'votes'
)
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Get index information
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN (
    'contestants', 
    'matchups', 
    'results', 
    'rounds', 
    'tournaments', 
    'users', 
    'vote_drafts', 
    'vote_results', 
    'votes'
)
ORDER BY tablename, indexname;