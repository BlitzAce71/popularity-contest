## Workflow Practices

- Always commit changes to main branch immediately after creating them.
- **CRITICAL: Always push commits to origin/main** - Vercel deploys from the remote repository, not local commits.
- Never write SQL code without checking the database for the full scope of the code base. Do not assume or hallucinate any database fields, functions, tables, triggers, etc.
- Do not name files "fix" or "finalized" or "confirmed" when writing new code, just name them what they're supposed to accomplish, and possibly with a new version number if there's already a file named like that.
- Always query the supabase database directly with the CLI whenever referencing anything related to the database. Never make assumptions or look at past sql execution files to assume what the database looks like. You should always have a live understanding of the database.
- **Before making any code changes, investigate the full impact on the entire system** - Check dependencies, related functionality, and potential side effects.
- **Use systematic debugging with logging and investigation scripts** rather than making assumptions about what's broken.

## UI/UX Standards

- **Never create non-functional UI elements** - Buttons, tabs, pages, or any UI components without working functionality should not exist in the codebase.
- **Remove unnecessary UI clutter** - If stats, buttons, or features don't provide meaningful value, remove them.
- **Every UI element must have a purpose** - No placeholder buttons, mock functionality, or "TODO" UI elements.

## Communication Guidelines

- Do not end your messages to me with "Now everything is fixed" or "That solves your problem" or anything where you're assuming the outcome. Ask me to test or verify or tell me what you changed, but never assume that what you did was the correct answer.
- **Always ask for verification** after implementing changes, especially for functionality that affects user interaction.