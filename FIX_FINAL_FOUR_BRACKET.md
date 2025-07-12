# Fix Final Four Bracket Structure

## Issue
The current bracket generation creates Final Four matchups as **A vs B** and **C vs D** (adjacent quadrants), but standard tournament brackets should have **A vs C** and **B vs D** (crossover pattern).

## Root Cause
The database RPC function `generate_single_elimination_bracket` is setting up the quarterfinals and/or advancement logic incorrectly.

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
-- This assumes the current quarterfinals are set up correctly but advancement is wrong

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    -- ... existing variable declarations ...
BEGIN
    -- ... existing bracket generation logic ...
    
    -- MODIFIED SECTION: Fix semifinal advancement
    -- When creating semifinals, ensure crossover pattern:
    -- SF1: QF1 winner vs QF3 winner (A vs C)
    -- SF2: QF2 winner vs QF4 winner (B vs D)
    
    -- Instead of the current logic, use:
    -- (This is pseudo-code - actual implementation depends on current function structure)
    
    -- Create semifinal 1: QF1 winner vs QF3 winner
    INSERT INTO matchups (round_id, position, match_number, status)
    VALUES (semifinals_round_id, 1, 1, 'upcoming');
    
    -- Create semifinal 2: QF2 winner vs QF4 winner  
    INSERT INTO matchups (round_id, position, match_number, status)
    VALUES (semifinals_round_id, 2, 2, 'upcoming');
    
    -- ... rest of function ...
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