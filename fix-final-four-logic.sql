-- Fix Final Four Logic: A vs C and B vs D (Opposite Regions)
-- This SQL should be run in your Supabase database to correct the advance_to_next_round function

-- First, let's create a helper function to get quadrant winners correctly
CREATE OR REPLACE FUNCTION get_quadrant_winners(tournament_uuid UUID)
RETURNS TABLE(
  quadrant INTEGER,
  winner_id UUID,
  winner_name TEXT,
  winner_seed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.quadrant,
    c.id as winner_id,
    c.name as winner_name,
    c.seed as winner_seed
  FROM contestants c
  INNER JOIN matchups m ON (m.contestant1_id = c.id OR m.contestant2_id = c.id)
  INNER JOIN rounds r ON m.round_id = r.id
  WHERE r.tournament_id = tournament_uuid
    AND m.winner_id = c.id
    AND r.name = 'Quarterfinals'
    AND c.is_active = true
  ORDER BY c.quadrant;
END;
$$ LANGUAGE plpgsql;

-- Now update the advance_to_next_round function with correct Final Four logic
CREATE OR REPLACE FUNCTION advance_to_next_round(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_round_rec RECORD;
  next_round_id UUID;
  next_round_number INTEGER;
  next_round_name TEXT;
  completed_matchups INTEGER;
  total_matchups INTEGER;
  winner_rec RECORD;
  quadrant_winners RECORD[];
  matchup_position INTEGER := 0;
BEGIN
  -- Get the current active round
  SELECT * INTO current_round_rec
  FROM rounds
  WHERE tournament_id = tournament_uuid
    AND status = 'active'
  ORDER BY round_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active round found for tournament %', tournament_uuid;
  END IF;

  -- Check if all matchups in current round are completed
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) as total
  INTO completed_matchups, total_matchups
  FROM matchups
  WHERE round_id = current_round_rec.id;

  IF completed_matchups < total_matchups THEN
    RAISE EXCEPTION 'Not all matchups in current round are completed. Completed: %, Total: %', 
      completed_matchups, total_matchups;
  END IF;

  -- Mark current round as completed
  UPDATE rounds
  SET status = 'completed'
  WHERE id = current_round_rec.id;

  -- Determine next round details
  next_round_number := current_round_rec.round_number + 1;
  
  CASE 
    WHEN completed_matchups = 8 THEN
      next_round_name := 'Quarterfinals';
    WHEN completed_matchups = 4 THEN
      next_round_name := 'Semifinals';
    WHEN completed_matchups = 2 THEN
      next_round_name := 'Final';
    WHEN completed_matchups = 1 THEN
      -- Tournament is complete
      UPDATE tournaments 
      SET status = 'completed'
      WHERE id = tournament_uuid;
      RETURN TRUE;
    ELSE
      next_round_name := 'Round ' || next_round_number;
  END CASE;

  -- Create next round
  INSERT INTO rounds (tournament_id, round_number, name, status)
  VALUES (tournament_uuid, next_round_number, next_round_name, 'active')
  RETURNING id INTO next_round_id;

  -- Create matchups for next round with correct Final Four logic
  IF next_round_name = 'Semifinals' THEN
    -- CRITICAL FIX: Final Four should be A vs C and B vs D (opposite regions)
    
    -- Get winners from each quadrant
    SELECT array_agg(
      ROW(quadrant, winner_id, winner_name, winner_seed)::RECORD
      ORDER BY quadrant
    ) INTO quadrant_winners
    FROM get_quadrant_winners(tournament_uuid);
    
    IF array_length(quadrant_winners, 1) != 4 THEN
      RAISE EXCEPTION 'Expected 4 quadrant winners, found %', array_length(quadrant_winners, 1);
    END IF;
    
    -- Create Semifinal Matchup 1: Region A (quadrant 1) vs Region C (quadrant 3)
    INSERT INTO matchups (
      round_id, 
      tournament_id, 
      contestant1_id, 
      contestant2_id, 
      position, 
      status
    ) VALUES (
      next_round_id,
      tournament_uuid,
      (quadrant_winners[1]).winner_id,  -- Region A winner
      (quadrant_winners[3]).winner_id,  -- Region C winner
      1,
      'active'
    );
    
    -- Create Semifinal Matchup 2: Region B (quadrant 2) vs Region D (quadrant 4)
    INSERT INTO matchups (
      round_id, 
      tournament_id, 
      contestant1_id, 
      contestant2_id, 
      position, 
      status
    ) VALUES (
      next_round_id,
      tournament_uuid,
      (quadrant_winners[2]).winner_id,  -- Region B winner
      (quadrant_winners[4]).winner_id,  -- Region D winner
      2,
      'active'
    );
    
  ELSE
    -- For non-semifinal rounds, use standard pairing logic
    matchup_position := 0;
    
    FOR winner_rec IN
      SELECT 
        m.winner_id,
        ROW_NUMBER() OVER (ORDER BY m.position) as winner_order
      FROM matchups m
      WHERE m.round_id = current_round_rec.id
        AND m.status = 'completed'
        AND m.winner_id IS NOT NULL
      ORDER BY m.position
    LOOP
      IF winner_rec.winner_order % 2 = 1 THEN
        -- First contestant of pair
        matchup_position := matchup_position + 1;
        
        INSERT INTO matchups (
          round_id, 
          tournament_id, 
          contestant1_id, 
          position, 
          status
        ) VALUES (
          next_round_id,
          tournament_uuid,
          winner_rec.winner_id,
          matchup_position,
          'pending'
        );
      ELSE
        -- Second contestant of pair, complete the matchup
        UPDATE matchups
        SET 
          contestant2_id = winner_rec.winner_id,
          status = 'active'
        WHERE round_id = next_round_id
          AND position = matchup_position
          AND contestant2_id IS NULL;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the fix
COMMENT ON FUNCTION advance_to_next_round(UUID) IS 
'Advances tournament to next round with corrected Final Four logic: A vs C and B vs D';

COMMENT ON FUNCTION get_quadrant_winners(UUID) IS 
'Helper function to get winners from each quadrant for proper Final Four pairing';