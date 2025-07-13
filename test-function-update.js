#!/usr/bin/env node

// Test if we can update the bracket generation function
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunctionUpdate() {
  console.log('🔧 Testing if we can update the bracket function...\n');

  try {
    // Try to execute a simple SQL function creation to test permissions
    const testSQL = `
      CREATE OR REPLACE FUNCTION test_permissions_check()
      RETURNS TEXT AS $$
      BEGIN
        RETURN 'Function creation works';
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { data, error } = await supabase.rpc('sql', { query: testSQL });
    
    if (error) {
      console.log('❌ Cannot create functions via RPC:');
      console.log(`   Error: ${error.message}`);
      console.log('\n📋 MANUAL FIX REQUIRED:');
      console.log('   You need to apply the SQL fix manually in Supabase Studio');
      console.log('   → Go to Supabase Studio → SQL Editor');
      console.log('   → Copy the SQL from FIX_FINAL_FOUR_BRACKET.md');
      console.log('   → Execute the CREATE OR REPLACE FUNCTION statement');
    } else {
      console.log('✅ Function creation permissions available!');
      console.log('   I can try to apply the fix automatically...');
    }

  } catch (err) {
    console.log('❌ Cannot execute SQL directly:');
    console.log(`   Error: ${err.message}`);
    console.log('\n📋 MANUAL FIX REQUIRED:');
    console.log('   The bracket generation function needs to be updated manually');
    console.log('   Steps:');
    console.log('   1. Open Supabase Studio for your project');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy the SQL fix from FIX_FINAL_FOUR_BRACKET.md');
    console.log('   4. Execute the CREATE OR REPLACE FUNCTION statement');
    console.log('   5. Test with a new tournament');
  }

  // Let's also check what the current tournament structure looks like
  console.log('\n🔍 CHECKING CURRENT TOURNAMENT STRUCTURE:');
  
  // Get the most recent tournament
  const { data: recentTournament } = await supabase
    .from('tournaments')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentTournament) {
    console.log(`Most recent tournament: ${recentTournament.name} (${recentTournament.status})`);
    
    // Check if it has semifinals
    const { data: semifinals } = await supabase
      .from('matchups')
      .select(`
        position, match_number,
        contestant1:contestants!contestant1_id(name, quadrant),
        contestant2:contestants!contestant2_id(name, quadrant),
        round:rounds(name, round_number)
      `)
      .eq('tournament_id', recentTournament.id)
      .eq('rounds.name', 'Semifinals');

    if (semifinals && semifinals.length > 0) {
      console.log('\nSemifinals structure in most recent tournament:');
      semifinals.forEach((sf, index) => {
        const q1 = sf.contestant1?.quadrant || 'TBD';
        const q2 = sf.contestant2?.quadrant || 'TBD';
        console.log(`  SF${index + 1}: Quadrant ${q1} vs Quadrant ${q2}`);
      });
      
      // Check if this shows the problem
      if (semifinals.length >= 2) {
        const sf1Quadrants = [semifinals[0].contestant1?.quadrant, semifinals[0].contestant2?.quadrant];
        const sf2Quadrants = [semifinals[1].contestant1?.quadrant, semifinals[1].contestant2?.quadrant];
        
        const hasAvsB = (sf1Quadrants.includes(1) && sf1Quadrants.includes(2)) || (sf2Quadrants.includes(1) && sf2Quadrants.includes(2));
        const hasCvsD = (sf1Quadrants.includes(3) && sf1Quadrants.includes(4)) || (sf2Quadrants.includes(3) && sf2Quadrants.includes(4));
        
        if (hasAvsB && hasCvsD) {
          console.log('\n❌ CONFIRMED: Problem still exists - showing A vs B, C vs D pattern');
          console.log('   The database function has NOT been updated yet');
        } else {
          console.log('\n✅ Pattern looks correct now');
        }
      }
    } else {
      console.log('\nNo semifinals found - tournament may not have progressed that far yet');
    }
  }
}

console.log('🔧 Function Update Test');
console.log('=' .repeat(50));
testFunctionUpdate().catch(console.error);