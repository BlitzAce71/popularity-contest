#!/usr/bin/env node

// Check any recent tournament to understand what's happening
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnyTournament() {
  console.log('🔍 Checking recent tournaments to understand the issue...\n');

  try {
    // Get the 3 most recent tournaments
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No tournaments found');
      return;
    }

    console.log(`📊 RECENT TOURNAMENTS:`);
    tournaments.forEach((t, index) => {
      console.log(`${index + 1}. ${t.name} (${t.status}) - ${t.id.substring(0, 8)}...`);
    });

    // Use the most recent one
    const tournament = tournaments[0];
    console.log(`\nInvestigating: ${tournament.name} (${tournament.status})\n`);

    // Check contestants
    const { data: contestants } = await supabase
      .from('contestants')
      .select('id, name, quadrant, seed, is_active')
      .eq('tournament_id', tournament.id)
      .order('quadrant', 'seed');

    console.log(`👥 CONTESTANTS (${contestants?.length || 0}):`);
    if (contestants && contestants.length > 0) {
      contestants.slice(0, 8).forEach(c => {
        console.log(`  ${c.name} (Q${c.quadrant}, Seed ${c.seed}, Active: ${c.is_active})`);
      });
      if (contestants.length > 8) {
        console.log(`  ... and ${contestants.length - 8} more`);
      }
    }

    // Check rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, round_number, name, status')
      .eq('tournament_id', tournament.id)
      .order('round_number');

    console.log(`\n🔄 ROUNDS (${rounds?.length || 0}):`);
    if (rounds && rounds.length > 0) {
      rounds.forEach(r => {
        console.log(`  Round ${r.round_number}: ${r.name} (${r.status})`);
      });
    }

    // Check first round matchups specifically
    if (rounds && rounds.length > 0) {
      const firstRound = rounds[0];
      console.log(`\n⚔️ FIRST ROUND MATCHUPS (${firstRound.name}):`);
      
      const { data: matchups } = await supabase
        .from('matchups')
        .select(`
          id, position, match_number, status,
          contestant1_id, contestant2_id,
          contestant1:contestants!contestant1_id(name, quadrant, seed),
          contestant2:contestants!contestant2_id(name, quadrant, seed)
        `)
        .eq('round_id', firstRound.id)
        .order('position');

      if (matchups && matchups.length > 0) {
        console.log(`Found ${matchups.length} matchups:`);
        matchups.forEach(m => {
          const c1 = m.contestant1 ? `${m.contestant1.name}` : 'NULL';
          const c2 = m.contestant2 ? `${m.contestant2.name}` : 'NULL';
          console.log(`  Match ${m.position}: ${c1} vs ${c2}`);
          
          if (!m.contestant1_id || !m.contestant2_id) {
            console.log(`    ❌ Missing contestant assignment!`);
          }
        });
        
        const populatedMatchups = matchups.filter(m => m.contestant1_id && m.contestant2_id);
        console.log(`\nSUMMARY: ${populatedMatchups.length}/${matchups.length} matchups have contestants assigned`);
        
        if (populatedMatchups.length === 0) {
          console.log('🚨 PROBLEM IDENTIFIED: Matchups exist but no contestants are assigned!');
        }
      } else {
        console.log('❌ No matchups found in first round');
        console.log('🚨 PROBLEM IDENTIFIED: No matchups created at all!');
      }
    }

    // Compare with what function would do
    console.log('\n🔧 COMPARING WITH FUNCTION LOGIC:');
    console.log('Expected contestant assignment logic should:');
    console.log('1. Get contestants ordered by quadrant and seed');
    console.log('2. Pair them up sequentially in matchups');
    console.log('3. Assign to first round matchups');
    
    if (contestants && contestants.length > 0) {
      console.log('\nExpected pairings based on current contestants:');
      for (let i = 0; i < Math.min(contestants.length, 8); i += 2) {
        if (contestants[i + 1]) {
          console.log(`  Match ${(i/2) + 1}: ${contestants[i].name} vs ${contestants[i + 1].name}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🔍 Tournament Status Checker');
console.log('=' .repeat(50));
checkAnyTournament().catch(console.error);