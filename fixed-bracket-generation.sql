-- Fixed bracket generation function that works with actual database schema
-- Removes total_matchups and completed_matchups columns that don't exist

DROP FUNCTION IF EXISTS generate_single_elimination_bracket(uuid);

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_rec RECORD;
    new_round_id UUID;
    new_matchup_id UUID;
    contestants_per_region INTEGER;
    total_contestants INTEGER;
    round_number INTEGER := 1;
    matchups_in_round INTEGER;
    position INTEGER;
    contestant1_id UUID;
    contestant2_id UUID;
    i INTEGER;
    j INTEGER;
    seed_pairs INTEGER;
BEGIN
    -- Get tournament details
    SELECT * INTO tournament_rec 
    FROM tournaments 
    WHERE id = tournament_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found';
    END IF;
    
    -- Get total contestants count
    SELECT COUNT(*) INTO total_contestants
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    IF total_contestants = 0 THEN
        RAISE EXCEPTION 'No contestants found for tournament';
    END IF;
    
    -- Calculate contestants per region (assumes 4 regions)
    contestants_per_region := total_contestants / 4;
    
    -- Validate that we have equal contestants per region
    IF total_contestants % 4 != 0 THEN
        RAISE EXCEPTION 'Tournament must have equal number of contestants per region (current: % total)', total_contestants;
    END IF;
    
    -- Validate that each region has a power-of-2 contestants for proper bracket
    IF contestants_per_region & (contestants_per_region - 1) != 0 THEN
        RAISE EXCEPTION 'Each region must have a power-of-2 number of contestants (current: % per region)', contestants_per_region;
    END IF;
    
    -- Delete existing rounds and matchups for this tournament
    DELETE FROM votes WHERE matchup_id IN (
        SELECT m.id FROM matchups m 
        JOIN rounds r ON m.round_id = r.id 
        WHERE r.tournament_id = tournament_uuid
    );
    DELETE FROM matchups WHERE round_id IN (
        SELECT id FROM rounds WHERE tournament_id = tournament_uuid
    );
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Create first round with proper regional seeding
    new_round_id := gen_random_uuid();
    
    -- FIXED: Remove total_matchups and completed_matchups columns that don't exist
    INSERT INTO rounds (id, tournament_id, round_number, name, status)
    VALUES (
        new_round_id,
        tournament_uuid,
        1,
        CASE 
            WHEN contestants_per_region <= 2 THEN 'Regional Finals'
            WHEN contestants_per_region <= 4 THEN 'Regional Semifinals'
            WHEN contestants_per_region <= 8 THEN 'Regional Quarterfinals'
            WHEN contestants_per_region <= 16 THEN 'Regional Round of 16'
            ELSE 'Regional Round of ' || contestants_per_region::text
        END,
        'active'
    );
    
    position := 1;
    
    -- Generate first round matchups for each region with proper seeding
    FOR i IN 1..4 LOOP
        seed_pairs := contestants_per_region / 2;
        
        -- For each region, create proper tournament seeding matchups
        FOR j IN 1..seed_pairs LOOP
            -- Get highest remaining seed in this region
            SELECT id INTO contestant1_id
            FROM contestants 
            WHERE tournament_id = tournament_uuid 
              AND quadrant = i 
              AND is_active = true
            ORDER BY seed ASC
            LIMIT 1 OFFSET (j-1);
            
            -- Get lowest remaining seed in this region for this pairing
            -- This creates: 1 vs N, 2 vs (N-1), 3 vs (N-2), etc.
            SELECT id INTO contestant2_id
            FROM contestants 
            WHERE tournament_id = tournament_uuid 
              AND quadrant = i 
              AND is_active = true
            ORDER BY seed DESC
            LIMIT 1 OFFSET (j-1);
            
            -- Only create matchup if we have both contestants
            IF contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL AND contestant1_id != contestant2_id THEN
                new_matchup_id := gen_random_uuid();
                
                INSERT INTO matchups (
                    id, round_id, tournament_id, position, 
                    contestant1_id, contestant2_id, 
                    status, contestant1_votes, contestant2_votes
                ) VALUES (
                    new_matchup_id,
                    new_round_id,
                    tournament_uuid,
                    position,
                    contestant1_id,
                    contestant2_id,
                    'active',
                    0,
                    0
                );
                
                position := position + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Generate subsequent regional rounds
    round_number := 2;
    matchups_in_round := total_contestants / 4; -- Start with regional semifinals
    
    -- Create regional rounds until we get to 4 regional winners
    WHILE matchups_in_round > 1 LOOP
        new_round_id := gen_random_uuid();
        
        -- FIXED: Remove total_matchups and completed_matchups columns that don't exist
        INSERT INTO rounds (id, tournament_id, round_number, name, status)
        VALUES (
            new_round_id,
            tournament_uuid,
            round_number,
            CASE 
                WHEN matchups_in_round = 2 THEN 'Regional Finals'
                WHEN matchups_in_round = 4 THEN 'Regional Semifinals'
                WHEN matchups_in_round = 8 THEN 'Regional Quarterfinals'
                WHEN matchups_in_round = 16 THEN 'Regional Round of 16'
                ELSE 'Regional Round of ' || (matchups_in_round * 2)::text
            END,
            'upcoming'
        );
        
        -- Create empty matchups for this round
        FOR i IN 1..matchups_in_round LOOP
            INSERT INTO matchups (
                id, round_id, tournament_id, position, 
                status, contestant1_votes, contestant2_votes
            ) VALUES (
                gen_random_uuid(),
                new_round_id,
                tournament_uuid,
                i,
                'upcoming',
                0,
                0
            );
        END LOOP;
        
        round_number := round_number + 1;
        matchups_in_round := matchups_in_round / 2;
    END LOOP;
    
    -- Create Final Four round (4 regional winners → 2 semifinal matchups)
    -- Region A winner vs Region C winner, Region B winner vs Region D winner
    new_round_id := gen_random_uuid();
    
    -- FIXED: Remove total_matchups and completed_matchups columns that don't exist
    INSERT INTO rounds (id, tournament_id, round_number, name, status)
    VALUES (
        new_round_id,
        tournament_uuid,
        round_number,
        'Final Four',
        'upcoming'
    );
    
    -- Create 2 semifinal matchups
    FOR i IN 1..2 LOOP
        INSERT INTO matchups (
            id, round_id, tournament_id, position, 
            status, contestant1_votes, contestant2_votes
        ) VALUES (
            gen_random_uuid(),
            new_round_id,
            tournament_uuid,
            i,
            'upcoming',
            0,
            0
        );
    END LOOP;
    
    round_number := round_number + 1;
    
    -- Create Final round
    new_round_id := gen_random_uuid();
    
    -- FIXED: Remove total_matchups and completed_matchups columns that don't exist
    INSERT INTO rounds (id, tournament_id, round_number, name, status)
    VALUES (
        new_round_id,
        tournament_uuid,
        round_number,
        'Championship',
        'upcoming'
    );
    
    -- Create championship matchup
    INSERT INTO matchups (
        id, round_id, tournament_id, position, 
        status, contestant1_votes, contestant2_votes
    ) VALUES (
        gen_random_uuid(),
        new_round_id,
        tournament_uuid,
        1,
        'upcoming',
        0,
        0
    );
    
    RETURN TRUE;
END;
$$;