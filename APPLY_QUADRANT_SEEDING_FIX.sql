-- =============================================================================
-- QUADRANT-BASED BRACKET GENERATION FIX
-- =============================================================================
-- Copy and paste this entire SQL into your Supabase SQL Editor to fix the
-- bracket generation to use proper quadrant-based seeding
--
-- This replaces the old sequential pairing with proper tournament seeding
-- within each quadrant (Q1 Seed 1 vs Q1 Seed 4, etc.)

-- First, drop the old function
DROP FUNCTION IF EXISTS public.generate_single_elimination_bracket(UUID);

-- Create helper function to get proper seeding pairs for a bracket size
CREATE OR REPLACE FUNCTION public.get_seeding_pairs(bracket_size INTEGER)
RETURNS INTEGER[][] AS $$
DECLARE
    pairs INTEGER[][];
    i INTEGER;
BEGIN
    -- Generate proper tournament seeding pairs
    -- For N contestants: (1 vs N), (2 vs N-1), (3 vs N-2), etc.
    pairs := '{}';
    
    FOR i IN 1..(bracket_size/2) LOOP
        pairs := pairs || ARRAY[ARRAY[i, bracket_size + 1 - i]];
    END LOOP;
    
    RETURN pairs;
END;
$$ LANGUAGE plpgsql;

-- Create new quadrant-based bracket generation function
CREATE OR REPLACE FUNCTION public.generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_size INTEGER;
    contestant_count INTEGER;
    round_count INTEGER;
    current_round INTEGER;
    current_matchups INTEGER;
    round_id UUID;
    matchup_position INTEGER;
    
    -- Quadrant variables
    quadrant_size INTEGER;
    q1_contestants UUID[];
    q2_contestants UUID[];
    q3_contestants UUID[];
    q4_contestants UUID[];
    
    current_quadrant INTEGER;
    contestants_in_quadrant INTEGER;
    seeding_pairs INTEGER[][];
    pair_index INTEGER;
    seed1_pos INTEGER;
    seed2_pos INTEGER;
    contestant1_id UUID;
    contestant2_id UUID;
BEGIN
    -- Get tournament size and contestant count
    SELECT max_contestants INTO tournament_size
    FROM public.tournaments
    WHERE id = tournament_uuid;
    
    SELECT COUNT(*) INTO contestant_count
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE;
    
    IF contestant_count = 0 THEN
        RAISE EXCEPTION 'No active contestants found for tournament';
    END IF;
    
    -- Calculate quadrant size (assuming 4 quadrants)
    quadrant_size := tournament_size / 4;
    
    -- Get contestants by quadrant, ordered by seed
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q1_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 1;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q2_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 2;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q3_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 3;
    
    SELECT ARRAY_AGG(id ORDER BY COALESCE(seed, 999), created_at)
    INTO q4_contestants
    FROM public.contestants
    WHERE tournament_id = tournament_uuid AND is_active = TRUE AND quadrant = 4;
    
    -- Calculate number of rounds (log2 of tournament size)
    round_count := CEIL(LOG(2, tournament_size));
    
    -- Get proper seeding pairs for each quadrant
    seeding_pairs := public.get_seeding_pairs(quadrant_size);
    
    -- Clear any existing bracket data
    DELETE FROM public.matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM public.rounds WHERE tournament_id = tournament_uuid;
    
    -- Generate rounds
    FOR current_round IN 1..round_count LOOP
        current_matchups := tournament_size / POWER(2, current_round);
        
        -- Create round
        INSERT INTO public.rounds (
            tournament_id,
            round_number,
            name,
            status
        ) VALUES (
            tournament_uuid,
            current_round,
            public.generate_round_name(tournament_size, current_round),
            CASE WHEN current_round = 1 THEN 'active' ELSE 'upcoming' END
        ) RETURNING id INTO round_id;
        
        matchup_position := 1;
        
        IF current_round = 1 THEN
            -- First round: create proper seeded matchups within each quadrant
            FOR current_quadrant IN 1..4 LOOP
                contestants_in_quadrant := CASE current_quadrant
                    WHEN 1 THEN COALESCE(array_length(q1_contestants, 1), 0)
                    WHEN 2 THEN COALESCE(array_length(q2_contestants, 1), 0)
                    WHEN 3 THEN COALESCE(array_length(q3_contestants, 1), 0)
                    WHEN 4 THEN COALESCE(array_length(q4_contestants, 1), 0)
                END;
                
                -- Create matchups for this quadrant using proper seeding
                FOR pair_index IN 1..(contestants_in_quadrant/2) LOOP
                    -- Get seed positions from seeding pairs
                    seed1_pos := seeding_pairs[pair_index][1];
                    seed2_pos := seeding_pairs[pair_index][2];
                    
                    -- Get actual contestant IDs
                    contestant1_id := CASE current_quadrant
                        WHEN 1 THEN q1_contestants[seed1_pos]
                        WHEN 2 THEN q2_contestants[seed1_pos]
                        WHEN 3 THEN q3_contestants[seed1_pos]
                        WHEN 4 THEN q4_contestants[seed1_pos]
                    END;
                    
                    contestant2_id := CASE current_quadrant
                        WHEN 1 THEN q1_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 2 THEN q2_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 3 THEN q3_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                        WHEN 4 THEN q4_contestants[LEAST(seed2_pos, contestants_in_quadrant)]
                    END;
                    
                    INSERT INTO public.matchups (
                        round_id,
                        tournament_id,
                        match_number,
                        position,
                        contestant1_id,
                        contestant2_id,
                        status
                    ) VALUES (
                        round_id,
                        tournament_uuid,
                        matchup_position,
                        matchup_position,
                        contestant1_id,
                        contestant2_id,
                        'active'
                    );
                    
                    matchup_position := matchup_position + 1;
                END LOOP;
            END LOOP;
        ELSE
            -- Later rounds: create empty matchups to be filled by winners
            FOR matchup_position IN 1..current_matchups LOOP
                INSERT INTO public.matchups (
                    round_id,
                    tournament_id,
                    match_number,
                    position,
                    status
                ) VALUES (
                    round_id,
                    tournament_uuid,
                    matchup_position,
                    matchup_position,
                    'upcoming'
                );
            END LOOP;
        END IF;
    END LOOP;
    
    -- Update tournament status to active
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = tournament_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_seeding_pairs(INTEGER) IS 'Generate proper tournament seeding pairs (1 vs N, 2 vs N-1, etc.)';
COMMENT ON FUNCTION public.generate_single_elimination_bracket(UUID) IS 'Generate quadrant-based single elimination bracket with proper seeding within each quadrant';

-- =============================================================================
-- INSTRUCTIONS AFTER RUNNING THIS SQL:
-- =============================================================================
-- 1. Go to your tournament management page
-- 2. Reset the tournament (if there's a reset button)
-- 3. OR manually delete rounds/matchups and restart the tournament
-- 4. OR create a new tournament to test the fixed seeding
--
-- Expected result for 16-contestant tournament:
-- Quadrant 1: Seed 1 vs Seed 4, Seed 2 vs Seed 3
-- Quadrant 2: Seed 1 vs Seed 4, Seed 2 vs Seed 3  
-- Quadrant 3: Seed 1 vs Seed 4, Seed 2 vs Seed 3
-- Quadrant 4: Seed 1 vs Seed 4, Seed 2 vs Seed 3