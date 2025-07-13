#!/usr/bin/env node

// Check the actual semifinals structure in the most recent tournament
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentSemifinals() {
  console.log('🔍 Checking current semifinals structure...\n');

  try {
    // Get the most recent tournament
    const { data: recentTournament } = await supabase
      .from('tournaments')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentTournament) {
      console.log('❌ No tournaments found');
      return;
    }

    console.log(`📊 MOST RECENT TOURNAMENT:`);
    console.log(`Name: ${recentTournament.name}`);
    console.log(`Status: ${recentTournament.status}`);
    console.log(`ID: ${recentTournament.id}\n`);

    // Get the semifinals round
    const { data: semifinalRound } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', recentTournament.id)
      .eq('name', 'Semifinals')
      .single();

    if (!semifinalRound) {
      console.log('❌ No Semifinals round found');
      console.log('Checking all rounds:');
      
      const { data: allRounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', recentTournament.id)
        .order('round_number');
        
      if (allRounds && allRounds.length > 0) {
        allRounds.forEach(round => {
          console.log(`  Round ${round.round_number}: ${round.name} (${round.status})`);
        });
      } else {
        console.log('  No rounds found at all');
      }
      return;
    }

    console.log(`📊 SEMIFINALS ROUND:`);
    console.log(`Round Number: ${semifinalRound.round_number}`);
    console.log(`Status: ${semifinalRound.status}\n`);

    // Get semifinals matchups with contestant details
    const { data: semifinals } = await supabase
      .from('matchups')
      .select(`
        *,
        contestant1:contestants!contestant1_id(name, quadrant, seed),
        contestant2:contestants!contestant2_id(name, quadrant, seed),
        winner:contestants!winner_id(name, quadrant, seed)
      `)
      .eq('round_id', semifinalRound.id)
      .order('position');

    if (!semifinals || semifinals.length === 0) {
      console.log('❌ No semifinals matchups found');
      return;
    }

    console.log(`📊 SEMIFINALS MATCHUPS (${semifinals.length} total):`);
    
    // Filter to actual semifinals (should be only 2 for a 64-person tournament)
    const actualSemifinals = semifinals.filter(sf => 
      sf.contestant1 && sf.contestant2 && 
      sf.contestant1.name !== 'TBD' && sf.contestant2.name !== 'TBD'
    );

    if (actualSemifinals.length === 0) {
      console.log('⏳ Semifinals not yet populated with contestants (still TBD vs TBD)');
      console.log(`Total semifinals created: ${semifinals.length}`);
      return;
    }

    console.log(`\nACTUAL POPULATED SEMIFINALS (${actualSemifinals.length}):`);
    
    actualSemifinals.forEach((sf, index) => {
      console.log(`\nSemifinal ${index + 1} (Position ${sf.position}):`);
      console.log(`  ${sf.contestant1.name} (Q${sf.contestant1.quadrant}, Seed ${sf.contestant1.seed})`);
      console.log(`  vs`);
      console.log(`  ${sf.contestant2.name} (Q${sf.contestant2.quadrant}, Seed ${sf.contestant2.seed})`);
      console.log(`  Quadrant Matchup: ${sf.contestant1.quadrant} vs ${sf.contestant2.quadrant}`);
      
      if (sf.winner) {
        console.log(`  Winner: ${sf.winner.name} (Q${sf.winner.quadrant})`);
      } else {
        console.log(`  Status: ${sf.status}`);
      }
    });

    // Analyze the pattern
    if (actualSemifinals.length >= 2) {
      console.log(`\n🔍 FINAL FOUR PATTERN ANALYSIS:`);
      
      const sf1Quadrants = [actualSemifinals[0].contestant1.quadrant, actualSemifinals[0].contestant2.quadrant];
      const sf2Quadrants = [actualSemifinals[1].contestant1.quadrant, actualSemifinals[1].contestant2.quadrant];
      
      console.log(`SF1: Quadrant ${sf1Quadrants[0]} vs Quadrant ${sf1Quadrants[1]}`);
      console.log(`SF2: Quadrant ${sf2Quadrants[0]} vs Quadrant ${sf2Quadrants[1]}`);
      
      // Check for problematic A vs B, C vs D pattern
      const sf1IsAvsB = (sf1Quadrants.includes(1) && sf1Quadrants.includes(2));
      const sf1IsCvsD = (sf1Quadrants.includes(3) && sf1Quadrants.includes(4));
      const sf2IsAvsB = (sf2Quadrants.includes(1) && sf2Quadrants.includes(2));
      const sf2IsCvsD = (sf2Quadrants.includes(3) && sf2Quadrants.includes(4));
      
      if ((sf1IsAvsB && sf2IsCvsD) || (sf1IsCvsD && sf2IsAvsB)) {
        console.log(`\n❌ INCORRECT PATTERN: A vs B and C vs D (adjacent quadrants)`);
        console.log(`   This is the problem you're seeing!`);
      } else if (
        (sf1Quadrants.includes(1) && sf1Quadrants.includes(3)) ||
        (sf1Quadrants.includes(2) && sf1Quadrants.includes(4)) ||
        (sf2Quadrants.includes(1) && sf2Quadrants.includes(3)) ||
        (sf2Quadrants.includes(2) && sf2Quadrants.includes(4))
      ) {
        console.log(`\n✅ CORRECT PATTERN: A vs C and B vs D (crossover quadrants)`);
      } else {
        console.log(`\n❓ UNUSUAL PATTERN: Need to investigate further`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

console.log('🏆 Current Semifinals Checker');
console.log('=' .repeat(50));
checkCurrentSemifinals().catch(console.error);