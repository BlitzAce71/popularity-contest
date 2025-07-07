-- =============================================================================
-- URGENT FIX: Fix get_bracket_data GROUP BY clause error
-- =============================================================================
-- This fixes the immediate GROUP BY clause error that users are experiencing

-- Drop and recreate the function with proper column selection
DROP FUNCTION IF EXISTS public.get_bracket_data(UUID);

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    bracket_data JSONB := '{"rounds": []}'::JSONB;
    round_record RECORD;
    matchup_record RECORD;
    round_data JSONB;
    matchups_array JSONB := '[]'::JSONB;
BEGIN
    -- Get all rounds for tournament
    FOR round_record IN
        SELECT r.id, r.round_number, r.name, r.status, r.total_matchups, r.completed_matchups 
        FROM public.rounds r
        WHERE r.tournament_id = tournament_uuid
        ORDER BY r.round_number
    LOOP
        -- Reset matchups array for this round
        matchups_array := '[]'::JSONB;
        
        -- Get all matchups for this round with explicit column selection
        FOR matchup_record IN
            SELECT 
                m.id,
                m.position,
                m.status,
                m.contestant1_id,
                m.contestant2_id,
                m.winner_id,
                m.contestant1_votes,
                m.contestant2_votes,
                m.total_votes,
                m.is_tie,
                c1.name as contestant1_name,
                c1.image_url as contestant1_image,
                c2.name as contestant2_name,
                c2.image_url as contestant2_image,
                w.name as winner_name
            FROM public.matchups m
            LEFT JOIN public.contestants c1 ON m.contestant1_id = c1.id
            LEFT JOIN public.contestants c2 ON m.contestant2_id = c2.id
            LEFT JOIN public.contestants w ON m.winner_id = w.id
            WHERE m.round_id = round_record.id
            ORDER BY m.position
        LOOP
            -- Add matchup to array
            matchups_array := matchups_array || jsonb_build_object(
                'id', matchup_record.id,
                'position', matchup_record.position,
                'status', matchup_record.status,
                'contestant1', jsonb_build_object(
                    'id', matchup_record.contestant1_id,
                    'name', matchup_record.contestant1_name,
                    'image_url', matchup_record.contestant1_image,
                    'votes', matchup_record.contestant1_votes
                ),
                'contestant2', jsonb_build_object(
                    'id', matchup_record.contestant2_id,
                    'name', matchup_record.contestant2_name,
                    'image_url', matchup_record.contestant2_image,
                    'votes', matchup_record.contestant2_votes
                ),
                'winner', jsonb_build_object(
                    'id', matchup_record.winner_id,
                    'name', matchup_record.winner_name
                ),
                'total_votes', matchup_record.total_votes,
                'is_tie', matchup_record.is_tie
            );
        END LOOP;
        
        -- Add round data
        round_data := jsonb_build_object(
            'id', round_record.id,
            'round_number', round_record.round_number,
            'name', round_record.name,
            'status', round_record.status,
            'total_matchups', round_record.total_matchups,
            'completed_matchups', round_record.completed_matchups,
            'matchups', matchups_array
        );
        
        -- Add to bracket data
        bracket_data := jsonb_set(
            bracket_data,
            '{rounds}',
            (bracket_data->'rounds') || round_data
        );
    END LOOP;
    
    RETURN bracket_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO anon;

-- Add comment
COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Get bracket visualization data with explicit column selection to avoid GROUP BY issues';