-- Fix bracket generation to use proper tournament seeding (highest vs lowest seed)
-- This replaces the existing generate_single_elimination_bracket function

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tournament_rec RECORD;
    contestant_rec RECORD;
    round_rec RECORD;
    round_id UUID;
    matchup_id UUID;
    contestants_per_quadrant INTEGER;
    total_contestants INTEGER;
    round_number INTEGER := 1;
    matchups_in_round INTEGER;
    position INTEGER;
    contestant1_id UUID;
    contestant2_id UUID;
    contestant1_seed INTEGER;
    contestant2_seed INTEGER;
    quadrant_contestants RECORD[];
    i INTEGER;
    j INTEGER;
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
    
    -- Calculate contestants per quadrant
    contestants_per_quadrant := total_contestants / 4;
    
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
    
    -- Create first round with proper seeding
    round_id := gen_random_uuid();
    
    INSERT INTO rounds (id, tournament_id, round_number, name, status, total_matchups, completed_matchups)
    VALUES (
        round_id,
        tournament_uuid,
        1,
        CASE 
            WHEN total_contestants <= 4 THEN 'Semifinals'
            WHEN total_contestants <= 8 THEN 'Quarterfinals'
            WHEN total_contestants <= 16 THEN 'Round of 16'
            WHEN total_contestants <= 32 THEN 'Round of 32'
            ELSE 'Round of ' || total_contestants::text
        END,
        'active',
        total_contestants / 2,
        0
    );
    
    position := 1;
    
    -- Generate matchups for each quadrant with proper seeding
    FOR i IN 1..4 LOOP
        -- For each quadrant, create matchups with highest vs lowest seed pairing
        FOR j IN 1..contestants_per_quadrant/2 LOOP
            -- Get highest seed in this quadrant for this pairing
            SELECT id, seed INTO contestant1_id, contestant1_seed
            FROM contestants 
            WHERE tournament_id = tournament_uuid 
              AND quadrant = i 
              AND is_active = true
            ORDER BY seed ASC
            LIMIT 1 OFFSET (j-1);
            
            -- Get lowest seed in this quadrant for this pairing  
            SELECT id, seed INTO contestant2_id, contestant2_seed
            FROM contestants 
            WHERE tournament_id = tournament_uuid 
              AND quadrant = i 
              AND is_active = true
            ORDER BY seed DESC
            LIMIT 1 OFFSET (j-1);
            
            -- Only create matchup if we have both contestants
            IF contestant1_id IS NOT NULL AND contestant2_id IS NOT NULL AND contestant1_id != contestant2_id THEN
                matchup_id := gen_random_uuid();
                
                INSERT INTO matchups (
                    id, round_id, tournament_id, position, 
                    contestant1_id, contestant2_id, 
                    status, contestant1_votes, contestant2_votes
                ) VALUES (
                    matchup_id,
                    round_id,
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
    
    -- Generate subsequent rounds (empty for now, filled as tournament progresses)
    round_number := 2;
    matchups_in_round := total_contestants / 4; -- Start with semifinals
    
    WHILE matchups_in_round >= 1 LOOP
        round_id := gen_random_uuid();
        
        INSERT INTO rounds (id, tournament_id, round_number, name, status, total_matchups, completed_matchups)
        VALUES (
            round_id,
            tournament_uuid,
            round_number,
            CASE 
                WHEN matchups_in_round = 1 THEN 'Final'
                WHEN matchups_in_round = 2 THEN 'Semifinals'
                WHEN matchups_in_round = 4 THEN 'Quarterfinals'
                WHEN matchups_in_round = 8 THEN 'Round of 16'
                WHEN matchups_in_round = 16 THEN 'Round of 32'
                ELSE 'Round of ' || (matchups_in_round * 2)::text
            END,
            'upcoming',
            matchups_in_round,
            0
        );
        
        -- Create empty matchups for this round
        FOR i IN 1..matchups_in_round LOOP
            INSERT INTO matchups (
                id, round_id, tournament_id, position, 
                status, contestant1_votes, contestant2_votes
            ) VALUES (
                gen_random_uuid(),
                round_id,
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
    
    RETURN TRUE;
END;
$$;