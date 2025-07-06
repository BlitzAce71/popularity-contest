# Database Schema Documentation

This document describes the complete database schema for the Popularity Contest tournament voting application.

## Overview

The database is designed to support bracket-style popularity contests with the following key features:
- User authentication and profiles
- Tournament creation and management
- Contestant registration and management
- Bracket generation and progression
- Voting system with weighted votes
- Real-time result tracking
- Image storage for contestants and tournaments

## Entity Relationship Diagram

```
users (1) ──┬── (N) tournaments
            └── (N) votes

tournaments (1) ──┬── (N) contestants
                  ├── (N) rounds
                  └── (N) matchups

rounds (1) ──── (N) matchups

matchups (1) ──┬── (N) votes
               └── (1) vote_results

contestants (N) ──── (N) matchups (via contestant1_id, contestant2_id)
```

## Table Definitions

### 1. users
Extends Supabase auth.users with additional profile information.

```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- Automatically populated via trigger when auth.users record is created
- Supports admin privileges
- Links to Supabase Storage for avatar images

### 2. tournaments
Core tournament definitions and settings.

```sql
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 3 AND LENGTH(name) <= 100),
    description TEXT CHECK (LENGTH(description) <= 1000),
    image_url TEXT,
    status tournament_status DEFAULT 'draft',
    bracket_type bracket_type DEFAULT 'single-elimination',
    size INTEGER NOT NULL CHECK (size >= 4 AND size <= 256 AND (size & (size - 1)) = 0),
    max_contestants INTEGER NOT NULL CHECK (max_contestants >= 4 AND max_contestants <= 256),
    current_contestants INTEGER DEFAULT 0,
    registration_deadline TIMESTAMP WITH TIME ZONE,
    tournament_start_date TIMESTAMP WITH TIME ZONE,
    tournament_end_date TIMESTAMP WITH TIME ZONE,
    voting_duration_hours INTEGER DEFAULT 24,
    is_public BOOLEAN DEFAULT TRUE,
    allow_ties BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Enums:**
- `tournament_status`: 'draft', 'registration', 'active', 'completed', 'cancelled'
- `bracket_type`: 'single-elimination', 'double-elimination', 'round-robin'

**Key Features:**
- Size must be power of 2 for single elimination
- Automatic contestant count tracking
- Status transition validation
- Date ordering constraints

### 3. contestants
Tournament participants and their information.

```sql
CREATE TABLE public.contestants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100),
    description TEXT CHECK (LENGTH(description) <= 500),
    image_url TEXT,
    position INTEGER NOT NULL CHECK (position >= 1),
    seed INTEGER CHECK (seed >= 1),
    eliminated_round INTEGER CHECK (eliminated_round >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    votes_received INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tournament_id, position),
    UNIQUE(tournament_id, name),
    UNIQUE(tournament_id, seed)
);
```

**Key Features:**
- Unique position and name per tournament
- Optional seeding for bracket positioning
- Automatic statistics tracking
- Elimination round tracking

### 4. rounds
Tournament rounds/stages management.

```sql
CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id),
    round_number INTEGER NOT NULL CHECK (round_number >= 1),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 50),
    description TEXT CHECK (LENGTH(description) <= 500),
    status round_status DEFAULT 'upcoming',
    total_matchups INTEGER NOT NULL CHECK (total_matchups >= 1),
    completed_matchups INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tournament_id, round_number)
);
```

**Enums:**
- `round_status`: 'upcoming', 'active', 'completed', 'paused'

**Key Features:**
- Automatic round name generation (Final, Semifinal, etc.)
- Completion tracking based on matchup results
- Status transition validation

### 5. matchups
Individual matches between contestants.

```sql
CREATE TABLE public.matchups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.rounds(id),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id),
    position INTEGER NOT NULL CHECK (position >= 1),
    contestant1_id UUID REFERENCES public.contestants(id),
    contestant2_id UUID REFERENCES public.contestants(id),
    winner_id UUID REFERENCES public.contestants(id),
    status matchup_status DEFAULT 'upcoming',
    contestant1_votes INTEGER DEFAULT 0,
    contestant2_votes INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    is_tie BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(round_id, position)
);
```

**Enums:**
- `matchup_status`: 'upcoming', 'active', 'completed', 'cancelled'

**Key Features:**
- Automatic winner advancement to next round
- Vote count validation and totaling
- Tie handling based on tournament settings
- Position-based bracket organization

### 6. votes
Individual user votes for matchups.

```sql
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    matchup_id UUID NOT NULL REFERENCES public.matchups(id),
    selected_contestant_id UUID NOT NULL REFERENCES public.contestants(id),
    is_admin_vote BOOLEAN DEFAULT FALSE,
    weight INTEGER DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, matchup_id)
);
```

**Key Features:**
- One vote per user per matchup
- Admin votes can have higher weight (1-10)
- Automatic validation of contestant selection
- Timing validation for voting windows

### 7. vote_results
Aggregated voting results per matchup.

