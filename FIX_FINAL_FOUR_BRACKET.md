# Fix Final Four Bracket Structure

## Issue
The current bracket generation creates Final Four matchups as **A vs B** and **C vs D** (adjacent quadrants), but standard tournament brackets should have **A vs C** and **B vs D** (crossover pattern).

## Root Cause  
The database RPC function `generate_single_elimination_bracket` is setting up the quarterfinals and/or advancement logic incorrectly.

## Database Schema Analysis (Confirmed via Query)
**Actual table structures:**
- `rounds`: `id, tournament_id, round_number, name, status, start_date, end_date, created_at, updated_at`
- `matchups`: `id, round_id, tournament_id, match_number, contestant1_id, contestant2_id, winner_id, status, created_at, updated_at, position`
- `contestants`: `id, tournament_id, name, description, image_url, seed, is_active, eliminated_at, created_at, updated_at, quadrant`

**Tournament Structure:**
- 64 contestants divided into 4 quadrants (16 each)
- Quadrant 1: Seeds 1-16 (Region A)
- Quadrant 2: Seeds 17-32 (Region B)  
- Quadrant 3: Seeds 33-48 (Region C)
- Quadrant 4: Seeds 49-64 (Region D)

## Current Problematic Flow
```
Quarterfinals → Semifinals:
- QF1 winner (Quadrant A) + QF2 winner (Quadrant B) → Semifinal 1
- QF3 winner (Quadrant C) + QF4 winner (Quadrant D) → Semifinal 2

Result: A vs B, C vs D (INCORRECT)
```

## Correct Flow Should Be
```
Quarterfinals → Semifinals:
- QF1 winner (Quadrant A) + QF3 winner (Quadrant C) → Semifinal 1  
- QF2 winner (Quadrant B) + QF4 winner (Quadrant D) → Semifinal 2

Result: A vs C, B vs D (CORRECT)
```

## Fix Required

The `generate_single_elimination_bracket` function in Supabase needs to be modified. Here's the SQL that needs to be executed in **Supabase Studio → SQL Editor**:

### Option 1: Fix the Advancement Logic
```sql
-- Update the function to change how quarterfinal winners advance to semifinals
-- Based on actual schema: matchups table has position, round_id, tournament_id columns

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    quarterfinal_round_id UUID;
    semifinal_round_id UUID;
    final_round_id UUID;
    contestants_count INTEGER;
    round_count INTEGER;
BEGIN
    -- Get contestant count for this tournament
    SELECT COUNT(*) INTO contestants_count 
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Calculate number of rounds needed
    round_count := CEIL(LOG(2, contestants_count));
    
    -- Clear existing rounds and matchups
    DELETE FROM matchups WHERE tournament_id = tournament_uuid;
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Create rounds (this part likely exists in current function)
    -- ... standard round creation logic ...
    
    -- CRITICAL FIX: When creating semifinals, ensure proper crossover
    -- Get the semifinal round ID
    SELECT id INTO semifinal_round_id 
    FROM rounds 
    WHERE tournament_id = tournament_uuid AND name = 'Semifinals';
    
    -- Create semifinals with CROSSOVER pattern:
    -- SF1: QF1 winner vs QF3 winner (Quadrant A vs Quadrant C)
    INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
    VALUES (semifinal_round_id, tournament_uuid, 1, 1, 'upcoming');
    
    -- SF2: QF2 winner vs QF4 winner (Quadrant B vs Quadrant D)  
    INSERT INTO matchups (round_id, tournament_id, position, match_number, status)
    VALUES (semifinal_round_id, tournament_uuid, 2, 2, 'upcoming');
    
    -- The key is ensuring the advancement logic connects:
    -- QF position 1 + QF position 3 → SF position 1
    -- QF position 2 + QF position 4 → SF position 2
    -- Instead of the current: QF1+QF2→SF1, QF3+QF4→SF2
    
END;
$$ LANGUAGE plpgsql;
```

### Option 2: Rebuild Function with Correct Logic
If the current function is too complex to modify, here's a complete rewrite approach:

```sql
-- Backup current function first!
-- CREATE OR REPLACE FUNCTION generate_single_elimination_bracket_backup AS SELECT prosrc FROM pg_proc WHERE proname = 'generate_single_elimination_bracket';

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    round_id UUID;
    matchup_id UUID;
    contestants_count INTEGER;
    current_round INTEGER := 1;
    total_rounds INTEGER;
    contestants_per_round INTEGER;
BEGIN
    -- Clear existing bracket structure
    DELETE FROM matchups WHERE round_id IN (
        SELECT id FROM rounds WHERE tournament_id = tournament_uuid
    );
    DELETE FROM rounds WHERE tournament_id = tournament_uuid;
    
    -- Get contestant count
    SELECT COUNT(*) INTO contestants_count 
    FROM contestants 
    WHERE tournament_id = tournament_uuid AND is_active = true;
    
    -- Calculate total rounds needed
    total_rounds := CEIL(LOG(2, contestants_count));
    contestants_per_round := contestants_count;
    
    -- Create rounds (from first round to final)
    FOR round_num IN 1..total_rounds LOOP
        INSERT INTO rounds (tournament_id, round_number, name, status)
        VALUES (
            tournament_uuid,
            round_num,
            CASE 
                WHEN round_num = total_rounds THEN 'Final'
                WHEN round_num = total_rounds - 1 THEN 'Semifinals'
                WHEN round_num = total_rounds - 2 THEN 'Quarterfinals'
                ELSE 'Round ' || round_num
            END,
            CASE WHEN round_num = 1 THEN 'active' ELSE 'upcoming' END
        )
        RETURNING id INTO round_id;
        
        -- Create matchups for this round
        contestants_per_round := contestants_per_round / 2;
        
        FOR match_num IN 1..contestants_per_round LOOP
            INSERT INTO matchups (round_id, position, match_number, status)
            VALUES (round_id, match_num, match_num, 'upcoming');
        END LOOP;
    END LOOP;
    
    -- CRITICAL: Set up initial bracket with proper quadrant distribution
    -- This is where the crossover logic needs to be implemented
    -- (Implementation details depend on how contestants are seeded by quadrant)
    
END;
$$ LANGUAGE plpgsql;
```

## Testing the Fix

After applying the fix:

1. **Reset a test tournament**:
   ```sql
   SELECT reset_tournament_bracket('tournament-id-here');
   ```

2. **Regenerate bracket**:
   ```sql
   SELECT generate_single_elimination_bracket('tournament-id-here');
   ```

3. **Verify semifinal structure** by checking that:
   - Semifinal 1 has contestants from Quadrants A and C
   - Semifinal 2 has contestants from Quadrants B and D

## Files Updated
- Created investigation scripts: `investigate-final-four.js`, `check-bracket-flow.js`
- This documentation: `FIX_FINAL_FOUR_BRACKET.md`

## Next Steps
1. Apply the SQL fix in Supabase Studio
2. Test with a sample tournament
3. Verify Final Four shows A vs C and B vs D pattern