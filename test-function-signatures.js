#!/usr/bin/env node

// Script to test function signatures with real tournament data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunctionSignatures() {
  console.log('🔍 Testing function signatures with real data...\n');
  
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';

  try {
    // Test get_bracket_data with tournament_uuid parameter
    console.log('📊 TESTING get_bracket_data:');
    try {
      const { data: bracketData, error: bracketError } = await supabase.rpc('get_bracket_data', {
        tournament_uuid: tournamentId
      });
      
      if (bracketError) {
        console.log(`❌ get_bracket_data error: ${bracketError.message}`);
      } else {
        console.log('✅ get_bracket_data works!');
        console.log(`   Returned: ${Array.isArray(bracketData) ? 'array' : typeof bracketData} with ${bracketData?.length || 'unknown'} items`);
        
        if (Array.isArray(bracketData) && bracketData.length > 0) {
          console.log('   Sample structure:');
          const sample = bracketData[0];
          Object.keys(sample).forEach(key => {
            console.log(`     ${key}: ${typeof sample[key]}`);
          });
        }
      }
    } catch (err) {
      console.log(`❌ get_bracket_data failed: ${err.message}`);
    }

    // Test generate_single_elimination_bracket
    console.log('\n📊 TESTING generate_single_elimination_bracket:');
    try {
      const { data: genData, error: genError } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: tournamentId
      });
      
      if (genError) {
        console.log(`❌ generate_single_elimination_bracket error: ${genError.message}`);
        console.log('   This might reveal permission requirements or function signature');
      } else {
        console.log('✅ generate_single_elimination_bracket works!');
        console.log(`   Returned: ${typeof genData}`);
      }
    } catch (err) {
      console.log(`❌ generate_single_elimination_bracket failed: ${err.message}`);
    }

    // Test advance_to_next_round  
    console.log('\n📊 TESTING advance_to_next_round:');
    try {
      const { data: advanceData, error: advanceError } = await supabase.rpc('advance_to_next_round', {
        tournament_uuid: tournamentId
      });
      
      if (advanceError) {
        console.log(`❌ advance_to_next_round error: ${advanceError.message}`);
      } else {
        console.log('✅ advance_to_next_round works!');
        console.log(`   Returned: ${typeof advanceData}`);
      }
    } catch (err) {
      console.log(`❌ advance_to_next_round failed: ${err.message}`);
    }

    // Test reset_tournament_bracket
    console.log('\n📊 TESTING reset_tournament_bracket:');
    try {
      const { data: resetData, error: resetError } = await supabase.rpc('reset_tournament_bracket', {
        tournament_uuid: tournamentId
      });
      
      if (resetError) {
        console.log(`❌ reset_tournament_bracket error: ${resetError.message}`);
      } else {
        console.log('✅ reset_tournament_bracket works!');
        console.log(`   Returned: ${typeof resetData}`);
      }
    } catch (err) {
      console.log(`❌ reset_tournament_bracket failed: ${err.message}`);
    }

    // Analyze current bracket structure to understand the flow
    console.log('\n📊 ANALYZING CURRENT BRACKET FLOW:');
    
    // Get all rounds and their matchups
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');
      
    if (rounds) {
      for (const round of rounds) {
        const { data: matchups } = await supabase
          .from('matchups')
          .select('id, position, match_number, contestant1_id, contestant2_id, winner_id, status')
          .eq('round_id', round.id)
          .order('position');
          
        console.log(`\n${round.name} (Round ${round.round_number}):`);
        if (matchups && matchups.length > 0) {
          matchups.forEach(matchup => {
            console.log(`  Position ${matchup.position}: Match ${matchup.match_number} (${matchup.status})`);
            if (matchup.contestant1_id && matchup.contestant2_id) {
              console.log(`    C1: ${matchup.contestant1_id.substring(0, 8)}, C2: ${matchup.contestant2_id.substring(0, 8)}`);
            }
            if (matchup.winner_id) {
              console.log(`    Winner: ${matchup.winner_id.substring(0, 8)}`);
            }
          });
        } else {
          console.log('  No matchups created yet');
        }
      }
    }

  } catch (error) {
    console.error('❌ Function signature testing failed:', error.message);
  }
}

console.log('🔧 Function Signature Tester');
console.log('=' .repeat(50));
testFunctionSignatures().catch(console.error);