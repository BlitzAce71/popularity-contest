# Continuation Prompt for Popularity Contest Tournament System

## Context Summary
You're working on a React/TypeScript tournament management system with Supabase backend. The app allows users to create popularity contest tournaments with quadrant-based bracket seeding, voting functionality, and admin management features.

## Current Issue to Address
**Console errors with tie-breaking system**: The admin tie-breaking functionality is trying to query a `results` table that doesn't exist, causing 406 errors every 30 seconds. The errors look like:

```
GET .../results?select=*&matchup_id=... 406 (Not Acceptable)
Error: JSON object requested, multiple (or no) rows returned
```

## Technical Details

### Error Location
- **Component**: `/src/components/admin/TieBreakerPanel.tsx`
- **Service**: `VotingService.getTieBreakingOpportunities()` and `getMatchupResults()` in `/src/services/voting.ts`
- **Issue**: Queries `results` table that doesn't exist

### System Architecture
- **Frontend**: React/TypeScript with Vite
- **Backend**: Supabase PostgreSQL 
- **Database**: Has `tournaments`, `users`, `contestants`, `rounds`, `matchups`, `votes` tables
- **Missing**: `results` table for vote aggregation

### Key Files
- `/src/services/voting.ts` - Contains tie-breaking logic
- `/src/components/admin/TieBreakerPanel.tsx` - Admin interface
- `/supabase/migrations/` - Database schema files

## Repository Context
- **Main branch**: All recent changes committed and pushed
- **Working directory**: `/home/taylormwitt/popularity-contest`
- **Git status**: Clean, up to date with remote
- **Admin authentication**: Working correctly
- **Tournament creation**: Admin-only, fully functional

## Additional Notes
- The core tournament functionality (creating, viewing, voting) works
- Tournament images are now displaying correctly 
- The system expects both regular users and admin users, with proper role-based access control