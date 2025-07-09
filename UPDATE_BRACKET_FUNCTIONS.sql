-- UPDATE BRACKET FUNCTIONS TO USE VOTE_RESULTS TABLE
-- This updates existing functions to work with our cleaned schema

-- =============================================================================
-- 1. UPDATE get_tournament_stats function to use vote_results table
-- =============================================================================

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
    -- Calculate statistics using vote_results table instead of removed matchups columns
    SELECT 
        COALESCE(SUM(vr.total_votes), 0),
        COUNT(m.*),
        COUNT(*) FILTER (WHERE m.status = 'completed'),
        COUNT(*) FILTER (WHERE m.status = 'active')
    INTO total_votes, total_matchups, completed_matchups, active_matchups
    FROM public.matchups m
    LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
    WHERE m.tournament_id = tournament_uuid;
    
    -- Get total participants
    SELECT COUNT(*) INTO total_participants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    -- Find most voted match using vote_results table
    SELECT m.id INTO most_voted_match
    FROM public.matchups m
    LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
    WHERE m.tournament_id = tournament_uuid
    ORDER BY COALESCE(vr.total_votes, 0) DESC
    LIMIT 1;
    
    -- Find top contestant (most wins)
    SELECT c.id INTO top_contestant
    FROM public.contestants c
    LEFT JOIN public.matchups m ON (m.contestant1_id = c.id OR m.contestant2_id = c.id)
    LEFT JOIN public.vote_results vr ON m.id = vr.matchup_id
    WHERE c.tournament_id = tournament_uuid AND c.is_active = TRUE
    GROUP BY c.id
    ORDER BY COUNT(*) FILTER (WHERE vr.winner_id = c.id) DESC
    LIMIT 1;
    
    -- Build stats JSON
    stats := jsonb_build_object(
        'total_votes', total_votes,
        'total_matches', total_matchups,
        'completed_matches', completed_matchups,
        'active_matches', active_matchups,
        'total_participants', total_participants,
        'most_voted_match', most_voted_match,
        'top_contestant', top_contestant
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. UPDATE update_matchup_results function to use vote_results table
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_matchup_results(matchup_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    contestant1_id UUID;
    contestant2_id UUID;
    contestant1_votes INTEGER := 0;
    contestant2_votes INTEGER := 0;
    total_votes INTEGER := 0;
    winner_id UUID := NULL;
    is_tie BOOLEAN := FALSE;
    tournament_allows_ties BOOLEAN;
    vote_count_result JSONB;
BEGIN
    -- Get matchup details
    SELECT m.contestant1_id, m.contestant2_id, t.allow_ties
    INTO contestant1_id, contestant2_id, tournament_allows_ties
    FROM public.matchups m
    JOIN public.tournaments t ON m.tournament_id = t.id
    WHERE m.id = matchup_uuid;
    
    -- Count votes from votes table
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE selected_contestant_id = contestant1_id), 0),
        COALESCE(COUNT(*) FILTER (WHERE selected_contestant_id = contestant2_id), 0),
        COALESCE(COUNT(*), 0)
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
    vote_count_result := jsonb_build_object(
        'matchup_id', matchup_uuid,
        'contestant1_votes', contestant1_votes,
        'contestant2_votes', contestant2_votes,
        'total_votes', total_votes,
        'winner_id', winner_id,
        'is_tie', is_tie
    );
    
    -- Update vote_results table
    INSERT INTO public.vote_results (
        matchup_id,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        winner_id,
        is_tie,
        last_updated
    ) VALUES (
        matchup_uuid,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        winner_id,
        is_tie,
        NOW()
    )
    ON CONFLICT (matchup_id) DO UPDATE SET
        contestant1_votes = EXCLUDED.contestant1_votes,
        contestant2_votes = EXCLUDED.contestant2_votes,
        total_votes = EXCLUDED.total_votes,
        winner_id = EXCLUDED.winner_id,
        is_tie = EXCLUDED.is_tie,
        last_updated = EXCLUDED.last_updated;
    
    -- Handle tie-breaking if needed
    IF is_tie AND NOT tournament_allows_ties THEN
        -- For now, just return the tie state
        -- Tie-breaking logic would go here
        NULL;
    END IF;
    
    -- Update matchup winner if determined
    UPDATE public.matchups
    SET winner_id = vote_count_result->>'winner_id'::UUID,
        status = CASE 
            WHEN vote_count_result->>'winner_id' IS NOT NULL THEN 'completed'
            ELSE status 
        END
    WHERE id = matchup_uuid;
    
    RETURN vote_count_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. REMOVE/UPDATE any other functions that reference removed columns
-- =============================================================================

-- Check if there are other functions that need updating
-- This will show us which functions still reference the old columns
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    FOR func_rec IN
        SELECT routine_name
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_definition ILIKE '%m.total_votes%'
    LOOP
        RAISE NOTICE 'Function % still references m.total_votes column', func_rec.routine_name;
    END LOOP;
END $$;

-- =============================================================================
-- COMPLETION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BRACKET FUNCTIONS UPDATED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Updated functions:';
    RAISE NOTICE '✓ get_tournament_stats - Now uses vote_results table';
    RAISE NOTICE '✓ update_matchup_results - Now uses vote_results table';
    RAISE NOTICE '✓ Removed references to deleted matchups columns';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tournament statistics should now work properly';
    RAISE NOTICE '============================================================================';
END $$;