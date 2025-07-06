# 🗄️ Database Migration Guide

This guide will walk you through setting up your Supabase database for the Popularity Contest application.

## 📋 Prerequisites

- ✅ Supabase project created at https://swinznpmsszgnhgjipvk.supabase.co
- ✅ Access to Supabase Dashboard
- ✅ SQL Editor access in Supabase

## 🚀 Quick Migration (Recommended)

### Step 1: Run the Complete Migration Script

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `swinznpmsszgnhgjipvk`

2. **Navigate to SQL Editor**
   - In the left sidebar, click **"SQL Editor"**
   - Click **"New query"**

3. **Copy and Execute Migration Script**
   - Open the file `COMPLETE_MIGRATION.sql` in your project
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **"Run"** button

4. **Verify Success**
   - You should see a success message: `"Migration completed successfully!"`
   - Check that all 8 tables were created

### Step 2: Verify Database Setup

1. **Check Tables Created**
   Go to **Table Editor** and verify these tables exist:
   - ✅ `users`
   - ✅ `tournaments` 
   - ✅ `contestants`
   - ✅ `rounds`
   - ✅ `matchups`
   - ✅ `votes`
   - ✅ `vote_drafts`
   - ✅ `results`

2. **Check Storage Buckets**
   Go to **Storage** and verify these buckets exist:
   - ✅ `tournament-images` (public)
   - ✅ `contestant-images` (public) 
   - ✅ `user-avatars` (private)

3. **Test Row Level Security**
   - Go to **Authentication** → **Policies**
   - Verify that RLS policies are enabled for all tables

## 🔧 Manual Migration (If Needed)

If the complete migration script fails, you can run individual migration files:

### Migration Order

Execute these files in order in the SQL Editor:

1. **Users Table**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000001_create_users_table.sql
   ```

2. **Tournaments Table**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000002_create_tournaments_table.sql
   ```

3. **Contestants Table**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000003_create_contestants_table.sql
   ```

4. **Rounds Table**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000004_create_rounds_table.sql
   ```

5. **Matchups Table**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000005_create_matchups_table.sql
   ```

6. **Votes and Results Tables**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000006_create_votes_and_results_tables.sql
   ```

7. **Row Level Security**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000007_enable_row_level_security.sql
   ```

8. **Storage Buckets**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000008_configure_storage_buckets.sql
   ```

9. **Bracket Functions**
   ```sql
   -- Copy contents from: supabase/migrations/20240101000009_create_bracket_functions.sql
   ```

## 🧪 Testing the Database

### Test 1: Create a Test User Profile

```sql
-- This should work after migration
INSERT INTO public.users (
  id, 
  email, 
  username, 
  first_name, 
  last_name, 
  is_admin
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  'testuser',
  'Test',
  'User',
  true
) ON CONFLICT (email) DO NOTHING;
```

### Test 2: Create a Test Tournament

```sql
-- Get the test user ID
WITH test_user AS (
  SELECT id FROM public.users WHERE email = 'test@example.com' LIMIT 1
)
INSERT INTO public.tournaments (
  name,
  description,
  created_by,
  max_contestants
) 
SELECT 
  'Test Tournament',
  'A test tournament to verify database setup',
  test_user.id,
  8
FROM test_user;
```

### Test 3: Verify RLS Policies

```sql
-- This should return the policies count
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## ❌ Troubleshooting

### Common Issues

**Issue: "Extension uuid-ossp not found"**
```sql
-- Solution: Enable the extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Issue: "Permission denied for relation auth.users"**
- Solution: Make sure you're running as a superuser in SQL Editor
- Try running smaller chunks of the migration script

**Issue: "Bucket already exists"**
```sql
-- Solution: Skip bucket creation or update existing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tournament-images', 'tournament-images', true)
ON CONFLICT (id) DO NOTHING;
```

**Issue: "Policy already exists"**
```sql
-- Solution: Drop existing policy first
DROP POLICY IF EXISTS "policy_name" ON table_name;
-- Then create the new policy
```

### Rollback Instructions

If you need to start over:

```sql
-- WARNING: This will delete all data!

-- Drop all policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
-- (repeat for all policies)

-- Drop all tables
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.vote_drafts CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.matchups CASCADE;
DROP TABLE IF EXISTS public.rounds CASCADE;
DROP TABLE IF EXISTS public.contestants CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop storage buckets
DELETE FROM storage.buckets WHERE id IN (
  'tournament-images', 
  'contestant-images', 
  'user-avatars'
);

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_tournament_contestant_count();
DROP FUNCTION IF EXISTS public.update_matchup_vote_counts();
DROP FUNCTION IF EXISTS public.generate_tournament_bracket(UUID);
DROP FUNCTION IF EXISTS public.advance_tournament_round(UUID);
```

## ✅ Verification Checklist

After migration, verify these items:

### Database Structure
- [ ] All 8 tables created successfully
- [ ] All indexes created
- [ ] All foreign key constraints active
- [ ] All triggers active
- [ ] All functions created

### Storage
- [ ] 3 storage buckets created
- [ ] Storage policies applied
- [ ] Bucket permissions correct

### Security
- [ ] RLS enabled on all tables
- [ ] All security policies created
- [ ] User authentication trigger active

### Functions
- [ ] User profile creation trigger works
- [ ] Vote counting functions work
- [ ] Tournament bracket functions available

## 🔄 Next Steps

After successful migration:

1. **Test the Application Connection**
   - Start your development server: `npm run dev`
   - Try registering a new user
   - Check if the user appears in the `users` table

2. **Create Your Admin User**
   - Register through the app
   - Go to Supabase Table Editor → `users` table
   - Find your user and set `is_admin = true`

3. **Test Core Functionality**
   - Create a tournament
   - Add contestants
   - Test the voting system

## 📞 Support

If you encounter issues:

1. **Check Supabase Logs**
   - Go to **Logs** in your Supabase dashboard
   - Look for any error messages

2. **Verify Environment Variables**
   - Ensure your `.env.local` file has correct Supabase URL and key
   - Test the connection with your application

3. **Contact Support**
   - Supabase Discord: https://discord.supabase.com
   - GitHub Issues: Create an issue in your repository

---

**Migration Complete!** 🎉 Your database is now ready for the Popularity Contest application.