-- FIX TOURNAMENT CREATION AND BRACKET GENERATION
-- This fixes the missing functions and schema issues preventing bracket generation

-- =============================================================================
-- 1. ADD MISSING get_tournament_stats FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_tournament_stats(tournament_uuid UUID)
RETURNS TABLE (
    total_contestants INTEGER,
    total_rounds INTEGER,
    total_matchups INTEGER,
    completed_matchups INTEGER,
    total_votes INTEGER,
    tournament_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM contestants WHERE tournament_id = tournament_uuid AND is_active = TRUE),
        (SELECT COUNT(*)::INTEGER FROM rounds WHERE tournament_id = tournament_uuid),
        (SELECT COUNT(*)::INTEGER FROM matchups WHERE tournament_id = tournament_uuid),
        (SELECT COUNT(*)::INTEGER FROM matchups WHERE tournament_id = tournament_uuid AND winner_id IS NOT NULL),
        (SELECT COUNT(*)::INTEGER FROM votes v JOIN matchups m ON v.matchup_id = m.id WHERE m.tournament_id = tournament_uuid),
        (SELECT status FROM tournaments WHERE id = tournament_uuid)
    ;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. ENSURE QUADRANT COLUMN EXISTS IN CONTESTANTS TABLE
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contestants' AND column_name = 'quadrant' AND table_schema = 'public') THEN
        ALTER TABLE public.contestants ADD COLUMN quadrant INTEGER DEFAULT 1 CHECK (quadrant >= 1 AND quadrant <= 4);
        RAISE NOTICE 'Added quadrant column to contestants table';
    ELSE
        RAISE NOTICE 'quadrant column already exists in contestants table';
    END IF;
END $$;

-- =============================================================================
-- 3. ADD MISSING can_start_tournament FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_start_tournament(tournament_uuid UUID)
RETURNS TABLE (
    can_start BOOLEAN,
    message TEXT,
    contestant_count INTEGER,
    required_count INTEGER
) AS $$
DECLARE
    contestant_count INTEGER;
    max_contestants INTEGER;
    tournament_status TEXT;
BEGIN
    -- Get tournament info
    SELECT 
        (SELECT COUNT(*) FROM contestants WHERE tournament_id = tournament_uuid AND is_active = TRUE),
        t.max_contestants,
        t.status
    INTO contestant_count, max_contestants, tournament_status
    FROM tournaments t
    WHERE t.id = tournament_uuid;
    
    -- Check if tournament exists
    IF tournament_status IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Tournament not found', 0, 0;
        RETURN;
    END IF;
    
    -- Check if tournament is already started
    IF tournament_status != 'draft' THEN
        RETURN QUERY SELECT FALSE, 'Tournament already started', contestant_count, max_contestants;
        RETURN;
    END IF;
    
    -- Check if we have enough contestants
    IF contestant_count < 4 THEN
        RETURN QUERY SELECT FALSE, 'Need at least 4 contestants to start tournament', contestant_count, max_contestants;
        RETURN;
    END IF;
    
    -- Check if contestant count is power of 2
    IF (contestant_count & (contestant_count - 1)) != 0 THEN
        RETURN QUERY SELECT FALSE, 'Contestant count must be a power of 2 (4, 8, 16, 32, etc.)', contestant_count, max_contestants;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT TRUE, 'Tournament can be started', contestant_count, max_contestants;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. FIX generate_single_elimination_bracket FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    rounds_created INTEGER,
    matchups_created INTEGER
) AS $$
DECLARE
    contestant_count INTEGER;
    total_rounds INTEGER;
    round_id UUID;
    round_num INTEGER;
    matchup_count INTEGER;
    current_contestants UUID[];
    next_contestants UUID[];
    i INTEGER;
    matchup_counter INTEGER;
    rounds_created INTEGER := 0;
    matchups_created INTEGER := 0;
BEGIN
    -- Get active contestants
    SELECT array_agg(id ORDER BY COALESCE(seed, 999), created_at)
    INTO current_contestants
    FROM contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    contestant_count := array_length(current_contestants, 1);
    
    -- Validate contestant count
    IF contestant_count IS NULL OR contestant_count < 4 THEN
        RETURN QUERY SELECT FALSE, 'Need at least 4 contestants', 0, 0;
        RETURN;
    END IF;
    
    -- Check if it's a power of 2
    IF (contestant_count & (contestant_count - 1)) != 0 THEN
        RETURN QUERY SELECT FALSE, 'Contestant count must be a power of 2', 0, 0;
        RETURN;
    END IF;
    
    -- Calculate total rounds needed
    total_rounds := floor(log(2, contestant_count))::INTEGER;
    
    -- Delete existing rounds/matchups for this tournament
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Create rounds and matchups
    FOR round_num IN 1..total_rounds LOOP
        -- Create round
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_uuid,
            round_num,
            CASE 
                WHEN round_num = total_rounds THEN 'Finals'
                WHEN round_num = total_rounds - 1 THEN 'Semi-Finals'
                WHEN round_num = total_rounds - 2 THEN 'Quarter-Finals'
                ELSE 'Round ' || round_num::TEXT
            END,
            CASE WHEN round_num = 1 THEN 'active' ELSE 'upcoming' END
        )
        RETURNING id INTO round_id;
        
        rounds_created := rounds_created + 1;
        
        -- Create matchups for this round
        matchup_count := array_length(current_contestants, 1) / 2;
        matchup_counter := 1;
        
        FOR i IN 1..matchup_count LOOP
            INSERT INTO matchups (
                round_id,
                tournament_id,
                match_number,
                contestant1_id,
                contestant2_id,
                status,
                position
            ) VALUES (
                round_id,
                tournament_uuid,
                matchup_counter,
                current_contestants[i * 2 - 1],
                current_contestants[i * 2],
                'active',
                matchup_counter
            );
            
            matchups_created := matchups_created + 1;
            matchup_counter := matchup_counter + 1;
        END LOOP;
        
        -- Prepare for next round (winners will be determined later)
        current_contestants := current_contestants[1:matchup_count];
    END LOOP;
    
    -- Update tournament status
    UPDATE tournaments 
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    RETURN QUERY SELECT TRUE, 'Bracket generated successfully', rounds_created, matchups_created;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. CREATE vote_results ENTRIES for all matchups
-- =============================================================================

-- Function to ensure vote_results exist for all matchups
CREATE OR REPLACE FUNCTION public.ensure_vote_results_for_tournament(tournament_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    created_count INTEGER := 0;
BEGIN
    -- Insert vote_results for any matchups that don't have them
    INSERT INTO public.vote_results (
        matchup_id,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        winner_id,
        is_tie,
        last_updated
    )
    SELECT 
        m.id,
        0,
        0,
        0,
        NULL,
        FALSE,
        NOW()
    FROM matchups m
    LEFT JOIN vote_results vr ON m.id = vr.matchup_id
    WHERE m.tournament_id = tournament_uuid
    AND vr.matchup_id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    
    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMPLETION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'TOURNAMENT CREATION FIXES COMPLETED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Added functions:';
    RAISE NOTICE '✓ get_tournament_stats - Tournament statistics';
    RAISE NOTICE '✓ can_start_tournament - Tournament start validation';
    RAISE NOTICE '✓ generate_single_elimination_bracket - Bracket generation';
    RAISE NOTICE '✓ ensure_vote_results_for_tournament - Vote results initialization';
    RAISE NOTICE '✓ Added quadrant column to contestants table';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tournament creation and bracket generation should now work properly';
    RAISE NOTICE 'Use "Start Tournament" button to generate brackets for existing tournaments';
    RAISE NOTICE '============================================================================';
END $$;