-- Create database functions for tournament bracket generation and management
-- These functions handle tournament logic, bracket creation, and progression

-- ============================================================================
-- TOURNAMENT BRACKET GENERATION
-- ============================================================================

-- Function to generate tournament bracket for single elimination
CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    tournament_size INTEGER;
    contestant_count INTEGER;
    round_count INTEGER;
    current_round INTEGER;
    current_matchups INTEGER;
    round_id UUID;
    matchup_position INTEGER;
    contestant_record RECORD;
    contestants_array UUID[];
    i INTEGER;
BEGIN
    -- Get tournament info
    SELECT size INTO tournament_size
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Get actual contestant count
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Validate we have enough contestants
    IF contestant_count < 2 THEN
        RAISE EXCEPTION 'Need at least 2 contestants to generate bracket';
    END IF;
    
    -- Calculate number of rounds needed
    round_count := CEIL(LOG(2, tournament_size));
    
    -- Get contestants ordered by seed (or position if no seed)
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, position)) INTO contestants_array
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Generate rounds
    FOR current_round IN 1..round_count LOOP
        current_matchups := tournament_size / POWER(2, current_round);
        
        -- Create round
        INSERT INTO public.rounds (
            tournament_id,
            round_number,
            name,
            total_matchups,
            status
        ) VALUES (
            tournament_uuid,
            current_round,
            public.generate_round_name(tournament_size, current_round),
            current_matchups,
            CASE WHEN current_round = 1 THEN 'upcoming' ELSE 'upcoming' END
        ) RETURNING id INTO round_id;
        
        -- Create matchups for this round
        FOR matchup_position IN 1..current_matchups LOOP
            IF current_round = 1 THEN
                -- First round: assign contestants based on bracket seeding
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    position,
                    contestant1_id,
                    contestant2_id,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    CASE 
                        WHEN (matchup_position * 2 - 1) <= contestant_count 
                        THEN contestants_array[matchup_position * 2 - 1]
                        ELSE NULL
                    END,
                    CASE 
                        WHEN (matchup_position * 2) <= contestant_count 
                        THEN contestants_array[matchup_position * 2]
                        ELSE NULL
                    END,
                    'upcoming'
                );
            ELSE
                -- Later rounds: create empty matchups to be filled by winners
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    position,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    'upcoming'
                );
            END IF;
        END LOOP;
    END LOOP;
    
    -- Update tournament status
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    -- Activate first round
    UPDATE public.rounds
    SET status = 'active'
    WHERE tournament_id = tournament_uuid AND round_number = 1;
    
    -- Activate first round matchups that have both contestants
    UPDATE public.matchups
    SET status = 'active'
    WHERE round_id = (
        SELECT id FROM public.rounds
        WHERE tournament_id = tournament_uuid AND round_number = 1
    )
    AND contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to advance tournament to next round
