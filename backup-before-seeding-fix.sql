-- PROPOSED SEEDING FIX - Only change the seeding assignment logic
-- This is the EXACT same function as FINAL-SIMPLE-FIX.sql with ONLY the seeding changed

DROP FUNCTION IF EXISTS generate_single_elimination_bracket(uuid);

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tournament_row RECORD;
    contestants_count INTEGER;
    rounds_needed INTEGER;
    current_round INTEGER;
    round_id UUID;
    contestants_in_round INTEGER;
    match_count INTEGER;
    i INTEGER;
    first_round_id UUID;
BEGIN
    -- Get tournament info
    SELECT * INTO tournament_row FROM tournaments WHERE id = tournament_uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;

    -- Get active contestant count
    SELECT COUNT(*) INTO contestants_count 
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    IF contestants_count = 0 THEN
        RAISE EXCEPTION 'No active contestants found';
    END IF;
    
    -- Calculate rounds needed (log base 2)
    rounds_needed := CEIL(LOG(2, contestants_count));
    
    -- Clear existing bracket
    DELETE FROM votes WHERE matchup_id IN (
        SELECT id FROM matchups WHERE tournament_id = tournament_uuid
    );
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Create rounds from first round to final
    contestants_in_round := contestants_count;
    
    FOR current_round IN 1..rounds_needed LOOP
        -- Create round
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_uuid,
            current_round,
            CASE 
                WHEN current_round = rounds_needed THEN 'Final'
                WHEN current_round = rounds_needed - 1 THEN 'Semifinals'
                WHEN current_round = rounds_needed - 2 THEN 'Quarterfinals'
                ELSE 'Round ' || current_round
            END,
            CASE WHEN current_round = 1 THEN 'active' ELSE 'upcoming' END
        )
        RETURNING id INTO round_id;
        
        -- Store first round ID for contestant assignment
        IF current_round = 1 THEN
            first_round_id := round_id;
        END IF;
        
        -- Calculate matchups for this round
        match_count := contestants_in_round / 2;
        
        -- Create matchups for this round - INCLUDING match_number
        FOR i IN 1..match_count LOOP
            INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
            VALUES (round_id, tournament_uuid, i, i, 'upcoming');
        END LOOP;
        
        -- Next round has half the contestants
        contestants_in_round := match_count;
    END LOOP;
    
    -- ======================================================================
    -- ONLY CHANGE: Replace consecutive seeding (1v2, 3v4) with proper tournament seeding (1vN, 2vN-1)
    -- ======================================================================
    
    -- Assign contestants to first round matchups with PROPER SEEDING
    WITH high_seeds AS (
        -- Get contestants ordered by quadrant and seed (highest to lowest priority)
        SELECT 
            id,
            quadrant,
            seed,
            ROW_NUMBER() OVER (PARTITION BY quadrant ORDER BY seed ASC) as seed_rank_in_quadrant
        FROM contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true
    ),
    low_seeds AS (
        -- Get contestants ordered by quadrant and seed (lowest to highest priority) 
        SELECT 
            id,
            quadrant,
            seed,
            ROW_NUMBER() OVER (PARTITION BY quadrant ORDER BY seed DESC) as seed_rank_in_quadrant
        FROM contestants 
        WHERE tournament_id = tournament_uuid AND is_active = true
    ),
    seeded_pairs AS (
        -- Pair high seeds with low seeds within each quadrant
        SELECT 
            hs.id as high_seed_id,
            ls.id as low_seed_id,
            hs.quadrant,
            hs.seed_rank_in_quadrant,
            -- Calculate position across all quadrants
            ((hs.quadrant - 1) * (contestants_count / 4 / 2)) + hs.seed_rank_in_quadrant as matchup_position
        FROM high_seeds hs
        JOIN low_seeds ls ON (
            hs.quadrant = ls.quadrant 
            AND hs.seed_rank_in_quadrant = ls.seed_rank_in_quadrant
        )
    )
    -- Update matchups with proper seeded pairs
    UPDATE matchups 
    SET 
        contestant1_id = sp.high_seed_id,
        contestant2_id = sp.low_seed_id,
        status = 'active'
    FROM seeded_pairs sp
    WHERE matchups.round_id = first_round_id
    AND matchups.position = sp.matchup_position;

    RAISE NOTICE 'Bracket generated successfully with % contestants in % rounds', contestants_count, rounds_needed;
    
END;
$$;