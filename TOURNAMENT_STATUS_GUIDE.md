# Tournament Status Guide

## Overview

Tournaments in the Popularity Contest system progress through a structured lifecycle with distinct statuses that control what actions can be performed and what users can see.

## Tournament Status Lifecycle

### 1. Draft Status
**Purpose**: Initial tournament setup and contestant management

**Characteristics**:
- Tournament is visible only to the creator and admins
- Creator can add, edit, and delete contestants
- Creator can modify tournament settings (name, description, quadrant names)
- Bracket is not yet generated
- No voting is possible

**Requirements to Progress**:
- Must have at least 2 contestants added
- All contestants must be properly seeded within their quadrants

**Actions Available**:
- ✅ Add/edit/delete contestants
- ✅ Modify tournament settings
- ✅ Set quadrant names
- ✅ Delete tournament
- ➡️ **Advance to Registration** (if ≥2 contestants)

---

### 2. Registration Status  
**Purpose**: Open tournament for public participation and final adjustments

**Characteristics**:
- Tournament becomes visible to all users (if marked as public)
- Shows as "Registration Open" to public viewers
- Creator can still add more contestants up to the maximum limit
- Bracket preview is available but voting hasn't started
- Users can see tournament details and contestant lineup

**What Happens**:
- Tournament appears in public tournament listings
- Non-authenticated users see "Sign In to Join" prompt
- Authenticated users can view tournament details
- Contestant registration may be opened (future feature)

**Actions Available**:
- ✅ Continue adding contestants (up to max limit)
- ✅ Edit existing contestants
- ✅ Modify tournament settings
- ➡️ **Start Tournament** → Active status
- ⬅️ **Back to Draft** (if more setup needed)

---

### 3. Active Status
**Purpose**: Tournament is live with active voting

**Characteristics**:
- Bracket is generated and matches are created
- Voting is enabled for active matchups
- Tournament is highly visible to all users
- No more contestant changes allowed
- Real-time vote counting and results

**What Happens**:
- Bracket visualization shows all matchups
- Users can vote on active matches
- Vote counts are displayed in real-time
- Tournament progresses round by round
- Only active round matchups accept votes

**Actions Available**:
- ✅ View live bracket with vote counts
- ✅ Vote on active matchups (authenticated users)
- ✅ View tournament statistics
- ❌ No contestant modifications allowed
- ❌ No tournament setting changes
- ➡️ **Complete Tournament** (when all matches done)

---

### 4. Completed Status
**Purpose**: Tournament has finished with final results

**Characteristics**:
- All voting has concluded
- Winner is determined and displayed
- Tournament becomes archived but viewable
- Complete historical record is preserved

**What Happens**:
- Champion is displayed prominently
- Final bracket shows all results
- Vote statistics are frozen
- Tournament remains viewable for reference

**Actions Available**:
- ✅ View final results and champion
- ✅ View complete bracket history
- ✅ View final statistics
- ❌ No voting allowed
- ❌ No modifications possible

---

### 5. Cancelled Status
**Purpose**: Tournament was terminated before completion

**Characteristics**:
- Tournament stopped before natural completion
- May preserve partial results
- Creator or admin decision to halt tournament

---

## Status Transition Rules

```
DRAFT → REGISTRATION → ACTIVE → COMPLETED
  ↑         ↓
  ← - - - - -
  (Back to Draft)
```

### Draft to Registration
- **Requirement**: Minimum 2 contestants
- **Trigger**: Tournament creator clicks "Open Registration"
- **Effect**: Tournament becomes publicly visible

### Registration to Active  
- **Requirement**: Tournament creator ready to start
- **Trigger**: Tournament creator clicks "Start Tournament"
- **Effect**: Bracket generated, voting begins

### Registration to Draft
- **Requirement**: Creator needs more setup time
- **Trigger**: Tournament creator clicks "Back to Draft"  
- **Effect**: Tournament becomes private again

### Active to Completed
- **Requirement**: All matches completed OR creator manually ends
- **Trigger**: Tournament creator clicks "Complete Tournament"
- **Effect**: Final results locked, champion declared

## User Experience by Status

### Public Users (Not Logged In)
- **Draft**: Cannot see tournament
- **Registration**: Can view tournament, prompted to "Sign In to Join"
- **Active**: Can view live bracket and results, cannot vote
- **Completed**: Can view final results

### Authenticated Users
- **Draft**: Cannot see tournament (unless creator/admin)
- **Registration**: Can view tournament details and contestants
- **Active**: Can vote on active matchups, view live results
- **Completed**: Can view final results and statistics

### Tournament Creators
- **Draft**: Full control - add contestants, modify settings
- **Registration**: Can add contestants, start tournament, or go back to draft
- **Active**: Can view tournament progress, complete tournament
- **Completed**: Can view final results

### Admins
- **All Statuses**: Full visibility and control over all tournaments

## Technical Implementation

### Database
- Tournament `status` field: `ENUM('draft', 'registration', 'active', 'completed', 'cancelled')`
- Status changes logged for audit trail
- RLS policies enforce visibility rules

### Frontend
- Status-specific UI components and actions
- Real-time status updates
- Status-based routing and permissions

### API
- `updateTournamentStatus()` with validation
- Status transition rules enforced server-side
- Webhook notifications for status changes (future feature)

## Best Practices

### For Tournament Creators
1. **Draft Phase**: Take time to set up contestants properly
2. **Registration Phase**: Use this to build audience before starting
3. **Active Phase**: Monitor voting and engagement
4. **Completion**: Archive results for future reference

### For Platform Administrators
1. Monitor tournaments stuck in draft/registration
2. Provide support for status transitions
3. Ensure proper bracket generation on status changes
4. Maintain audit logs of status changes

## Future Enhancements

- **Self-Registration**: Allow users to join tournaments during registration
- **Scheduled Start**: Auto-transition from registration to active at set time
- **Pause/Resume**: Temporarily pause active tournaments
- **Tournament Templates**: Quick setup for common tournament types
- **Notification System**: Alert users of status changes