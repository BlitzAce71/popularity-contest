#!/usr/bin/env node

// Script to query raw table data to understand the actual structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryRawTables() {
  console.log('🔍 Querying raw table data...\n');
  
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';

  try {
    // Check tournament info
    console.log('📊 TOURNAMENT INFO:');
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();
      
    if (tournament) {
      console.log(`Name: ${tournament.name}`);
      console.log(`Status: ${tournament.status}`);
      console.log(`Max contestants: ${tournament.max_contestants}`);
      console.log(`Quadrant names: ${tournament.quadrant_names ? tournament.quadrant_names.join(', ') : 'None'}`);
    }

    // Check rounds
    console.log('\n📊 ROUNDS:');
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');
      
    if (rounds && rounds.length > 0) {
      rounds.forEach(round => {
        console.log(`Round ${round.round_number}: ${round.name} (${round.status})`);
      });
    } else {
      console.log('❌ No rounds found');
    }

    // Check matchups with contestant details  
    console.log('\n📊 MATCHUPS WITH CONTESTANTS:');
    const { data: matchups } = await supabase
      .from('matchups')
      .select(`
        *,
        contestant1:contestants!contestant1_id(name, quadrant, seed),
        contestant2:contestants!contestant2_id(name, quadrant, seed),
        winner:contestants!winner_id(name, quadrant, seed),
        round:rounds(round_number, name, status)
      `)
      .eq('tournament_id', tournamentId)
      .order('round_id', 'position');
      
    if (matchups && matchups.length > 0) {
      let currentRound = null;
      matchups.forEach(matchup => {
        // Group by round
        if (currentRound !== matchup.round?.name) {
          currentRound = matchup.round?.name;
          console.log(`\n--- ${currentRound} (Round ${matchup.round?.round_number}) ---`);
        }
        
        console.log(`Position ${matchup.position}, Match ${matchup.match_number} (${matchup.status}):`);
        
        if (matchup.contestant1) {
          console.log(`  C1: ${matchup.contestant1.name} (Q${matchup.contestant1.quadrant}, Seed ${matchup.contestant1.seed})`);
        } else {
          console.log(`  C1: TBD`);
        }
        
        if (matchup.contestant2) {
          console.log(`  C2: ${matchup.contestant2.name} (Q${matchup.contestant2.quadrant}, Seed ${matchup.contestant2.seed})`);
        } else {
          console.log(`  C2: TBD`);
        }
        
        if (matchup.winner) {
          console.log(`  Winner: ${matchup.winner.name} (Q${matchup.winner.quadrant})`);
        }
      });
      
      // Analyze the pattern specifically for quarterfinals and semifinals
      console.log('\n🔍 BRACKET PATTERN ANALYSIS:');
      
      const quarterfinals = matchups.filter(m => m.round?.name === 'Quarterfinals');
      const semifinals = matchups.filter(m => m.round?.name === 'Semifinals');
      
      if (quarterfinals.length > 0) {
        console.log('\nQuarterfinals pattern:');
        quarterfinals.forEach((qf, index) => {
          if (qf.contestant1 && qf.contestant2) {
            console.log(`QF${index + 1}: Quadrant ${qf.contestant1.quadrant} vs Quadrant ${qf.contestant2.quadrant}`);
          } else {
            console.log(`QF${index + 1}: TBD vs TBD`);
          }
        });
      }
      
      if (semifinals.length > 0) {
        console.log('\nSemifinals pattern:');
        semifinals.forEach((sf, index) => {
          if (sf.contestant1 && sf.contestant2) {
            console.log(`SF${index + 1}: Quadrant ${sf.contestant1.quadrant} vs Quadrant ${sf.contestant2.quadrant}`);
          } else {
            console.log(`SF${index + 1}: TBD vs TBD`);
          }
        });
        
        // Check if this is the incorrect A vs B, C vs D pattern
        if (semifinals.length >= 2) {
          const sf1Quadrants = [semifinals[0].contestant1?.quadrant, semifinals[0].contestant2?.quadrant].filter(q => q);
          const sf2Quadrants = [semifinals[1].contestant1?.quadrant, semifinals[1].contestant2?.quadrant].filter(q => q);
          
          console.log('\n🚨 FINAL FOUR PATTERN CHECK:');
          console.log(`SF1 quadrants: ${sf1Quadrants.join(' vs ')}`);
          console.log(`SF2 quadrants: ${sf2Quadrants.join(' vs ')}`);
          
          // Check for the problematic A vs B, C vs D pattern
          const hasAvsB = (sf1Quadrants.includes(1) && sf1Quadrants.includes(2)) || (sf2Quadrants.includes(1) && sf2Quadrants.includes(2));
          const hasCvsD = (sf1Quadrants.includes(3) && sf1Quadrants.includes(4)) || (sf2Quadrants.includes(3) && sf2Quadrants.includes(4));
          
          if (hasAvsB && hasCvsD) {
            console.log('❌ CONFIRMED: This is the INCORRECT A vs B, C vs D pattern!');
          } else if ((sf1Quadrants.includes(1) && sf1Quadrants.includes(3)) || (sf2Quadrants.includes(1) && sf2Quadrants.includes(3))) {
            console.log('✅ This appears to be the CORRECT A vs C, B vs D pattern');
          } else {
            console.log('❓ Pattern is unclear or different from expected');
          }
        }
      }
      
    } else {
      console.log('❌ No matchups found');
    }

    // Check contestants by quadrant
    console.log('\n📊 CONTESTANTS BY QUADRANT:');
    const { data: contestants } = await supabase
      .from('contestants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('quadrant', 'seed');
      
    if (contestants && contestants.length > 0) {
      const quadrants = [1, 2, 3, 4];
      quadrants.forEach(q => {
        const quadrantContestants = contestants.filter(c => c.quadrant === q);
        console.log(`Quadrant ${q}: ${quadrantContestants.length} contestants`);
        if (quadrantContestants.length > 0) {
          console.log(`  Top seed: ${quadrantContestants[0].name} (Seed ${quadrantContestants[0].seed})`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Query failed:', error.message);
  }
}

console.log('📊 Raw Table Data Query');
console.log('=' .repeat(50));
queryRawTables().catch(console.error);