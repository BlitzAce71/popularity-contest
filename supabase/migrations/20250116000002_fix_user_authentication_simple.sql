-- ================================================================
-- Migration: Fix User Authentication Issues (Simple Version)
-- Description: Fix user profile creation and deletion without tournament creator dependencies
-- Author: System
-- Date: 2025-01-16
-- ================================================================

-- ================================================================
-- 1. Create User Profile Creation Trigger (Basic Version)
-- ================================================================

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    username,
    first_name,
    last_name,
    is_admin
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'first_name', COALESCE(NEW.raw_user_meta_data->>'firstName', '')),
    COALESCE(NEW.raw_user_meta_data->>'last_name', COALESCE(NEW.raw_user_meta_data->>'lastName', '')),
    false
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- 2. Enhanced User Deletion Function (Basic Version)
-- ================================================================

-- Function to properly delete user from both users table and auth
CREATE OR REPLACE FUNCTION public.delete_user_completely(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  result JSONB;
BEGIN
  -- Check if user exists in users table
  SELECT email INTO user_email
  FROM public.users
  WHERE id = user_uuid;

  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found in users table'
    );
  END IF;

  -- Delete from users table first (this will cascade to related records)
  DELETE FROM public.users WHERE id = user_uuid;

  -- Note: Deleting from auth.users requires admin privileges and should be done
  -- via the Admin API or by a database administrator
  -- For now, we'll return information about the auth record
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_uuid,
    'user_email', user_email,
    'users_table_deleted', true,
    'auth_record_status', 'still_exists_requires_admin_deletion',
    'message', 'User profile deleted. Auth record requires manual deletion by admin.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ================================================================
-- 3. User Profile Recovery Function (Basic Version)
-- ================================================================

-- Function to recover/recreate user profiles for existing auth users
CREATE OR REPLACE FUNCTION public.recover_missing_user_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recovered_count INTEGER := 0;
  auth_user RECORD;
  result JSONB;
BEGIN
  -- Find auth users without profiles
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
      AND au.email_confirmed_at IS NOT NULL -- Only confirmed users
  LOOP
    -- Create missing profile
    INSERT INTO public.users (
      id,
      email,
      username,
      first_name,
      last_name,
      is_admin
    )
    VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'username', SPLIT_PART(auth_user.email, '@', 1)),
      COALESCE(auth_user.raw_user_meta_data->>'first_name', COALESCE(auth_user.raw_user_meta_data->>'firstName', '')),
      COALESCE(auth_user.raw_user_meta_data->>'last_name', COALESCE(auth_user.raw_user_meta_data->>'lastName', '')),
      false
    );
    
    recovered_count := recovered_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'recovered_profiles', recovered_count,
    'message', format('Successfully recovered %s user profiles', recovered_count)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'recovered_profiles', recovered_count
    );
END;
$$;

-- ================================================================
-- 4. User Management Utility Functions
-- ================================================================

-- Function to get auth users without profiles (for debugging)
CREATE OR REPLACE FUNCTION public.get_orphaned_auth_users()
RETURNS TABLE (
  auth_user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  email_confirmed BOOLEAN,
  raw_meta_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    au.created_at,
    au.email_confirmed_at IS NOT NULL,
    au.raw_user_meta_data
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
  ORDER BY au.created_at DESC;
END;
$$;

-- Function to get user profiles without auth records (shouldn't happen but good to check)
CREATE OR REPLACE FUNCTION public.get_orphaned_user_profiles()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  username TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pu.id,
    pu.email::TEXT,
    pu.username::TEXT,
    pu.created_at
  FROM public.users pu
  LEFT JOIN auth.users au ON pu.id = au.id
  WHERE au.id IS NULL
  ORDER BY pu.created_at DESC;
END;
$$;

-- ================================================================
-- 5. Update RLS Policies for Better User Management
-- ================================================================

-- Update users table policies to handle profile creation better
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow automatic profile creation" ON public.users;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile (except admin fields)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing admin status
    is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

-- Allow automatic profile creation by the trigger
CREATE POLICY "Allow automatic profile creation"
  ON public.users FOR INSERT
  WITH CHECK (true); -- This allows the trigger to create profiles

-- ================================================================
-- 6. Verification and Cleanup
-- ================================================================

-- Recover any existing orphaned profiles
SELECT public.recover_missing_user_profiles();

-- Add helpful comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when auth user is created';
COMMENT ON FUNCTION public.delete_user_completely(UUID) IS 'Attempts to delete user from both users table and provides info about auth record';
COMMENT ON FUNCTION public.recover_missing_user_profiles() IS 'Recovers missing user profiles for existing auth users';
COMMENT ON FUNCTION public.get_orphaned_auth_users() IS 'Returns auth users without corresponding user profiles';
COMMENT ON FUNCTION public.get_orphaned_user_profiles() IS 'Returns user profiles without corresponding auth users';

-- ================================================================
-- 7. Verification Queries
-- ================================================================

-- Show current state
DO $$
DECLARE
  auth_count INTEGER;
  users_count INTEGER;
  orphaned_auth INTEGER;
  orphaned_profiles INTEGER;
BEGIN
  -- Count auth users
  SELECT COUNT(*) INTO auth_count FROM auth.users WHERE email_confirmed_at IS NOT NULL;
  
  -- Count user profiles
  SELECT COUNT(*) INTO users_count FROM public.users;
  
  -- Count orphaned auth users
  SELECT COUNT(*) INTO orphaned_auth FROM public.get_orphaned_auth_users();
  
  -- Count orphaned profiles
  SELECT COUNT(*) INTO orphaned_profiles FROM public.get_orphaned_user_profiles();
  
  RAISE NOTICE 'Authentication Status Summary:';
  RAISE NOTICE '- Confirmed auth users: %', auth_count;
  RAISE NOTICE '- User profiles: %', users_count;
  RAISE NOTICE '- Orphaned auth users: %', orphaned_auth;
  RAISE NOTICE '- Orphaned profiles: %', orphaned_profiles;
  
  IF orphaned_auth > 0 THEN
    RAISE NOTICE 'WARNING: Found % auth users without profiles. Run recover_missing_user_profiles() to fix.', orphaned_auth;
  END IF;
  
  IF orphaned_profiles > 0 THEN
    RAISE NOTICE 'WARNING: Found % user profiles without auth records. These should be investigated.', orphaned_profiles;
  END IF;
  
  RAISE NOTICE 'User authentication fixes applied successfully!';
END $$;