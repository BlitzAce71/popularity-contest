-- Add participant performance function for tournament stats
-- This function returns round-by-round performance data for contestants in a tournament

-- ============================================================================
-- PARTICIPANT PERFORMANCE FUNCTION
-- ============================================================================

-- Function to get round-by-round performance data for participants in a tournament
CREATE OR REPLACE FUNCTION public.get_participant_performance(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    performance_data JSONB := '[]'::JSONB;
    contestant_record RECORD;
    round_record RECORD;
    matchup_record RECORD;
    contestant_data JSONB;
    rounds_data JSONB;
    round_data JSONB;
    blowout_data JSONB := '[]'::JSONB;
    round_blowout RECORD;
BEGIN
    -- Get all contestants in the tournament
    FOR contestant_record IN
        SELECT 
            id, 
            name, 
            seed, 
            wins, 
            losses, 
            votes_received, 
            eliminated_round,
            is_active
        FROM public.contestants
        WHERE tournament_id = tournament_uuid
        ORDER BY name
    LOOP
        rounds_data := '[]'::JSONB;
        
        -- Get all rounds this contestant participated in
        FOR round_record IN
            SELECT DISTINCT 
                r.id, 
                r.round_number, 
                r.name, 
                r.status
            FROM public.rounds r
            JOIN public.matchups m ON r.id = m.round_id
            WHERE r.tournament_id = tournament_uuid
            AND (m.contestant1_id = contestant_record.id OR m.contestant2_id = contestant_record.id)
            ORDER BY r.round_number
        LOOP
            -- Get matchup details for this contestant in this round
            SELECT 
                m.id as matchup_id,
                m.position,
                m.status,
                m.completed_at,
                m.total_votes,
                m.is_tie,
                CASE 
                    WHEN m.contestant1_id = contestant_record.id THEN c2.name
                    ELSE c1.name
                END as opponent_name,
                CASE 
                    WHEN m.contestant1_id = contestant_record.id THEN c2.id
                    ELSE c1.id
                END as opponent_id,
                CASE 
                    WHEN m.contestant1_id = contestant_record.id THEN m.contestant1_votes
                    ELSE m.contestant2_votes
                END as my_votes,
                CASE 
                    WHEN m.contestant1_id = contestant_record.id THEN m.contestant2_votes
                    ELSE m.contestant1_votes
                END as opponent_votes,
                CASE 
                    WHEN m.winner_id = contestant_record.id THEN 'WON'
                    WHEN m.winner_id IS NOT NULL THEN 'LOST'
                    WHEN m.is_tie THEN 'TIED'
                    ELSE 'PENDING'
                END as result
            INTO matchup_record
            FROM public.matchups m
            LEFT JOIN public.contestants c1 ON m.contestant1_id = c1.id
            LEFT JOIN public.contestants c2 ON m.contestant2_id = c2.id
            WHERE m.round_id = round_record.id
            AND (m.contestant1_id = contestant_record.id OR m.contestant2_id = contestant_record.id);
            
            -- Add round data to contestant
            round_data := jsonb_build_object(
                'round_number', round_record.round_number,
                'round_name', round_record.name,
                'round_status', round_record.status,
                'matchup_id', matchup_record.matchup_id,
                'opponent_name', matchup_record.opponent_name,
                'opponent_id', matchup_record.opponent_id,
                'my_votes', matchup_record.my_votes,
                'opponent_votes', matchup_record.opponent_votes,
                'total_votes', matchup_record.total_votes,
                'result', matchup_record.result,
                'is_tie', matchup_record.is_tie,
                'completed_at', matchup_record.completed_at
            );
            
            rounds_data := rounds_data || round_data;
        END LOOP;
        
        -- Build contestant performance data
        contestant_data := jsonb_build_object(
            'id', contestant_record.id,
            'name', contestant_record.name,
            'seed', contestant_record.seed,
            'total_wins', contestant_record.wins,
            'total_losses', contestant_record.losses,
            'total_votes_received', contestant_record.votes_received,
            'eliminated_round', contestant_record.eliminated_round,
            'is_active', contestant_record.is_active,
            'rounds', rounds_data
        );
        
        performance_data := performance_data || contestant_data;
    END LOOP;
    
    -- Calculate biggest blowouts per round
    FOR round_blowout IN
        SELECT 
            r.round_number,
            r.name as round_name,
            m.id as matchup_id,
            m.total_votes,
            ABS(m.contestant1_votes - m.contestant2_votes) as vote_margin,
            c1.name as contestant1_name,
            c2.name as contestant2_name,
            m.contestant1_votes,
            m.contestant2_votes,
            CASE 
                WHEN m.contestant1_votes > m.contestant2_votes THEN c1.name
                ELSE c2.name
            END as winner_name,
            CASE 
                WHEN m.contestant1_votes < m.contestant2_votes THEN c1.name
                ELSE c2.name
            END as loser_name
        FROM public.rounds r
        JOIN public.matchups m ON r.id = m.round_id
        LEFT JOIN public.contestants c1 ON m.contestant1_id = c1.id
        LEFT JOIN public.contestants c2 ON m.contestant2_id = c2.id
        WHERE r.tournament_id = tournament_uuid
        AND m.status = 'completed'
        AND m.total_votes > 0
        ORDER BY r.round_number, ABS(m.contestant1_votes - m.contestant2_votes) DESC
    LOOP
        -- Check if this is the biggest blowout for this round
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(blowout_data) as bd
            WHERE (bd->>'round_number')::INTEGER = round_blowout.round_number
        ) THEN
            blowout_data := blowout_data || jsonb_build_object(
                'round_number', round_blowout.round_number,
                'round_name', round_blowout.round_name,
                'matchup_id', round_blowout.matchup_id,
                'vote_margin', round_blowout.vote_margin,
                'total_votes', round_blowout.total_votes,
                'winner_name', round_blowout.winner_name,
                'loser_name', round_blowout.loser_name,
                'winner_votes', CASE 
                    WHEN round_blowout.contestant1_votes > round_blowout.contestant2_votes 
                    THEN round_blowout.contestant1_votes
                    ELSE round_blowout.contestant2_votes
                END,
                'loser_votes', CASE 
                    WHEN round_blowout.contestant1_votes < round_blowout.contestant2_votes 
                    THEN round_blowout.contestant1_votes
                    ELSE round_blowout.contestant2_votes
                END
            );
        END IF;
    END LOOP;
    
    -- Return final result with both participant data and blowout data
    RETURN jsonb_build_object(
        'participants', performance_data,
        'biggest_blowouts', blowout_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_participant_performance(UUID) IS 'Get round-by-round performance data for all participants in a tournament, including biggest blowouts per round';