```sql
CREATE TABLE public.vote_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchup_id UUID UNIQUE NOT NULL REFERENCES public.matchups(id),
    contestant1_votes INTEGER DEFAULT 0,
    contestant2_votes INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    winner_id UUID REFERENCES public.contestants(id),
    is_tie BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- Real-time vote aggregation via triggers
- Automatic winner determination
- Synchronized with matchup vote counts

## Storage Buckets

### 1. contestant-images
- **Purpose**: Store contestant photos
- **Access**: Public read, authenticated upload
- **Size Limit**: 5MB
- **Allowed Types**: JPEG, PNG, WebP, GIF

### 2. tournament-images
- **Purpose**: Store tournament banner/logo images
- **Access**: Public read, authenticated upload
- **Size Limit**: 5MB
- **Allowed Types**: JPEG, PNG, WebP, GIF

### 3. user-avatars
- **Purpose**: Store user profile pictures
- **Access**: Public read, user-specific upload
- **Size Limit**: 2MB
- **Allowed Types**: JPEG, PNG, WebP

## Row Level Security (RLS) Policies

### Access Control Matrix

| Table | Public Read | User Read | User Write | Creator Manage | Admin Manage |
|-------|-------------|-----------|------------|----------------|--------------|
| users | Basic info only | Own profile | Own profile | - | All users |
| tournaments | Public tournaments | Own tournaments | Create new | Own tournaments | All tournaments |
| contestants | Public tournaments | - | - | Own tournaments | All contestants |
| rounds | Public tournaments | - | - | Own tournaments | All rounds |
| matchups | Public tournaments | - | - | Own tournaments | All matchups |
| votes | - | Own votes | Own votes | View tournament votes | All votes |
| vote_results | Public tournaments | - | - | Own tournaments | All results |

### Key Security Features

1. **User Privacy**: Users can only see their own votes and profile details
2. **Tournament Isolation**: Creators can only manage their own tournaments
3. **Public Access**: Public tournaments are viewable by everyone
4. **Admin Override**: Admins have full access to all data
5. **Voting Integrity**: Users can only vote once per matchup during active periods

## Database Functions

### Tournament Management

- `generate_single_elimination_bracket(tournament_uuid)`: Creates complete bracket structure
- `advance_to_next_round(tournament_uuid)`: Progresses tournament when round completes
- `reset_tournament_bracket(tournament_uuid)`: Resets tournament for testing
- `can_start_tournament(tournament_uuid)`: Validates tournament can begin

### Vote Processing

- `count_matchup_votes(matchup_uuid)`: Calculates vote totals with weights
- `finalize_matchup(matchup_uuid)`: Completes matchup and advances winners
- `update_vote_results()`: Trigger function for real-time vote counting

### Data Retrieval

- `get_tournament_stats(tournament_uuid)`: Comprehensive tournament statistics
- `get_bracket_data(tournament_uuid)`: Complete bracket visualization data

### Utility Functions

- `generate_round_name(size, round_number)`: Creates round names (Final, Semifinal, etc.)
- `generate_unique_filename()`: Creates unique storage filenames
- `cleanup_orphaned_images()`: Removes unused storage files

## Constraints and Validations

### Data Integrity

1. **Tournament Size**: Must be power of 2 (4, 8, 16, 32, 64, 128, 256)
2. **Contestant Limits**: Respects tournament max_contestants setting
3. **Vote Validation**: Ensures contestants are in the matchup being voted on
4. **Status Transitions**: Enforces valid state changes for tournaments/rounds/matchups
5. **Date Ordering**: Validates logical date sequences

### Performance Optimizations

1. **Strategic Indexing**: Optimized for common query patterns
2. **Partitioning Ready**: Tournament-based partitioning possible for large scales
3. **Trigger Efficiency**: Minimal trigger overhead with targeted updates
4. **Query Optimization**: Compound indexes for multi-column filters

## Migration Order

The migrations must be run in the following order:

1. `20240101000001_create_users_table.sql` - Base user profiles
2. `20240101000002_create_tournaments_table.sql` - Tournament definitions
3. `20240101000003_create_contestants_table.sql` - Contestant management
4. `20240101000004_create_rounds_table.sql` - Round structure
5. `20240101000005_create_matchups_table.sql` - Matchup system
6. `20240101000006_create_votes_and_results_tables.sql` - Voting system
7. `20240101000007_enable_row_level_security.sql` - Security policies
8. `20240101000008_configure_storage_buckets.sql` - Image storage
9. `20240101000009_create_bracket_functions.sql` - Tournament logic

## Usage Examples

### Creating a Tournament

```sql
-- 1. Insert tournament
INSERT INTO tournaments (name, description, size, max_contestants, created_by)
VALUES ('Best Movie of 2024', 'Vote for your favorite movie', 8, 8, user_id);

-- 2. Add contestants
INSERT INTO contestants (tournament_id, name, position)
VALUES 
  (tournament_id, 'Dune: Part Two', 1),
  (tournament_id, 'Oppenheimer', 2),
  -- ... more contestants

-- 3. Generate bracket
SELECT generate_single_elimination_bracket(tournament_id);
```

### Casting a Vote

```sql
-- Insert vote (triggers will handle aggregation)
INSERT INTO votes (user_id, matchup_id, selected_contestant_id)
VALUES (user_id, matchup_id, contestant_id);
```

### Getting Tournament Results

```sql
-- Get complete bracket visualization
SELECT get_bracket_data(tournament_id);

-- Get tournament statistics
SELECT get_tournament_stats(tournament_id);
```

This schema provides a robust foundation for running popularity contests with proper security, performance, and data integrity.