#!/usr/bin/env node

// Script to analyze bracket structure and predict Final Four pairing
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeBracketStructure() {
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';
  
  console.log(`🔍 Analyzing bracket structure for tournament: ${tournamentId}\n`);

  try {
    // Get all rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');

    // Get all matchups for all rounds
    const { data: allMatchups } = await supabase
      .from('matchups')
      .select(`
        *,
        rounds(round_number, name),
        contestant1:contestants!contestant1_id(name, quadrant, seed),
        contestant2:contestants!contestant2_id(name, quadrant, seed)
      `)
      .eq('tournament_id', tournamentId)
      .order('rounds.round_number', 'position');

    if (!allMatchups) return;

    // Group matchups by round
    const matchupsByRound = {};
    allMatchups.forEach(matchup => {
      const roundNum = matchup.rounds.round_number;
      if (!matchupsByRound[roundNum]) {
        matchupsByRound[roundNum] = [];
      }
      matchupsByRound[roundNum].push(matchup);
    });

    // Analyze each round structure
    Object.keys(matchupsByRound).forEach(roundNum => {
      const matchups = matchupsByRound[roundNum];
      const round = rounds.find(r => r.round_number == roundNum);
      
      console.log(`\n📊 ${round.name.toUpperCase()} (Round ${roundNum}) - ${matchups.length} matchups:`);
      
      matchups.forEach((matchup, index) => {
        const c1 = matchup.contestant1;
        const c2 = matchup.contestant2;
        
        if (c1 && c2) {
          console.log(`  Matchup ${matchup.position}: ${c1.name} (Q${c1.quadrant}, S${c1.seed}) vs ${c2.name} (Q${c2.quadrant}, S${c2.seed})`);
        } else {
          console.log(`  Matchup ${matchup.position}: TBD vs TBD`);
        }
      });

      // Analyze pairing patterns for this round
      if (matchups.length > 0 && matchups[0].contestant1 && matchups[0].contestant2) {
        console.log(`\n  🔍 Pattern analysis for ${round.name}:`);
        
        const quadrantPairs = matchups.map(m => ({
          q1: m.contestant1?.quadrant,
          q2: m.contestant2?.quadrant,
          position: m.position
        })).filter(p => p.q1 && p.q2);

        quadrantPairs.forEach(pair => {
          console.log(`    Position ${pair.position}: Quadrant ${pair.q1} vs Quadrant ${pair.q2}`);
        });

        // Check if this is a semifinals or quarterfinals round
        if (round.name.toLowerCase().includes('semifinal') && quadrantPairs.length >= 2) {
          const isCorrectCrossover = checkCrossoverPattern(quadrantPairs);
          if (isCorrectCrossover) {
            console.log('    ✅ CORRECT: Standard tournament crossover pattern');
          } else {
            console.log('    ❌ INCORRECT: Adjacent pairing instead of crossover');
          }
        }
      }
    });

    // Now let's predict the Final Four structure by looking at the quarterfinals
    const quarterfinalsRound = rounds.find(r => r.name.toLowerCase().includes('quarterfinal'));
    if (quarterfinalsRound) {
      console.log(`\n🔮 PREDICTING FINAL FOUR STRUCTURE:`);
      const quarterfinalMatchups = matchupsByRound[quarterfinalsRound.round_number];
      
      if (quarterfinalMatchups && quarterfinalMatchups.length === 4) {
        console.log('Based on quarterfinals structure:');
        quarterfinalMatchups.forEach((matchup, index) => {
          console.log(`  Quarterfinal ${index + 1} (Position ${matchup.position}): Winner advances to Semifinal ${Math.ceil((index + 1) / 2)}`);
        });

        // Predict semifinal pairings
        console.log('\nPredicted semifinal pairings:');
        console.log(`  Semifinal 1: Winner of QF1 vs Winner of QF2`);
        console.log(`  Semifinal 2: Winner of QF3 vs Winner of QF4`);

        // Analyze what quadrants would meet
        if (quarterfinalMatchups[0].contestant1 && quarterfinalMatchups[0].contestant2) {
          const qf1_quadrants = [quarterfinalMatchups[0].contestant1.quadrant, quarterfinalMatchups[0].contestant2.quadrant];
          const qf2_quadrants = [quarterfinalMatchups[1].contestant1?.quadrant, quarterfinalMatchups[1].contestant2?.quadrant];
          const qf3_quadrants = [quarterfinalMatchups[2].contestant1?.quadrant, quarterfinalMatchups[2].contestant2?.quadrant];
          const qf4_quadrants = [quarterfinalMatchups[3].contestant1?.quadrant, quarterfinalMatchups[3].contestant2?.quadrant];

          console.log(`\nQuadrant flow:`);
          console.log(`  Semifinal 1: [Q${qf1_quadrants.join(' or Q')}] vs [Q${qf2_quadrants.join(' or Q')}]`);
          console.log(`  Semifinal 2: [Q${qf3_quadrants.join(' or Q')}] vs [Q${qf4_quadrants.join(' or Q')}]`);

          // Check if this would result in correct crossover
          const wouldBeCrossover = 
            (qf1_quadrants.includes(1) && qf2_quadrants.includes(3)) ||
            (qf1_quadrants.includes(3) && qf2_quadrants.includes(1)) ||
            (qf3_quadrants.includes(2) && qf4_quadrants.includes(4)) ||
            (qf3_quadrants.includes(4) && qf4_quadrants.includes(2));

          if (wouldBeCrossover) {
            console.log('  ✅ This would create CORRECT crossover pattern (A vs C, B vs D)');
          } else {
            console.log('  ❌ This would create INCORRECT adjacent pattern (A vs B, C vs D)');
          }
        }
      }
    }

    // Try to examine the database function
    console.log(`\n🔍 EXAMINING DATABASE FUNCTIONS:`);
    try {
      // Check if we can see the function definition
      const { data: functions } = await supabase
        .from('pg_proc')
        .select('proname, prosrc')
        .like('proname', '%bracket%');
      
      if (functions && functions.length > 0) {
        functions.forEach(func => {
          console.log(`Function: ${func.proname}`);
          if (func.prosrc) {
            console.log('Source code snippet:');
            console.log(func.prosrc.substring(0, 500) + '...');
          }
        });
      }
    } catch (error) {
      console.log('Cannot access function definitions from this account level');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

function checkCrossoverPattern(quadrantPairs) {
  if (quadrantPairs.length < 2) return false;
  
  // Standard crossover should be A vs C, B vs D (or variations)
  // Check if we have proper crossover (opposite quadrants meeting)
  for (let i = 0; i < quadrantPairs.length; i++) {
    const pair = quadrantPairs[i];
    const isOppositePair = 
      (pair.q1 === 1 && pair.q2 === 3) || (pair.q1 === 3 && pair.q2 === 1) ||
      (pair.q1 === 2 && pair.q2 === 4) || (pair.q1 === 4 && pair.q2 === 2);
    
    if (!isOppositePair) {
      return false;
    }
  }
  
  return true;
}

console.log('🏆 Bracket Structure Analyzer');
console.log('=' .repeat(50));
analyzeBracketStructure().catch(console.error);