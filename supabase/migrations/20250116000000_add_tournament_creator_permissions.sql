-- ================================================================
-- Migration: Add Tournament Creator Permissions
-- Description: Add permission field to allow non-admin users to create tournaments
-- Author: System
-- Date: 2025-01-16
-- ================================================================

-- Add tournament creator permission field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_tournaments BOOLEAN DEFAULT FALSE;

-- Update existing admins to have tournament creation permissions
UPDATE users SET can_create_tournaments = TRUE WHERE is_admin = TRUE;

-- Add index for performance on permission queries
CREATE INDEX IF NOT EXISTS idx_users_can_create_tournaments ON users(can_create_tournaments) WHERE can_create_tournaments = TRUE;

-- Add comment to document the field
COMMENT ON COLUMN users.can_create_tournaments IS 'Grants permission to create and manage tournaments without admin privileges';

-- ================================================================
-- Update RLS Policies for Tournament Creation
-- ================================================================

-- Drop existing tournament creation policy if it exists
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;

-- Create new policy that allows admins OR users with tournament creation permission
CREATE POLICY "Users can create tournaments" ON tournaments
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (
      -- Check if user is admin OR has tournament creation permission
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (is_admin = TRUE OR can_create_tournaments = TRUE)
      )
    )
  );

-- ================================================================
-- Update User Profile Views
-- ================================================================

-- Update the user profile view if it exists to include new permission
DROP VIEW IF EXISTS user_profiles CASCADE;

CREATE VIEW user_profiles AS
SELECT 
  u.id,
  u.email,
  u.username,
  u.first_name,
  u.last_name,
  u.is_admin,
  u.can_create_tournaments,
  u.created_at,
  u.updated_at,
  -- Calculate tournament stats
  COALESCE(t.created_count, 0) as tournaments_created,
  COALESCE(p.participated_count, 0) as tournaments_participated
FROM users u
LEFT JOIN (
  SELECT created_by, COUNT(*) as created_count
  FROM tournaments
  GROUP BY created_by
) t ON u.id = t.created_by
LEFT JOIN (
  SELECT v.user_id, COUNT(DISTINCT m.tournament_id) as participated_count
  FROM votes v
  JOIN matchups m ON v.matchup_id = m.id
  GROUP BY v.user_id
) p ON u.id = p.user_id;

-- Grant access to user profiles view
GRANT SELECT ON user_profiles TO authenticated;

-- ================================================================
-- Migration Verification Queries
-- ================================================================

-- Verify the column was added successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'can_create_tournaments'
  ) THEN
    RAISE NOTICE 'SUCCESS: can_create_tournaments column added to users table';
  ELSE
    RAISE EXCEPTION 'FAILED: can_create_tournaments column not found in users table';
  END IF;
END $$;

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'tournaments' 
    AND policyname = 'Users can create tournaments'
  ) THEN
    RAISE NOTICE 'SUCCESS: Tournament creation policy updated successfully';
  ELSE
    RAISE EXCEPTION 'FAILED: Tournament creation policy not found';
  END IF;
END $$;

-- Show current user permission distribution
SELECT 
  'Permission Summary' as info,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_admin = TRUE) as admin_users,
  COUNT(*) FILTER (WHERE can_create_tournaments = TRUE) as tournament_creators,
  COUNT(*) FILTER (WHERE is_admin = FALSE AND can_create_tournaments = TRUE) as non_admin_creators
FROM users;