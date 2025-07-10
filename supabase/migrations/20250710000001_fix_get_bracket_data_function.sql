-- Fix get_bracket_data function to properly return vote history
-- This will preserve all existing vote data and make historical matchups show proper vote counts

CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '[]'::JSONB;
    round_record RECORD;
    matchup_data JSONB;
    round_data JSONB;
BEGIN
    -- Get all rounds for the tournament with their matchups and vote counts
    FOR round_record IN
        SELECT 
            r.id as round_id,
            r.round_number,
            r.name as round_name,
            r.status as round_status
        FROM public.rounds r
        WHERE r.tournament_id = tournament_uuid
        ORDER BY r.round_number
    LOOP
        -- Get matchups for this round with vote counts
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'position', m.position,
                    'contestant1_id', m.contestant1_id,
                    'contestant2_id', m.contestant2_id,
                    'winner_id', m.winner_id,
                    'status', m.status,
                    'voteCounts', jsonb_build_object(
                        'contestant1Votes', COALESCE(vr.contestant1_votes, 0),
                        'contestant2Votes', COALESCE(vr.contestant2_votes, 0),
                        'totalVotes', COALESCE(vr.total_votes, 0),
                        'contestant1_votes', COALESCE(vr.contestant1_votes, 0),
                        'contestant2_votes', COALESCE(vr.contestant2_votes, 0),
                        'total_votes', COALESCE(vr.total_votes, 0)
                    ),
                    'vote_counts', jsonb_build_object(
                        'contestant1Votes', COALESCE(vr.contestant1_votes, 0),
                        'contestant2Votes', COALESCE(vr.contestant2_votes, 0),
                        'totalVotes', COALESCE(vr.total_votes, 0),
                        'contestant1_votes', COALESCE(vr.contestant1_votes, 0),
                        'contestant2_votes', COALESCE(vr.contestant2_votes, 0),
                        'total_votes', COALESCE(vr.total_votes, 0)
                    ),
                    'canVote', CASE WHEN m.status = 'active' THEN true ELSE false END
                )
                ORDER BY m.position
            ),
            '[]'::JSONB
        ) INTO matchup_data
        FROM public.matchups m
        LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
        WHERE m.round_id = round_record.round_id;

        -- Build round object
        round_data := jsonb_build_object(
            'round_number', round_record.round_number,
            'round_name', round_record.round_name,
            'round_status', round_record.round_status,
            'matchups', matchup_data
        );

        -- Add round to result array
        result := result || jsonb_build_array(round_data);
    END LOOP;

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    -- Return empty array on error to prevent breaking the UI
    RETURN '[]'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Returns bracket data with vote history for a tournament - preserves all historical vote counts';