CREATE OR REPLACE FUNCTION public.advance_to_next_round(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_round_id UUID;
    current_round_number INTEGER;
    next_round_id UUID;
    all_matchups_completed BOOLEAN;
BEGIN
    -- Find current active round
    SELECT id, round_number INTO current_round_id, current_round_number
    FROM public.rounds
    WHERE tournament_id = tournament_uuid AND status = 'active'
    ORDER BY round_number DESC
    LIMIT 1;
    
    IF current_round_id IS NULL THEN
        RETURN FALSE; -- No active round found
    END IF;
    
    -- Check if all matchups in current round are completed
    SELECT NOT EXISTS (
        SELECT 1 FROM public.matchups
        WHERE round_id = current_round_id AND status != 'completed'
    ) INTO all_matchups_completed;
    
    IF NOT all_matchups_completed THEN
        RETURN FALSE; -- Not all matchups completed
    END IF;
    
    -- Mark current round as completed
    UPDATE public.rounds
    SET status = 'completed'
    WHERE id = current_round_id;
    
    -- Find next round
    SELECT id INTO next_round_id
    FROM public.rounds
    WHERE tournament_id = tournament_uuid AND round_number = current_round_number + 1;
    
    IF next_round_id IS NOT NULL THEN
        -- Activate next round
        UPDATE public.rounds
        SET status = 'active'
        WHERE id = next_round_id;
        
        -- Activate next round matchups that have both contestants
        UPDATE public.matchups
        SET status = 'active'
        WHERE round_id = next_round_id
        AND contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL;
        
        RETURN TRUE;
    ELSE
        -- Tournament completed
        UPDATE public.tournaments
        SET status = 'completed'
        WHERE id = tournament_uuid;
        
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VOTE COUNTING AND WINNER DETERMINATION
-- ============================================================================

-- Function to count votes for a matchup
CREATE OR REPLACE FUNCTION public.count_matchup_votes(matchup_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    contestant1_id UUID;
    contestant2_id UUID;
    contestant1_votes INTEGER := 0;
    contestant2_votes INTEGER := 0;
    total_votes INTEGER := 0;
    winner_id UUID := NULL;
    is_tie BOOLEAN := FALSE;
    result JSONB;
BEGIN
    -- Get contestants for this matchup
    SELECT m.contestant1_id, m.contestant2_id
    INTO contestant1_id, contestant2_id
    FROM public.matchups m
    WHERE m.id = matchup_uuid;
    
    IF contestant1_id IS NULL OR contestant2_id IS NULL THEN
        RAISE EXCEPTION 'Matchup does not have both contestants assigned';
    END IF;
    
    -- Count votes with weights
    SELECT 
        COALESCE(SUM(CASE WHEN selected_contestant_id = contestant1_id THEN weight ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN selected_contestant_id = contestant2_id THEN weight ELSE 0 END), 0),
        COALESCE(SUM(weight), 0)
    INTO contestant1_votes, contestant2_votes, total_votes
    FROM public.votes
    WHERE matchup_id = matchup_uuid;
    
    -- Determine winner
    IF contestant1_votes > contestant2_votes THEN
        winner_id := contestant1_id;
        is_tie := FALSE;
    ELSIF contestant2_votes > contestant1_votes THEN
        winner_id := contestant2_id;
        is_tie := FALSE;
    ELSE
        winner_id := NULL;
        is_tie := (total_votes > 0);
    END IF;
    
    -- Build result JSON
    result := jsonb_build_object(
        'matchup_id', matchup_uuid,
        'contestant1_id', contestant1_id,
        'contestant2_id', contestant2_id,
        'contestant1_votes', contestant1_votes,
        'contestant2_votes', contestant2_votes,
        'total_votes', total_votes,
        'winner_id', winner_id,
        'is_tie', is_tie
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize matchup results
CREATE OR REPLACE FUNCTION public.finalize_matchup(matchup_uuid UUID)
RETURNS VOID AS $$
DECLARE
    vote_count_result JSONB;
    tournament_allows_ties BOOLEAN;
    tournament_id UUID;
BEGIN
    -- Get vote counts
    vote_count_result := public.count_matchup_votes(matchup_uuid);
    
    -- Get tournament settings
    SELECT m.tournament_id, t.allow_ties
    INTO tournament_id, tournament_allows_ties
    FROM public.matchups m
    JOIN public.tournaments t ON m.tournament_id = t.id
    WHERE m.id = matchup_uuid;
    
    -- Handle ties based on tournament settings
    IF (vote_count_result->>'is_tie')::BOOLEAN AND NOT tournament_allows_ties THEN
        -- Implement tie-breaking logic (e.g., admin decision, coin flip, etc.)
        -- For now, we'll leave it as a tie and require manual resolution
        NULL;
    END IF;
    
    -- Update matchup with final results
    UPDATE public.matchups
    SET 
        contestant1_votes = (vote_count_result->>'contestant1_votes')::INTEGER,
        contestant2_votes = (vote_count_result->>'contestant2_votes')::INTEGER,
        total_votes = (vote_count_result->>'total_votes')::INTEGER,
        winner_id = CASE 
            WHEN vote_count_result->>'winner_id' = 'null' THEN NULL
            ELSE (vote_count_result->>'winner_id')::UUID
        END,
        is_tie = (vote_count_result->>'is_tie')::BOOLEAN,
        status = 'completed'
    WHERE id = matchup_uuid;
    
    -- Try to advance tournament if this was the last matchup in a round
    PERFORM public.advance_to_next_round(tournament_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TOURNAMENT MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to reset tournament bracket
CREATE OR REPLACE FUNCTION public.reset_tournament_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Can only reset if tournament is not completed
    IF EXISTS (
        SELECT 1 FROM public.tournaments
        WHERE id = tournament_uuid AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Cannot reset completed tournament';
    END IF;
    
    -- Delete all votes
    DELETE FROM public.votes v
    USING public.matchups m
    WHERE v.matchup_id = m.id AND m.tournament_id = tournament_uuid;
    
    -- Delete all vote results
    DELETE FROM public.vote_results vr
    USING public.matchups m
    WHERE vr.matchup_id = m.id AND m.tournament_id = tournament_uuid;
    
    -- Delete all matchups
    DELETE FROM public.matchups
    WHERE tournament_id = tournament_uuid;
    
    -- Delete all rounds
    DELETE FROM public.rounds
    WHERE tournament_id = tournament_uuid;
    
    -- Reset tournament status
    UPDATE public.tournaments
    SET status = 'registration'
    WHERE id = tournament_uuid;
    
    -- Reset contestant stats
    UPDATE public.contestants
    SET 
        votes_received = 0,
        wins = 0,
        losses = 0,
        eliminated_round = NULL,
        is_active = TRUE
    WHERE tournament_id = tournament_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tournament statistics
CREATE OR REPLACE FUNCTION public.get_tournament_stats(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_votes INTEGER;
    total_matchups INTEGER;
    completed_matchups INTEGER;
    active_matchups INTEGER;
    total_participants INTEGER;
    most_voted_match UUID;
    top_contestant UUID;
BEGIN
    -- Calculate statistics
    SELECT 
        COALESCE(SUM(m.total_votes), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE m.status = 'completed'),
        COUNT(*) FILTER (WHERE m.status = 'active')
    INTO total_votes, total_matchups, completed_matchups, active_matchups
    FROM public.matchups m
    WHERE m.tournament_id = tournament_uuid;
    
    -- Get total participants
    SELECT COUNT(*) INTO total_participants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Find most voted match
    SELECT id INTO most_voted_match
    FROM public.matchups
    WHERE tournament_id = tournament_uuid
    ORDER BY total_votes DESC
    LIMIT 1;
    
    -- Find top contestant by votes
    SELECT id INTO top_contestant
    FROM public.contestants
    WHERE tournament_id = tournament_uuid
    ORDER BY votes_received DESC
    LIMIT 1;
    
    -- Build stats JSON
    stats := jsonb_build_object(
        'tournament_id', tournament_uuid,
        'total_votes', total_votes,
        'total_matchups', total_matchups,
        'completed_matchups', completed_matchups,
        'active_matchups', active_matchups,
        'total_participants', total_participants,
        'most_voted_match_id', most_voted_match,
        'top_contestant_id', top_contestant,
        'completion_percentage', 
            CASE 
                WHEN total_matchups > 0 
                THEN ROUND((completed_matchups::FLOAT / total_matchups * 100), 2)
                ELSE 0
            END
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to validate tournament can start
CREATE OR REPLACE FUNCTION public.can_start_tournament(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    contestant_count INTEGER;
    tournament_status tournament_status;
    min_contestants INTEGER := 2;
BEGIN
    -- Get tournament info
    SELECT status INTO tournament_status
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    -- Check status
    IF tournament_status NOT IN ('draft', 'registration') THEN
        RETURN FALSE;
    END IF;
    
    -- Count active contestants
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Need at least minimum contestants
    RETURN contestant_count >= min_contestants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bracket visualization data
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

-- Comments for documentation
COMMENT ON FUNCTION public.generate_single_elimination_bracket(UUID) IS 'Generate complete single elimination tournament bracket';
COMMENT ON FUNCTION public.advance_to_next_round(UUID) IS 'Advance tournament to next round when current round is complete';
COMMENT ON FUNCTION public.count_matchup_votes(UUID) IS 'Count and return vote totals for a matchup';
COMMENT ON FUNCTION public.finalize_matchup(UUID) IS 'Finalize matchup results and advance tournament if needed';
COMMENT ON FUNCTION public.reset_tournament_bracket(UUID) IS 'Reset tournament bracket and delete all votes/results';
COMMENT ON FUNCTION public.get_tournament_stats(UUID) IS 'Get comprehensive tournament statistics';
COMMENT ON FUNCTION public.can_start_tournament(UUID) IS 'Check if tournament has minimum requirements to start';
COMMENT ON FUNCTION public.get_bracket_data(UUID) IS 'Get complete bracket visualization data for frontend';