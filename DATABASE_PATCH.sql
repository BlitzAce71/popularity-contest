-- =============================================================================
-- DATABASE PATCH: Fix Missing Functions and Issues
-- =============================================================================
-- This patch addresses missing RPC functions and other database issues
-- Run this after the main COMPLETE_MIGRATION.sql

-- =============================================================================
-- FIX 1: Add missing get_tournament_stats function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_tournament_stats(tournament_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    tournament_record RECORD;
    total_contestants INTEGER;
    total_matches INTEGER;
    completed_matches INTEGER;
    total_votes INTEGER;
    most_voted_match_id UUID;
    most_voted_match_votes INTEGER;
BEGIN
    -- Get tournament basic info
    SELECT * INTO tournament_record
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found: %', tournament_uuid;
    END IF;
    
    -- Count contestants
    SELECT COUNT(*) INTO total_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Count matches
    SELECT COUNT(*) INTO total_matches
    FROM public.matchups
    WHERE tournament_id = tournament_uuid;
    
    -- Count completed matches
    SELECT COUNT(*) INTO completed_matches
    FROM public.matchups
    WHERE tournament_id = tournament_uuid AND status = 'completed';
    
    -- Count total votes
    SELECT COUNT(*) INTO total_votes
    FROM public.votes v
    JOIN public.matchups m ON v.matchup_id = m.id
    WHERE m.tournament_id = tournament_uuid;
    
    -- Find most voted match
    SELECT m.id, COUNT(v.id) INTO most_voted_match_id, most_voted_match_votes
    FROM public.matchups m
    LEFT JOIN public.votes v ON v.matchup_id = m.id
    WHERE m.tournament_id = tournament_uuid
    GROUP BY m.id
    ORDER BY COUNT(v.id) DESC
    LIMIT 1;
    
    -- Build result JSON
    result := json_build_object(
        'tournament_id', tournament_uuid,
        'name', tournament_record.name,
        'status', tournament_record.status,
        'total_contestants', total_contestants,
        'total_matches', total_matches,
        'completed_matches', completed_matches,
        'completion_percentage', 
            CASE 
                WHEN total_matches > 0 THEN (completed_matches::FLOAT / total_matches::FLOAT * 100)::INTEGER
                ELSE 0 
            END,
        'total_votes', total_votes,
        'most_voted_match_id', most_voted_match_id,
        'most_voted_match_votes', COALESCE(most_voted_match_votes, 0),
        'average_votes_per_match',
            CASE 
                WHEN total_matches > 0 THEN (total_votes::FLOAT / total_matches::FLOAT)::NUMERIC(10,2)
                ELSE 0 
            END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tournament_stats(UUID) TO authenticated;

-- =============================================================================
-- FIX 2: Add missing get_bracket_data function (referenced in tournaments service)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    tournament_record RECORD;
BEGIN
    -- Get tournament basic info
    SELECT * INTO tournament_record
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found: %', tournament_uuid;
    END IF;
    
    -- For now, return basic tournament data with rounds and matchups
    -- This can be expanded for full bracket visualization
    SELECT json_build_object(
        'tournament', row_to_json(tournament_record),
        'rounds', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'round_number', r.round_number,
                    'name', r.name,
                    'status', r.status,
                    'matchups', COALESCE(
                        (SELECT json_agg(
                            json_build_object(
                                'id', m.id,
                                'position', m.position,
                                'status', m.status,
                                'contestant1_id', m.contestant1_id,
                                'contestant2_id', m.contestant2_id,
                                'winner_id', m.winner_id,
                                'vote_counts', json_build_object(
                                    'contestant1_votes', m.contestant1_votes,
                                    'contestant2_votes', m.contestant2_votes,
                                    'total_votes', m.total_votes
                                )
                            )
                        ) FROM public.matchups m WHERE m.round_id = r.id ORDER BY m.position),
                        '[]'::json
                    )
                )
            ) FROM public.rounds r WHERE r.tournament_id = tournament_uuid ORDER BY r.round_number),
            '[]'::json
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO authenticated;

-- =============================================================================
-- FIX 3: Ensure proper RLS policies for contestants table
-- =============================================================================

-- Check if RLS is enabled (should already be enabled from main migration)
-- But let's make sure the policies are correct

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Anyone can view contestants for public tournaments" ON public.contestants;
DROP POLICY IF EXISTS "Tournament creators can manage contestants" ON public.contestants;
DROP POLICY IF EXISTS "Admins can manage all contestants" ON public.contestants;

