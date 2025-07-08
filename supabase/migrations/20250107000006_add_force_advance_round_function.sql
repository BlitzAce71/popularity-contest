-- Add function to force advance tournament round by declaring winners for all active matchups
-- This function will determine winners based on current vote leaders and advance to next round

CREATE OR REPLACE FUNCTION public.force_advance_round(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    current_round_id UUID;
    current_round_number INTEGER;
    matchup_record RECORD;
    winners_declared INTEGER := 0;
    ties_found INTEGER := 0;
    result JSONB;
BEGIN
    -- Find current active round
    SELECT id, round_number INTO current_round_id, current_round_number
    FROM public.rounds
    WHERE tournament_id = tournament_uuid AND status = 'active'
    ORDER BY round_number DESC
    LIMIT 1;
    
    IF current_round_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active round found for tournament'
        );
    END IF;
    
    -- Process all active matchups in current round
    FOR matchup_record IN 
        SELECT 
            m.id as matchup_id,
            m.contestant1_id,
            m.contestant2_id,
            m.contestant1_votes,
            m.contestant2_votes,
            m.total_votes,
            c1.name as contestant1_name,
            c2.name as contestant2_name
        FROM public.matchups m
        LEFT JOIN public.contestants c1 ON m.contestant1_id = c1.id
        LEFT JOIN public.contestants c2 ON m.contestant2_id = c2.id
        WHERE m.round_id = current_round_id 
        AND m.status IN ('active', 'upcoming')
        AND m.contestant1_id IS NOT NULL 
        AND m.contestant2_id IS NOT NULL
    LOOP
        -- Declare winner based on current vote count
        IF matchup_record.contestant1_votes > matchup_record.contestant2_votes THEN
            -- Contestant 1 wins
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant1_id,
                status = 'completed',
                completed_at = NOW()
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
            
        ELSIF matchup_record.contestant2_votes > matchup_record.contestant1_votes THEN
            -- Contestant 2 wins
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant2_id,
                status = 'completed',
                completed_at = NOW()
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
            
        ELSE
            -- It's a tie - handle based on tournament settings or default behavior
            ties_found := ties_found + 1;
            
            -- Default tie-breaking: favor contestant1 (could be randomized or use other criteria)
            UPDATE public.matchups
            SET 
                winner_id = matchup_record.contestant1_id,
                status = 'completed',
                completed_at = NOW(),
                notes = 'Winner declared by admin force advance (tie broken)'
            WHERE id = matchup_record.matchup_id;
            
            winners_declared := winners_declared + 1;
        END IF;
    END LOOP;
    
    -- Now that all matchups are completed, advance winners to next round positions
    PERFORM public.populate_next_round_matchups(current_round_id);
    
    -- Try to advance to next round using existing function
    PERFORM public.advance_to_next_round(tournament_uuid);
    
    -- Return results
    result := jsonb_build_object(
        'success', true,
        'winners_declared', winners_declared,
        'ties_resolved', ties_found,
        'round_advanced', true,
        'message', format('Force advanced round %s: %s winners declared, %s ties resolved', 
                         current_round_number, winners_declared, ties_found)
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'winners_declared', winners_declared,
        'ties_found', ties_found
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to populate next round matchups with winners
CREATE OR REPLACE FUNCTION public.populate_next_round_matchups(completed_round_id UUID)
RETURNS VOID AS $$
DECLARE
    tournament_id UUID;
    next_round_id UUID;
    winner_record RECORD;
    next_position INTEGER := 1;
BEGIN
    -- Get tournament ID
    SELECT r.tournament_id INTO tournament_id
    FROM public.rounds r
    WHERE r.id = completed_round_id;
    
    -- Get next round ID
    SELECT r.id INTO next_round_id
    FROM public.rounds r
    WHERE r.tournament_id = tournament_id
    AND r.round_number = (
        SELECT round_number + 1 
        FROM public.rounds 
        WHERE id = completed_round_id
    );
    
    IF next_round_id IS NULL THEN
        RETURN; -- No next round (tournament complete)
    END IF;
    
    -- Get winners from completed round in position order
    FOR winner_record IN
        SELECT winner_id, position
        FROM public.matchups
        WHERE round_id = completed_round_id
        AND status = 'completed'
        AND winner_id IS NOT NULL
        ORDER BY position
    LOOP
        -- Assign winners to next round matchups
        -- Every 2 winners form a new matchup
        IF (next_position % 2) = 1 THEN
            -- First contestant in new matchup
            UPDATE public.matchups
            SET contestant1_id = winner_record.winner_id
            WHERE round_id = next_round_id
            AND position = CEIL(next_position::FLOAT / 2);
        ELSE
            -- Second contestant in matchup
            UPDATE public.matchups
            SET contestant2_id = winner_record.winner_id
            WHERE round_id = next_round_id
            AND position = CEIL(next_position::FLOAT / 2);
        END IF;
        
        next_position := next_position + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.force_advance_round(UUID) IS 'Force advance tournament round by declaring winners based on current vote leaders';
COMMENT ON FUNCTION public.populate_next_round_matchups(UUID) IS 'Helper function to populate next round matchups with winners from completed round';