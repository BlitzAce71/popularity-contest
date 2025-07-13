#!/usr/bin/env node

// Debug the exact button disable condition
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugButtonDisable() {
  console.log('🔍 Debugging Start Tournament button disable condition...\n');

  try {
    // Get the most recent tournament
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status, current_contestants, max_contestants')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tournament) {
      console.log('❌ No tournaments found');
      return;
    }

    console.log(`📊 TOURNAMENT DATA:`);
    console.log(`ID: ${tournament.id}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Status: ${tournament.status}`);
    console.log(`Max contestants: ${tournament.max_contestants}`);
    console.log(`Current contestants: ${tournament.current_contestants}`);
    console.log(`Current contestants type: ${typeof tournament.current_contestants}`);
    console.log(`Current contestants === null: ${tournament.current_contestants === null}`);
    console.log(`Current contestants === undefined: ${tournament.current_contestants === undefined}`);

    // Test the button disable condition
    const statusLoading = false; // Assume not loading for this test
    const disableCondition = statusLoading || (tournament.current_contestants || 0) < 2;
    
    console.log(`\n🔧 BUTTON DISABLE CONDITION:`);
    console.log(`statusLoading: ${statusLoading}`);
    console.log(`(tournament.current_contestants || 0): ${(tournament.current_contestants || 0)}`);
    console.log(`(tournament.current_contestants || 0) < 2: ${(tournament.current_contestants || 0) < 2}`);
    console.log(`FINAL DISABLED STATE: ${disableCondition}`);
    
    if (disableCondition) {
      console.log(`\n❌ BUTTON IS DISABLED!`);
      if (statusLoading) {
        console.log(`   Reason: statusLoading is true`);
      }
      if ((tournament.current_contestants || 0) < 2) {
        console.log(`   Reason: current_contestants (${tournament.current_contestants}) is less than 2`);
      }
    } else {
      console.log(`\n✅ BUTTON SHOULD BE ENABLED`);
    }

    // Also check if this tournament should show the start button at all
    console.log(`\n🔄 BUTTON VISIBILITY:`);
    console.log(`Tournament status: ${tournament.status}`);
    console.log(`Should show Start Tournament button: ${tournament.status === 'draft' || tournament.status === 'registration'}`);

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

console.log('🐛 Button Disable Condition Debugger');
console.log('=' .repeat(50));
debugButtonDisable().catch(console.error);