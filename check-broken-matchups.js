#!/usr/bin/env node

// Check what's actually happening with matchup generation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrokenMatchups() {
  console.log('🔍 Investigating broken matchup generation...\n');

  try {
    // Get the most recent tournament that was started
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tournament) {
      console.log('❌ No active tournaments found to investigate');
      return;
    }

    console.log(`📊 INVESTIGATING TOURNAMENT:`);
    console.log(`ID: ${tournament.id}`);
    console.log(`Name: ${tournament.name}`);
    console.log(`Status: ${tournament.status}\n`);

    // Check contestants
    console.log('👥 CONTESTANTS:');
    const { data: contestants } = await supabase
      .from('contestants')
      .select('id, name, quadrant, seed, is_active')
      .eq('tournament_id', tournament.id)
      .order('quadrant', 'seed');

    if (contestants && contestants.length > 0) {
      console.log(`Found ${contestants.length} contestants:`);
      contestants.forEach(c => {
        console.log(`  ${c.name} (Q${c.quadrant}, Seed ${c.seed}, Active: ${c.is_active})`);
      });
    } else {
      console.log('❌ No contestants found');
    }

    // Check rounds
    console.log('\n🔄 ROUNDS:');
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, round_number, name, status')
      .eq('tournament_id', tournament.id)
      .order('round_number');

    if (rounds && rounds.length > 0) {
      console.log(`Found ${rounds.length} rounds:`);
      rounds.forEach(r => {
        console.log(`  Round ${r.round_number}: ${r.name} (${r.status})`);
      });
    } else {
      console.log('❌ No rounds found');
      return;
    }

    // Check matchups for each round
    console.log('\n⚔️ MATCHUPS:');
    for (const round of rounds) {
      const { data: matchups } = await supabase
        .from('matchups')
        .select(`
          id, position, match_number, status,
          contestant1_id, contestant2_id,
          contestant1:contestants!contestant1_id(name, quadrant, seed),
          contestant2:contestants!contestant2_id(name, quadrant, seed)
        `)
        .eq('round_id', round.id)
        .order('position');

      console.log(`\n${round.name} (Round ${round.round_number}):`);
      if (matchups && matchups.length > 0) {
        console.log(`  Found ${matchups.length} matchups:`);
        matchups.forEach(m => {
          const c1 = m.contestant1 ? `${m.contestant1.name} (Q${m.contestant1.quadrant})` : 'NULL';
          const c2 = m.contestant2 ? `${m.contestant2.name} (Q${m.contestant2.quadrant})` : 'NULL';
          console.log(`    Match ${m.match_number}: ${c1} vs ${c2} (${m.status})`);
          console.log(`      Contestant IDs: ${m.contestant1_id || 'NULL'} vs ${m.contestant2_id || 'NULL'}`);
        });
      } else {
        console.log('  ❌ No matchups found for this round');
      }
    }

    // Check what the current generate function actually does
    console.log('\n🔧 TESTING CURRENT FUNCTION BEHAVIOR:');
    
    // Test with a simple call to see what happens
    try {
      console.log('Testing generate_single_elimination_bracket function...');
      const { data, error } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: tournament.id
      });
      
      if (error) {
        console.log('❌ Function failed:');
        console.log(`   ${error.message}`);
      } else {
        console.log('✅ Function executed');
        
        // Check what it created/modified
        const { data: newRounds } = await supabase
          .from('rounds')
          .select('id, round_number, name')
          .eq('tournament_id', tournament.id)
          .order('round_number');
          
        const { data: newMatchups } = await supabase
          .from('matchups')
          .select('id, position, contestant1_id, contestant2_id')
          .eq('tournament_id', tournament.id)
          .limit(5);
          
        console.log(`   Rounds after function: ${newRounds?.length || 0}`);
        console.log(`   Matchups after function: ${newMatchups?.length || 0}`);
        console.log(`   First few matchups have contestants: ${newMatchups?.filter(m => m.contestant1_id && m.contestant2_id).length || 0}`);
      }
    } catch (err) {
      console.log('❌ Function call failed:');
      console.log(`   ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🐛 Broken Matchup Investigator');
console.log('=' .repeat(50));
checkBrokenMatchups().catch(console.error);