-- =============================================================================
-- DEPLOY: Replace debug function with full bracket data functionality
-- =============================================================================

-- Drop the debug version and create the real function
DROP FUNCTION IF EXISTS public.get_bracket_data(UUID);

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    tournament_record RECORD;
    rounds_data JSON;
    matchups_data JSON;
BEGIN
    -- Get tournament info
    SELECT * INTO tournament_record
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Tournament not found');
    END IF;
    
    -- Get all rounds for this tournament
    SELECT json_agg(
        json_build_object(
            'id', r.id,
            'round_number', r.round_number,
            'name', r.name,
            'status', r.status,
            'total_matchups', r.total_matchups,
            'completed_matchups', r.completed_matchups
        ) ORDER BY r.round_number
    ) INTO rounds_data
    FROM public.rounds r
    WHERE r.tournament_id = tournament_uuid;
    
    -- Get all matchups with contestant details
    SELECT json_agg(
        json_build_object(
            'id', m.id,
            'round_id', m.round_id,
            'position', m.position,
            'status', m.status,
            'contestant1', CASE 
                WHEN m.contestant1_id IS NOT NULL THEN 
                    json_build_object(
                        'id', c1.id,
                        'name', c1.name,
                        'image_url', c1.image_url,
                        'seed', c1.seed
                    )
                ELSE NULL
            END,
            'contestant2', CASE 
                WHEN m.contestant2_id IS NOT NULL THEN 
                    json_build_object(
                        'id', c2.id,
                        'name', c2.name,
                        'image_url', c2.image_url,
                        'seed', c2.seed
                    )
                ELSE NULL
            END,
            'contestant1_votes', m.contestant1_votes,
            'contestant2_votes', m.contestant2_votes,
            'total_votes', m.total_votes,
            'winner_id', m.winner_id,
            'is_tie', m.is_tie
        ) ORDER BY m.position
    ) INTO matchups_data
    FROM public.matchups m
    LEFT JOIN public.contestants c1 ON m.contestant1_id = c1.id
    LEFT JOIN public.contestants c2 ON m.contestant2_id = c2.id
    WHERE m.tournament_id = tournament_uuid;
    
    -- Build final result
    SELECT json_build_object(
        'tournament', json_build_object(
            'id', tournament_record.id,
            'name', tournament_record.name,
            'description', tournament_record.description,
            'status', tournament_record.status,
            'tournament_type', tournament_record.tournament_type,
            'created_at', tournament_record.created_at
        ),
        'rounds', COALESCE(rounds_data, '[]'::json),
        'matchups', COALESCE(matchups_data, '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bracket_data(UUID) TO anon;

COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Get complete bracket data including rounds, matchups, and contestant details';