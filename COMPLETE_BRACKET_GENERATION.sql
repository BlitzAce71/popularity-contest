-- =============================================================================
-- COMPLETE BRACKET GENERATION: Implement proper tournament bracket creation
-- =============================================================================

-- First, let's create a proper bracket generation function
DROP FUNCTION IF EXISTS public.generate_single_elimination_bracket(UUID);

CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_record RECORD;
    contestant_count INTEGER;
    contestant_record RECORD;
    round_id UUID;
    matchup_count INTEGER;
    position_counter INTEGER := 1;
    contestants_array UUID[];
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
    
    -- Clear any existing rounds/matchups for this tournament
    DELETE FROM public.matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM public.rounds WHERE tournament_id = tournament_uuid;
    
    -- Get all contestants ordered by seed
    SELECT array_agg(id ORDER BY seed) INTO contestants_array
    FROM public.contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Calculate number of matchups needed (power of 2, rounded up)
    matchup_count := POWER(2, CEIL(LOG(2, contestant_count)))::INTEGER / 2;
    
    -- Create first round
    INSERT INTO public.rounds (tournament_id, round_number, name, status, total_matchups, completed_matchups)
    VALUES (tournament_uuid, 1, 'Round 1', 'active', matchup_count, 0)
    RETURNING id INTO round_id;
    
    -- Create matchups for first round
    FOR i IN 1..matchup_count LOOP
        DECLARE
            contestant1_id UUID := NULL;
            contestant2_id UUID := NULL;
        BEGIN
        
        -- Assign contestants to matchups (standard tournament seeding)
        IF (i * 2 - 1) <= contestant_count THEN
            contestant1_id := contestants_array[i * 2 - 1];
        END IF;
        
        IF (i * 2) <= contestant_count THEN
            contestant2_id := contestants_array[i * 2];
        END IF;
        
        -- Create the matchup
        INSERT INTO public.matchups (
            round_id, 
            tournament_id, 
            position, 
            contestant1_id, 
            contestant2_id, 
            status,
            contestant1_votes,
            contestant2_votes,
            total_votes,
            is_tie
        ) VALUES (
            round_id, 
            tournament_uuid, 
            i, 
            contestant1_id, 
            contestant2_id, 
            CASE 
                WHEN contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL THEN 'active'
                ELSE 'completed' -- Bye rounds are automatically completed
            END,
            0,
            0,
            0,
            false
        );
        
        -- If only one contestant (bye), automatically advance them
        IF contestant1_id IS NOT NULL AND contestant2_id IS NULL THEN
            UPDATE public.matchups 
            SET winner_id = contestant1_id, status = 'completed'
            WHERE round_id = round_id AND position = i;
        END IF;
        END;
    END LOOP;
    
    -- Update tournament status to active
    UPDATE public.tournaments 
    SET status = 'active' 
    WHERE id = tournament_uuid;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_single_elimination_bracket(UUID) TO authenticated;

-- Create helper function to advance rounds
CREATE OR REPLACE FUNCTION public.advance_tournament_round(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_round_record RECORD;
    next_round_id UUID;
    completed_matchups INTEGER;
    total_matchups INTEGER;
    winners_array UUID[];
    new_matchup_count INTEGER;
BEGIN
    -- Get current active round
    SELECT * INTO current_round_record
    FROM public.rounds
    WHERE tournament_id = tournament_uuid AND status = 'active'
    ORDER BY round_number DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN false; -- No active round
    END IF;
    
    -- Check if current round is complete
    SELECT COUNT(*) INTO completed_matchups
    FROM public.matchups
    WHERE round_id = current_round_record.id AND status = 'completed';
    
    SELECT COUNT(*) INTO total_matchups
    FROM public.matchups
    WHERE round_id = current_round_record.id;
    
    IF completed_matchups < total_matchups THEN
        RETURN false; -- Round not complete yet
    END IF;
    
    -- Get winners from current round
    SELECT array_agg(winner_id) INTO winners_array
    FROM public.matchups
    WHERE round_id = current_round_record.id AND winner_id IS NOT NULL
    ORDER BY position;
    
    -- If only one winner, tournament is complete
    IF array_length(winners_array, 1) <= 1 THEN
        UPDATE public.tournaments 
        SET status = 'completed' 
        WHERE id = tournament_uuid;
        
        UPDATE public.rounds 
        SET status = 'completed' 
        WHERE id = current_round_record.id;
        
        RETURN true;
    END IF;
    
    -- Create next round
    new_matchup_count := array_length(winners_array, 1) / 2;
    
    INSERT INTO public.rounds (tournament_id, round_number, name, status, total_matchups, completed_matchups)
    VALUES (tournament_uuid, current_round_record.round_number + 1, 
            'Round ' || (current_round_record.round_number + 1)::TEXT, 
            'active', new_matchup_count, 0)
    RETURNING id INTO next_round_id;
    
    -- Create matchups for next round
    FOR i IN 1..new_matchup_count LOOP
        INSERT INTO public.matchups (
            round_id, 
            tournament_id, 
            position, 
            contestant1_id, 
            contestant2_id, 
            status,
            contestant1_votes,
            contestant2_votes,
            total_votes,
            is_tie
        ) VALUES (
            next_round_id, 
            tournament_uuid, 
            i, 
            winners_array[i * 2 - 1], 
            winners_array[i * 2], 
            'active',
            0,
            0,
            0,
            false
        );
    END LOOP;
    
    -- Mark previous round as completed
    UPDATE public.rounds 
    SET status = 'completed' 
    WHERE id = current_round_record.id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.advance_tournament_round(UUID) TO authenticated;

COMMENT ON FUNCTION public.generate_single_elimination_bracket(UUID) IS 'Generate complete single elimination tournament bracket with proper matchups';
COMMENT ON FUNCTION public.advance_tournament_round(UUID) IS 'Advance tournament to next round when current round is complete';