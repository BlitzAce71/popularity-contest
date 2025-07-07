-- =============================================================================
-- COMPLETE DEPLOYMENT: Deploy bracket functions and generate bracket data
-- =============================================================================

-- 1. First deploy the complete bracket generation functions
-- (Run COMPLETE_BRACKET_GENERATION.sql first)

-- 2. Deploy the real get_bracket_data function
-- (Run DEPLOY_BRACKET_DATA.sql second)

-- 3. Generate bracket for your tournament
-- Replace 'cc32fa69-08f6-47be-be20-fc7e014fd9b5' with your actual tournament UUID
SELECT public.generate_single_elimination_bracket('cc32fa69-08f6-47be-be20-fc7e014fd9b5'::UUID);

-- 4. Test the bracket data function
SELECT public.get_bracket_data('cc32fa69-08f6-47be-be20-fc7e014fd9b5'::UUID);