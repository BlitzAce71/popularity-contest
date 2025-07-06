# Supabase Database Setup

This directory contains all the database migrations and configuration for the Popularity Contest application.

## Quick Start

1. **Initialize Supabase Project**
   ```bash
   npx supabase init
   npx supabase start
   ```

2. **Run Migrations**
   ```bash
   npx supabase db reset
   ```

3. **Configure Environment Variables**
   ```bash
   # Get your project URL and anon key
   npx supabase status
   
   # Add to your .env file
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## Migration Files

The migrations are numbered sequentially and must be run in order:

| File | Description |
|------|-------------|
| `20240101000001_create_users_table.sql` | User profiles and auth integration |
| `20240101000002_create_tournaments_table.sql` | Tournament definitions and settings |
| `20240101000003_create_contestants_table.sql` | Tournament participants |
| `20240101000004_create_rounds_table.sql` | Tournament rounds/stages |
| `20240101000005_create_matchups_table.sql` | Individual matches |
| `20240101000006_create_votes_and_results_tables.sql` | Voting system |
| `20240101000007_enable_row_level_security.sql` | Security policies |
| `20240101000008_configure_storage_buckets.sql` | Image storage setup |
| `20240101000009_create_bracket_functions.sql` | Tournament logic functions |

## Key Features

### 🔐 Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data and public tournaments
- Tournament creators have full control over their tournaments
- Admins have system-wide access

### 🏆 Tournament Types
- Single elimination brackets
- Support for 4-256 contestants (power of 2)
- Configurable voting duration
- Public/private tournaments

### 🗳️ Voting System
- One vote per user per matchup
- Weighted admin votes (1-10x)
- Real-time vote counting
- Tie handling with tournament settings

### 🖼️ Image Storage
- Contestant photos
- Tournament banners
- User avatars
- Automatic cleanup of orphaned files

### 📊 Analytics
- Real-time tournament statistics
- Vote tracking and history
- Performance metrics
- Bracket visualization data

## Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete documentation of:
- Table definitions and relationships
- Constraints and validations
- RLS policies
- Function documentation
- Usage examples

## Local Development

### Prerequisites
- Docker (for local Supabase)
- Node.js 18+
- Supabase CLI

### Setup Steps

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Start Local Instance**
   ```bash
   supabase start
   ```

3. **Apply Migrations**
   ```bash
   supabase db reset
   ```

4. **Access Dashboard**
   - Studio: http://localhost:54323
   - API: http://localhost:54321
   - Database: postgresql://postgres:postgres@localhost:54322/postgres

### Useful Commands

```bash
# Reset database (applies all migrations)
supabase db reset

# Create new migration
supabase migration new <name>

# Generate types for TypeScript
supabase gen types typescript --local > src/types/supabase.ts

# View logs
supabase logs

# Stop local instance
supabase stop
```

## Production Deployment

### Initial Setup

1. **Create Supabase Project**
   - Go to https://app.supabase.com
   - Create new project
   - Note your project URL and anon key

2. **Link Local to Remote**
   ```bash
   supabase link --project-ref <project-id>
   ```

3. **Push Migrations**
   ```bash
   supabase db push
   ```

### Environment Variables

Add these to your production environment:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=contestant-images
```

### Security Checklist

- [ ] RLS enabled on all tables
- [ ] Storage policies configured
- [ ] API keys secured
- [ ] Database backups enabled
- [ ] SSL certificates valid

## Troubleshooting

### Common Issues

**Migration Errors**
```bash
# Check migration status
supabase migration list

# Repair migration
supabase migration repair <version>
```

**Storage Issues**
```bash
# Check bucket policies
SELECT * FROM storage.buckets;
SELECT * FROM storage.policies;
```

**RLS Problems**
```bash
# Test policies
SELECT auth.uid(); -- Should return user ID
SELECT * FROM users WHERE id = auth.uid(); -- Should return user data
```

**Performance Issues**
```bash
# Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

### Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

## Testing Data

For development, you can populate test data:

```sql
-- Create admin user (run after signing up)
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';

-- Create sample tournament
INSERT INTO tournaments (name, description, size, max_contestants, created_by)
VALUES ('Test Tournament', 'Sample tournament for testing', 8, 8, 
  (SELECT id FROM users WHERE email = 'your-email@example.com'));

-- Add sample contestants
INSERT INTO contestants (tournament_id, name, position) VALUES
  ((SELECT id FROM tournaments WHERE name = 'Test Tournament'), 'Contestant 1', 1),
  ((SELECT id FROM tournaments WHERE name = 'Test Tournament'), 'Contestant 2', 2),
  -- ... add more as needed
```

## Backup Strategy

### Automated Backups
Supabase provides automatic daily backups for Pro plans.

### Manual Backup
```bash
# Export schema and data
pg_dump "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" > backup.sql

# Import backup
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" < backup.sql
```

### Critical Data
- User profiles and authentication data
- Tournament configurations and results
- Vote history for audit trails
- Uploaded images in storage buckets