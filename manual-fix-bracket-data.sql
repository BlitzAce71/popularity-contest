-- Manual fix for get_bracket_data function
-- This can be run directly in Supabase SQL editor

-- Drop the old function
DROP FUNCTION IF EXISTS public.get_bracket_data(UUID);

-- Create updated get_bracket_data function
CREATE OR REPLACE FUNCTION public.get_bracket_data(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    tournament_data JSONB;
    rounds_array JSONB := '[]'::JSONB;
    matchups_array JSONB := '[]'::JSONB;
    round_record RECORD;
    matchup_record RECORD;
    round_matchups JSONB;
    total_matchups_count INTEGER;
    completed_matchups_count INTEGER;
BEGIN
    -- Get tournament data
    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'status', status,
        'bracket_type', bracket_type,
        'max_contestants', max_contestants,
        'created_at', created_at
    ) INTO tournament_data
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Get all rounds for tournament
    FOR round_record IN
        SELECT r.id, r.round_number, r.name, r.status, r.created_at
        FROM public.rounds r
        WHERE r.tournament_id = tournament_uuid
        ORDER BY r.round_number
    LOOP
        -- Reset matchups for this round
        round_matchups := '[]'::JSONB;
        
        -- Count total and completed matchups for this round
        SELECT COUNT(*) INTO total_matchups_count
        FROM public.matchups m
        WHERE m.round_id = round_record.id;
        
        SELECT COUNT(*) INTO completed_matchups_count
        FROM public.matchups m
        WHERE m.round_id = round_record.id AND m.status = 'completed';
        
        -- Get all matchups for this round
        FOR matchup_record IN
            SELECT 
                m.id,
                COALESCE(m.position, m.match_number) as position,
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
            ORDER BY COALESCE(m.position, m.match_number)
        LOOP
            -- Build matchup object
            DECLARE
                matchup_obj JSONB;
            BEGIN
                matchup_obj := jsonb_build_object(
                    'id', matchup_record.id,
                    'position', matchup_record.position,
                    'status', matchup_record.status,
                    'contestant1', CASE 
                        WHEN matchup_record.contestant1_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', matchup_record.contestant1_id,
                                'name', matchup_record.contestant1_name,
                                'image_url', matchup_record.contestant1_image
                            )
                        ELSE NULL
                    END,
                    'contestant2', CASE 
                        WHEN matchup_record.contestant2_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', matchup_record.contestant2_id,
                                'name', matchup_record.contestant2_name,
                                'image_url', matchup_record.contestant2_image
                            )
                        ELSE NULL
                    END,
                    'winner', CASE 
                        WHEN matchup_record.winner_id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', matchup_record.winner_id,
                                'name', matchup_record.winner_name
                            )
                        ELSE NULL
                    END,
                    'voteCounts', jsonb_build_object(
                        'contestant1Votes', matchup_record.contestant1_votes,
                        'contestant2Votes', matchup_record.contestant2_votes,
                        'totalVotes', matchup_record.total_votes
                    ),
                    'is_tie', matchup_record.is_tie
                );
                
                -- Add to round matchups
                round_matchups := round_matchups || matchup_obj;
                -- Add to all matchups with round_id
                matchups_array := matchups_array || (matchup_obj || jsonb_build_object('round_id', round_record.id));
            END;
        END LOOP;
        
        -- Build round data
        rounds_array := rounds_array || jsonb_build_object(
            'id', round_record.id,
            'round_number', round_record.round_number,
            'name', round_record.name,
            'status', round_record.status,
            'total_matchups', total_matchups_count,
            'completed_matchups', completed_matchups_count,
            'matchups', round_matchups,
            'created_at', round_record.created_at
        );
    END LOOP;
    
    -- Build final result
    result := jsonb_build_object(
        'tournament', tournament_data,
        'rounds', rounds_array,
        'matchups', matchups_array
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;