-- MANUAL SQL TO FIX FORCE ADVANCE ROUND FUNCTION
-- Copy and paste this into your Supabase SQL editor and run it

-- First, create the new function with proper signature
CREATE OR REPLACE FUNCTION public.force_advance_round_new(p_round_id UUID, p_tournament_id UUID)
RETURNS JSONB AS $$
DECLARE
    current_round_id UUID := p_round_id;
    current_round_number INTEGER;
    matchup_record RECORD;
    winners_declared INTEGER := 0;
    ties_found INTEGER := 0;
    result JSONB;
BEGIN
    -- Get current round number
    SELECT round_number INTO current_round_number
    FROM public.rounds
    WHERE id = current_round_id AND tournament_id = p_tournament_id;
    
    IF current_round_number IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Round not found for tournament'
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
    PERFORM public.advance_to_next_round(p_tournament_id);
    
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

-- Now create/replace the original function to work with tournament_uuid (backward compatibility)
CREATE OR REPLACE FUNCTION public.force_advance_round(tournament_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    current_round_id UUID;
    current_round_number INTEGER;
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
    
    -- Call the new function with the proper parameters
    RETURN public.force_advance_round_new(current_round_id, tournament_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.force_advance_round_new(UUID, UUID) IS 'Force advance tournament round by declaring winners based on current vote leaders (new signature)';
COMMENT ON FUNCTION public.force_advance_round(UUID) IS 'Force advance tournament round - backward compatible wrapper';