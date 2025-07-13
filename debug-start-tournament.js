#!/usr/bin/env node

// Debug script to test what happens when starting a tournament
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugStartTournament() {
  console.log('🔍 Debugging Start Tournament functionality...\n');

  try {
    // Get the most recent tournament in draft/registration status
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status, current_contestants')
      .in('status', ['draft', 'registration'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tournament) {
      console.log('❌ No tournament in draft/registration status found');
      console.log('Creating a test tournament to debug...');
      // Could create a test tournament here if needed
      return;
    }

    console.log(`📊 FOUND TOURNAMENT TO TEST:`);
    console.log(`ID: ${tournament.id}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Status: ${tournament.status}`);
    console.log(`Current contestants: ${tournament.current_contestants || 0}\n`);

    // Test if generate_single_elimination_bracket function exists and works
    console.log('🔧 TESTING generate_single_elimination_bracket function:');
    
    try {
      const { data, error } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: tournament.id
      });
      
      if (error) {
        console.log('❌ Function call failed:');
        console.log(`   Error code: ${error.code}`);
        console.log(`   Error message: ${error.message}`);
        console.log(`   Error details: ${error.details}`);
        console.log(`   Error hint: ${error.hint}`);
        
        if (error.message.includes('find the function')) {
          console.log('\n💡 DIAGNOSIS: Function does not exist');
          console.log('   → The SQL fix from ADVANCEMENT_LOGIC_FIX.md was not applied');
          console.log('   → Or the function was dropped but not recreated');
        } else if (error.message.includes('permission') || error.message.includes('policy')) {
          console.log('\n💡 DIAGNOSIS: Permission issue');
          console.log('   → Function exists but user lacks permissions to execute it');
        } else {
          console.log('\n💡 DIAGNOSIS: Function exists but has an error');
          console.log('   → The SQL fix may have syntax errors or logic issues');
        }
      } else {
        console.log('✅ Function executed successfully!');
        console.log(`   Returned: ${typeof data}`);
        
        // Check if rounds and matchups were created
        const { data: rounds } = await supabase
          .from('rounds')
          .select('id, name, round_number')
          .eq('tournament_id', tournament.id)
          .order('round_number');
          
        if (rounds && rounds.length > 0) {
          console.log(`   Created ${rounds.length} rounds:`);
          rounds.forEach(round => {
            console.log(`     Round ${round.round_number}: ${round.name}`);
          });
        } else {
          console.log('   ⚠️ No rounds were created - function may have failed silently');
        }
      }
    } catch (err) {
      console.log('❌ Unexpected error calling function:');
      console.log(`   ${err.message}`);
    }

    // Test the can_start_tournament check
    console.log('\n🔧 TESTING can_start_tournament check:');
    try {
      const { data: canStart, error: checkError } = await supabase.rpc('can_start_tournament', {
        tournament_uuid: tournament.id
      });
      
      if (checkError) {
        console.log('❌ can_start_tournament failed:');
        console.log(`   Error: ${checkError.message}`);
      } else {
        console.log(`✅ can_start_tournament result: ${canStart}`);
        if (!canStart) {
          console.log('   This might be why Start Tournament button is disabled/failing');
        }
      }
    } catch (err) {
      console.log('❌ can_start_tournament function missing or broken:');
      console.log(`   ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

console.log('🐛 Start Tournament Debugger');
console.log('=' .repeat(50));
debugStartTournament().catch(console.error);