-- Recreate with correct permissions
CREATE POLICY "Anyone can view contestants for public tournaments" ON public.contestants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = contestants.tournament_id 
            AND t.is_public = true
        )
    );

CREATE POLICY "Tournament creators can manage contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = contestants.tournament_id 
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all contestants" ON public.contestants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.is_admin = true
        )
    );

-- =============================================================================
-- FIX 4: Add can_start_tournament function (referenced in tournaments service)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_start_tournament(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_record RECORD;
    contestant_count INTEGER;
BEGIN
    -- Get tournament
    SELECT * INTO tournament_record
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if tournament is in draft or registration status
    IF tournament_record.status NOT IN ('draft', 'registration') THEN
        RETURN false;
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Must have at least 2 contestants
    RETURN contestant_count >= 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_start_tournament(UUID) TO authenticated;

-- =============================================================================
-- FIX 5: Add any other missing functions that might be referenced
-- =============================================================================

-- Generate single elimination bracket function
CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_record RECORD;
    contestant_count INTEGER;
    contestants_cursor CURSOR FOR 
        SELECT * FROM public.contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true 
        ORDER BY seed;
    round_id UUID;
BEGIN
    -- Get tournament
    SELECT * INTO tournament_record
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found: %', tournament_uuid;
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    IF contestant_count < 2 THEN
        RAISE EXCEPTION 'Tournament must have at least 2 contestants';
    END IF;
    
    -- Create first round
    INSERT INTO public.rounds (tournament_id, round_number, name, status)
    VALUES (tournament_uuid, 1, 'Round 1', 'upcoming')
    RETURNING id INTO round_id;
    
    -- TODO: Implement full bracket generation logic
    -- For now, just mark tournament as active
    UPDATE public.tournaments 
    SET status = 'active' 
    WHERE id = tournament_uuid;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_single_elimination_bracket(UUID) TO authenticated;

-- =============================================================================
-- FIX 6: Add quadrant field to contestants table
-- =============================================================================

-- Add quadrant column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contestants' 
        AND column_name = 'quadrant'
    ) THEN
        ALTER TABLE public.contestants ADD COLUMN quadrant INTEGER DEFAULT 1 CHECK (quadrant IN (1, 2, 3, 4));
        
        -- Update existing contestants to have quadrant 1 as default
        UPDATE public.contestants SET quadrant = 1 WHERE quadrant IS NULL;
        
        -- Make quadrant NOT NULL
        ALTER TABLE public.contestants ALTER COLUMN quadrant SET NOT NULL;
        
        RAISE NOTICE 'Added quadrant column to contestants table';
    ELSE
        RAISE NOTICE 'Quadrant column already exists in contestants table';
    END IF;
END $$;

-- =============================================================================
-- FIX 7: Add quadrant_names field to tournaments table
-- =============================================================================

-- Add quadrant_names column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournaments' 
        AND column_name = 'quadrant_names'
    ) THEN
        ALTER TABLE public.tournaments ADD COLUMN quadrant_names TEXT[];
        
        -- Set default quadrant names for existing tournaments
        UPDATE public.tournaments 
        SET quadrant_names = ARRAY['Region A', 'Region B', 'Region C', 'Region D'] 
        WHERE quadrant_names IS NULL;
        
        RAISE NOTICE 'Added quadrant_names column to tournaments table';
    ELSE
        RAISE NOTICE 'Quadrant_names column already exists in tournaments table';
    END IF;
END $$;

-- =============================================================================
-- FIX 8: Add unique constraint for (tournament_id, quadrant, seed)
-- =============================================================================

-- Add unique constraint to prevent duplicate seeds within the same quadrant
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'contestants_tournament_quadrant_seed_unique'
    ) THEN
        ALTER TABLE public.contestants 
        ADD CONSTRAINT contestants_tournament_quadrant_seed_unique 
        UNIQUE (tournament_id, quadrant, seed);
        
        RAISE NOTICE 'Added unique constraint for tournament_id, quadrant, seed';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Note: Unique constraint may conflict with existing data. Clean up duplicates first if needed.';
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify functions were created
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_tournament_stats', 
    'get_bracket_data', 
    'can_start_tournament', 
    'generate_single_elimination_bracket'
)
ORDER BY routine_name;

-- Verify quadrant column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contestants' 
AND column_name = 'quadrant';

-- Verify quadrant_names column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tournaments' 
AND column_name = 'quadrant_names';