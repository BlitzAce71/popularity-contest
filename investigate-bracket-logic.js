#!/usr/bin/env node

// Script to investigate how the bracket generation logic works
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateBracketLogic() {
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';
  
  console.log(`🔍 Investigating bracket generation logic\n`);

  try {
    // Get the current bracket structure by examining positions
    console.log('📊 EXAMINING MATCHUP POSITIONS ACROSS ALL ROUNDS:');
    
    const { data: allMatchups } = await supabase
      .from('matchups')
      .select(`
        id,
        position,
        match_number,
        round_id,
        contestant1_id,
        contestant2_id,
        rounds(round_number, name)
      `)
      .eq('tournament_id', tournamentId)
      .order('rounds.round_number', 'position');

    if (!allMatchups) return;

    // Group by round and analyze position patterns
    const roundMatchups = {};
    allMatchups.forEach(matchup => {
      const roundNum = matchup.rounds.round_number;
      if (!roundMatchups[roundNum]) {
        roundMatchups[roundNum] = [];
      }
      roundMatchups[roundNum].push(matchup);
    });

    // Display structure
    Object.keys(roundMatchups).forEach(roundNum => {
      const matchups = roundMatchups[roundNum];
      const round = matchups[0].rounds;
      console.log(`\nRound ${roundNum} (${round.name}): ${matchups.length} matchups`);
      
      matchups.forEach(matchup => {
        console.log(`  Position ${matchup.position}: Match ${matchup.match_number || 'N/A'} (ID: ${matchup.id.substring(0, 8)}...)`);
      });
    });

    // Look for patterns in how winners advance
    console.log('\n📊 ANALYZING ADVANCEMENT PATTERNS:');
    
    // Look at the structure to understand the bracket progression
    const finalRound = Math.max(...Object.keys(roundMatchups).map(Number));
    const semifinalRound = finalRound - 1;
    const quarterfinalRound = finalRound - 2;
    
    console.log(`Final: Round ${finalRound}`);
    console.log(`Semifinals: Round ${semifinalRound}`);
    console.log(`Quarterfinals: Round ${quarterfinalRound}`);
    
    if (roundMatchups[semifinalRound]) {
      const semifinals = roundMatchups[semifinalRound];
      console.log(`\nSemifinals structure (${semifinals.length} matchups):`);
      semifinals.forEach((sf, index) => {
        console.log(`  Semifinal ${index + 1} (Position ${sf.position}): Will advance to Final`);
      });
    }
    
    if (roundMatchups[quarterfinalRound]) {
      const quarterfinals = roundMatchups[quarterfinalRound];
      console.log(`\nQuarterfinals structure (${quarterfinals.length} matchups):`);
      quarterfinals.forEach((qf, index) => {
        const advancesToSemifinal = Math.ceil((index + 1) / 2);
        console.log(`  Quarterfinal ${index + 1} (Position ${qf.position}): Winner advances to Semifinal ${advancesToSemifinal}`);
      });
      
      // This gives us the critical information!
      console.log('\n🔍 PREDICTED SEMIFINAL STRUCTURE:');
      console.log('  Semifinal 1: Winner of QF1 vs Winner of QF2');
      console.log('  Semifinal 2: Winner of QF3 vs Winner of QF4');
      console.log('\n  This means:');
      console.log('  - QF1 and QF2 feed into Semifinal 1');
      console.log('  - QF3 and QF4 feed into Semifinal 2');
    }

    // Check how contestants are distributed by examining the first few rounds
    console.log('\n📊 EXAMINING INITIAL ROUND CONTESTANT DISTRIBUTION:');
    
    const firstRound = Math.min(...Object.keys(roundMatchups).map(Number));
    const firstRoundMatchups = roundMatchups[firstRound];
    
    if (firstRoundMatchups && firstRoundMatchups.length > 0) {
      console.log(`First round has ${firstRoundMatchups.length} matchups`);
      
      // Get contestant details for first round to see the seeding pattern
      const { data: firstRoundDetails } = await supabase
        .from('matchups')
        .select(`
          position,
          contestant1:contestants!contestant1_id(name, quadrant, seed),
          contestant2:contestants!contestant2_id(name, quadrant, seed)
        `)
        .eq('tournament_id', tournamentId)
        .eq('rounds.round_number', firstRound)
        .order('position');
      
      if (firstRoundDetails) {
        console.log('\nFirst round matchup pattern:');
        firstRoundDetails.slice(0, 8).forEach(matchup => {
          const c1 = matchup.contestant1;
          const c2 = matchup.contestant2;
          if (c1 && c2) {
            console.log(`  Position ${matchup.position}: Q${c1.quadrant}S${c1.seed} vs Q${c2.quadrant}S${c2.seed}`);
          }
        });
        
        // Analyze which quadrants feed into which parts of the bracket
        const quadrantPositions = {};
        firstRoundDetails.forEach(matchup => {
          const c1 = matchup.contestant1;
          const c2 = matchup.contestant2;
          if (c1 && c2) {
            if (!quadrantPositions[c1.quadrant]) quadrantPositions[c1.quadrant] = [];
            if (!quadrantPositions[c2.quadrant]) quadrantPositions[c2.quadrant] = [];
            quadrantPositions[c1.quadrant].push(matchup.position);
            quadrantPositions[c2.quadrant].push(matchup.position);
          }
        });
        
        console.log('\nQuadrant distribution in first round:');
        Object.keys(quadrantPositions).forEach(quadrant => {
          const positions = quadrantPositions[quadrant].sort((a, b) => a - b);
          console.log(`  Quadrant ${quadrant}: Positions ${positions.join(', ')}`);
        });
        
        // This tells us how the bracket flows!
        console.log('\n🔍 BRACKET FLOW ANALYSIS:');
        console.log('Based on position distribution, we can trace how quadrants flow through the bracket.');
        
        // Predict the Final Four issue
        const totalMatchups = firstRoundDetails.length;
        const matchupsPerQuadrant = totalMatchups / 4;
        
        console.log(`\n🚨 POTENTIAL FINAL FOUR ISSUE IDENTIFIED:`);
        console.log(`With ${totalMatchups} first round matchups (${matchupsPerQuadrant} per quadrant section):`);
        console.log(`- Positions 1-${matchupsPerQuadrant} likely feed to one part of bracket`);
        console.log(`- Positions ${matchupsPerQuadrant + 1}-${matchupsPerQuadrant * 2} likely feed to another part`);
        console.log(`- This could cause adjacent quadrants (A vs B, C vs D) instead of crossover (A vs C, B vs D)`);
      }
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🏆 Bracket Logic Investigator');
console.log('=' .repeat(50));
investigateBracketLogic().catch(console.error);