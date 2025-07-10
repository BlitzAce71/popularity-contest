# URGENT: Apply This SQL to Fix Admin Tie-Breaker Voting

The admin tie-breaker voting is still failing because the database constraint hasn't been updated yet. 

## How to Apply the Fix:

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run this exact SQL:**

```sql
-- Drop the existing unique constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_vote;

-- Add new unique constraint that includes is_admin_vote
-- This allows one regular vote and one admin vote per user per matchup
ALTER TABLE public.votes ADD CONSTRAINT unique_user_matchup_admin_vote 
    UNIQUE (user_id, matchup_id, is_admin_vote);
```

## What This Does:

- **Removes** the old constraint that prevented multiple votes per user per matchup
- **Adds** a new constraint that allows both regular votes AND admin tie-breaker votes
- **Enables** admins to vote normally AND break ties when needed

## After Running This SQL:

- ✅ Admins can cast regular votes
- ✅ Admins can cast tie-breaker votes
- ✅ No more "duplicate key value violates unique constraint" errors
- ✅ Tie-breaker panel will work properly

## Alternative Method:

If you have Supabase CLI set up with proper credentials, you can run:
```bash
npx supabase db push
```

But the SQL method above is the fastest way to fix this immediately.