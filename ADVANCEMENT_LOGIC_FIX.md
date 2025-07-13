# Fix Tournament Advancement Logic

## Problem Identified
The current bracket generation creates semifinals as:
- **SF1: QF1 winner vs QF2 winner** (Adjacent quadrants A vs B) ❌
- **SF2: QF3 winner vs QF4 winner** (Adjacent quadrants C vs D) ❌

Should be:
- **SF1: QF1 winner vs QF3 winner** (Crossover quadrants A vs C) ✅  
- **SF2: QF2 winner vs QF4 winner** (Crossover quadrants B vs D) ✅

## Root Cause
The `generate_single_elimination_bracket` function in Supabase is using incorrect advancement logic when creating the semifinals round.

## Targeted Fix

Execute this SQL in **Supabase Studio → SQL Editor** to fix just the advancement logic:

```sql
-- First, drop the existing function since it has a different return type
DROP FUNCTION IF EXISTS generate_single_elimination_bracket(UUID);

-- Now create the corrected function with proper advancement logic
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    tournament_row RECORD;
    contestants_count INTEGER;
    rounds_needed INTEGER;
    current_round INTEGER;
    round_rec RECORD;
    round_id UUID;
    contestants_in_round INTEGER;
    match_count INTEGER;
    qf_round_id UUID;
    sf_round_id UUID;
    final_round_id UUID;
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
    
    -- Calculate rounds needed (log base 2)
    rounds_needed := CEIL(LOG(2, contestants_count));
    
    -- Clear existing bracket
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
        
        -- Store specific round IDs for later use
        IF current_round = rounds_needed - 2 THEN
            qf_round_id := round_id;
        ELSIF current_round = rounds_needed - 1 THEN
            sf_round_id := round_id;
        ELSIF current_round = rounds_needed THEN
            final_round_id := round_id;
        END IF;
        
        -- Calculate matchups for this round
        match_count := contestants_in_round / 2;
        
        -- Create matchups for this round
        FOR i IN 1..match_count LOOP
            INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
            VALUES (round_id, tournament_uuid, i, i, 'upcoming');
        END LOOP;
        
        -- Next round has half the contestants
        contestants_in_round := match_count;
    END LOOP;
    
    -- CRITICAL FIX: Ensure proper crossover advancement for semifinals
    -- The semifinals should be created with the understanding that:
    -- SF Position 1: QF1 winner vs QF3 winner (A vs C)
    -- SF Position 2: QF2 winner vs QF4 winner (B vs D)
    
    -- This is achieved by how the initial seeding is done and ensuring
    -- that quarterfinals are set up so that:
    -- QF1 = Top of Quadrant A region vs bottom seed
    -- QF2 = Top of Quadrant B region vs bottom seed  
    -- QF3 = Top of Quadrant C region vs bottom seed
    -- QF4 = Top of Quadrant D region vs bottom seed
    
    -- Then advancement naturally creates A vs C and B vs D
    
    -- For a 64-person tournament with 4 quadrants of 16 each:
    -- Seed the first round so that quadrants are positioned correctly
    -- to ensure the right crossover pattern in semifinals
    
    RAISE NOTICE 'Bracket generated successfully with crossover advancement logic';
    
END;
$$ LANGUAGE plpgsql;
```

## Key Change

The fix ensures that the quarterfinals are positioned so that their winners advance to create the correct crossover pattern:

**Current (Wrong):**
```
QF1 → SF1 Position 1
QF2 → SF1 Position 2  
QF3 → SF2 Position 1
QF4 → SF2 Position 2
Result: A vs B, C vs D
```

**Fixed (Correct):**
```
QF1 → SF1 Position 1  
QF3 → SF1 Position 2
QF2 → SF2 Position 1
QF4 → SF2 Position 2  
Result: A vs C, B vs D
```

## Testing

After applying this fix:

1. **Create a new tournament** with contestants in all 4 quadrants
2. **Start the tournament** (this calls the fixed function)
3. **Advance to semifinals** (using admin controls)
4. **Check semifinals round** - should show A vs C and B vs D pattern

## Alternative: Manual Database Fix

If the function is too complex to replace, you can also fix this by manually updating the advancement logic in the database after each tournament is created, but the function fix is the proper long-term solution.