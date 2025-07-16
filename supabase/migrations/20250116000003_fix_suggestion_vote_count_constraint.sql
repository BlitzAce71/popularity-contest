-- ================================================================
-- Migration: Fix Suggestion Vote Count Constraint
-- Description: Fix vote count constraint violation when removing votes
-- Author: System
-- Date: 2025-01-16
-- ================================================================

-- Improved function to update vote count with proper bounds checking
CREATE OR REPLACE FUNCTION update_suggestion_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contestant_suggestions 
    SET vote_count = vote_count + 1,
        updated_at = NOW()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if vote_count is greater than 0 to prevent constraint violation
    UPDATE contestant_suggestions 
    SET vote_count = GREATEST(0, vote_count - 1),
        updated_at = NOW()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to fix any existing vote count inconsistencies
CREATE OR REPLACE FUNCTION fix_suggestion_vote_counts()
RETURNS VOID AS $$
BEGIN
  -- Update all vote counts to match actual vote records
  UPDATE contestant_suggestions
  SET vote_count = (
    SELECT COUNT(*)
    FROM suggestion_votes sv
    WHERE sv.suggestion_id = contestant_suggestions.id
  ),
  updated_at = NOW()
  WHERE id IN (
    SELECT cs.id
    FROM contestant_suggestions cs
    LEFT JOIN (
      SELECT suggestion_id, COUNT(*) as actual_count
      FROM suggestion_votes
      GROUP BY suggestion_id
    ) sv ON cs.id = sv.suggestion_id
    WHERE cs.vote_count != COALESCE(sv.actual_count, 0)
  );
END;
$$ LANGUAGE plpgsql;

-- Fix any existing inconsistencies
SELECT fix_suggestion_vote_counts();

-- Add helpful comments
COMMENT ON FUNCTION update_suggestion_vote_count() IS 'Maintains vote_count field when votes are added/removed with bounds checking';
COMMENT ON FUNCTION fix_suggestion_vote_counts() IS 'Fixes vote count inconsistencies by recalculating from actual vote records';

-- Show current state
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  -- Count any suggestions that still have inconsistent vote counts
  SELECT COUNT(*) INTO fixed_count
  FROM contestant_suggestions cs
  LEFT JOIN (
    SELECT suggestion_id, COUNT(*) as actual_count
    FROM suggestion_votes
    GROUP BY suggestion_id
  ) sv ON cs.id = sv.suggestion_id
  WHERE cs.vote_count != COALESCE(sv.actual_count, 0);
  
  IF fixed_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % suggestions with inconsistent vote counts', fixed_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All suggestion vote counts are consistent';
  END IF;
END $$;