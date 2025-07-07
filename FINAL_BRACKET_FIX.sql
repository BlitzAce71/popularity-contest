-- =============================================================================
-- FINAL FIX: Replace get_bracket_data with minimal working version
-- =============================================================================

-- Drop and recreate with a minimal implementation that doesn't rely on unknown columns
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
    
    -- Return basic tournament data with rounds and matchups (without position column)
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
                                'status', m.status,
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
                        ) FROM public.matchups m WHERE m.round_id = r.id ORDER BY m.id),
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
COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Minimal get bracket data function without position column';