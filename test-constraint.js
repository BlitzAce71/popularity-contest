#!/usr/bin/env node

// Test script to check and apply the constraint fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixConstraint() {
  console.log('🔍 Checking current constraint status...\n');
  
  // Try to check constraints (this might not work with anon key)
  try {
    const { data: constraints, error } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name')
      .eq('table_name', 'votes')
      .eq('constraint_type', 'UNIQUE');
    
    if (constraints) {
      console.log('Current constraints:', constraints);
    }
  } catch (e) {
    console.log('Cannot query constraints with anon key (expected)');
  }
  
  // Test the current behavior by trying to create a test scenario
  console.log('\n🧪 Testing admin vote capability...');
  
  // Note: This is just a demonstration - we can't actually apply the constraint
  // with the anon key. The migration needs to be applied via Supabase dashboard
  // or CLI with admin credentials.
  
  console.log(`
📋 To fix the constraint issue, you need to apply this SQL in Supabase dashboard:

-- Drop the existing unique constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_user_matchup_vote;

-- Add new unique constraint that includes is_admin_vote
ALTER TABLE public.votes ADD CONSTRAINT unique_user_matchup_admin_vote 
    UNIQUE (user_id, matchup_id, is_admin_vote);

This will allow admins to have both regular votes AND admin tie-breaker votes.
  `);
}

checkAndFixConstraint().catch(console.error);