## Workflow Practices

- Always commit changes to main branch immediately after creating them.
- **CRITICAL: Always push commits to origin/main** - Vercel deploys from the remote repository, not local commits.
- Never write SQL code without checking the database for the full scope of the code base. Do not assume or hallucinate any database fields, functions, tables, triggers, etc.
- Do not name files "fix" or "finalized" or "confirmed" when writing new code, just name them what they're supposed to accomplish, and possibly with a new version number if there's already a file named like that.
- Always query the supabase database directly with the CLI whenever referencing anything related to the database. Never make assumptions or look at past sql execution files to assume what the database looks like. You should always have a live understanding of the database.
- **Before making any code changes, investigate the full impact on the entire system** - Check dependencies, related functionality, and potential side effects.
- **Use systematic debugging with logging and investigation scripts** rather than making assumptions about what's broken.

## URL and Identifier Handling

- **CRITICAL: All service methods must handle both UUID and slug identifiers** - When implementing slug-based URLs, every service method that accepts a tournament/entity identifier must convert slugs to UUIDs before database operations.
- **Always implement slug-to-UUID conversion helpers** - Create a consistent `getUuidFromIdentifier()` helper method in each service class to handle the conversion logic.
- **Test slug functionality across all services** - URL changes affect multiple service layers (TournamentService, AdminService, VotingService, ContestantService, etc.). Update ALL relevant services simultaneously.
- **Database functions expect UUIDs** - PostgreSQL functions and stored procedures expect UUID parameters, not slugs. Always convert before calling database functions.
- **Frontend routing with slugs requires backend support** - Changing from UUID to slug URLs requires comprehensive backend service updates, not just frontend routing changes.

## UI/UX Standards

- **Never create non-functional UI elements** - Buttons, tabs, pages, or any UI components without working functionality should not exist in the codebase.
- **Remove unnecessary UI clutter** - If stats, buttons, or features don't provide meaningful value, remove them.
- **Every UI element must have a purpose** - No placeholder buttons, mock functionality, or "TODO" UI elements.
- **Hide single-option form fields** - If a dropdown or selection field has only one valid option, remove it from the UI entirely or replace with a hidden input. Don't clutter forms with non-choices.
- **Make automatic behaviors manual** - Avoid automatic actions that users don't explicitly request. Provide buttons for actions like generating dummy data instead of doing it automatically.

## Database Function Development

- **CRITICAL: Never reference files in the repo when coding database changes** - Do not assume or hallucinate anything about the current state of database functions, triggers, tables, or fields.
- **Always request discovery queries first** - Ask the user to run specific queries to understand the current database structure before proposing changes.
- **Create backups before modifying functions** - Always backup existing database functions before applying fixes, especially for critical functions like tournament advancement logic.
- **Use proper PostgreSQL syntax** - Pay attention to PostgreSQL-specific syntax for arrays, records, and variable declarations. Test syntax before recommending.
- **Understand existing logic before changing** - Request to see current function definitions before proposing modifications to understand the existing flow.

## Communication Guidelines

- Do not end your messages to me with "Now everything is fixed" or "That solves your problem" or anything where you're assuming the outcome. Ask me to test or verify or tell me what you changed, but never assume that what you did was the correct answer.
- **Always ask for verification** after implementing changes, especially for functionality that affects user interaction.