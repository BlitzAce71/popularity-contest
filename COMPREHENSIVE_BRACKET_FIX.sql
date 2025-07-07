-- =============================================================================
-- COMPREHENSIVE FIX: Handle matchups table with or without position column
-- =============================================================================

-- First, let's check if the position column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'position'
        AND table_schema = 'public'
    ) THEN
        -- Add position column if it doesn't exist
        ALTER TABLE public.matchups ADD COLUMN position INTEGER DEFAULT 1;
        
        -- Update existing matchups to have sequential positions within their rounds
        UPDATE public.matchups 
        SET position = sub.row_num
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY round_id ORDER BY created_at) as row_num
            FROM public.matchups
        ) sub
        WHERE matchups.id = sub.id;
        
        -- Make position NOT NULL and add constraint
        ALTER TABLE public.matchups ALTER COLUMN position SET NOT NULL;
        ALTER TABLE public.matchups ADD CONSTRAINT matchups_position_check CHECK (position >= 1);
        
        RAISE NOTICE 'Added position column to matchups table';
    ELSE
        RAISE NOTICE 'Position column already exists in matchups table';
    END IF;
END $$;

-- Now create the get_bracket_data function
DROP FUNCTION IF EXISTS public.get_bracket_data(UUID);

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
    
    -- Return basic tournament data with rounds and matchups
    SELECT json_build_object(
        'tournament', row_to_json(tournament_record),
        'rounds', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', r.id,
                    'round_number', r.round_number,
                    'name', r.name,
                    'status', r.status,
                    'total_matchups', COALESCE(r.total_matchups, 0),
                    'completed_matchups', COALESCE(r.completed_matchups, 0),
                    'matchups', COALESCE(
                        (SELECT json_agg(
                            json_build_object(
                                'id', m.id,
                                'status', m.status,
                                'position', COALESCE(m.position, 1),
                                'contestant1_id', m.contestant1_id,
                                'contestant2_id', m.contestant2_id,
                                'winner_id', m.winner_id,
                                'vote_counts', json_build_object(
                                    'contestant1_votes', COALESCE(m.contestant1_votes, 0),
                                    'contestant2_votes', COALESCE(m.contestant2_votes, 0),
                                    'total_votes', COALESCE(m.total_votes, 0)
                                ),
                                'is_tie', COALESCE(m.is_tie, false)
                            )
                        ) FROM public.matchups m WHERE m.round_id = r.id ORDER BY COALESCE(m.position, 1), m.created_at),
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
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO anon;

-- Add comment
COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Get bracket data with position column handling';