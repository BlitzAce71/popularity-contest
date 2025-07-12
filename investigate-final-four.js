#!/usr/bin/env node

// Script to investigate Final Four bracket structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateFinalFour() {
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';
  
  console.log(`🔍 Investigating Final Four structure for tournament: ${tournamentId}\n`);

  try {
    // Get tournament info
    console.log('📊 TOURNAMENT INFO:');
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();
    
    console.log(`Tournament: ${tournament.name} (${tournament.status})`);
    console.log(`Quadrant names: ${tournament.quadrant_names ? tournament.quadrant_names.join(', ') : 'None set'}`);

    // Get contestants with quadrants and seeds
    console.log('\n📊 CONTESTANTS BY QUADRANT:');
    const { data: contestants } = await supabase
      .from('contestants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('quadrant', 'seed');

    if (contestants) {
      const quadrants = [1, 2, 3, 4];
      quadrants.forEach(q => {
        const quadrantContestants = contestants.filter(c => c.quadrant === q);
        console.log(`Quadrant ${q}: ${quadrantContestants.length} contestants`);
        quadrantContestants.slice(0, 3).forEach(c => {
          console.log(`  - Seed ${c.seed}: ${c.name}`);
        });
        if (quadrantContestants.length > 3) {
          console.log(`  ... and ${quadrantContestants.length - 3} more`);
        }
      });
    }

    // Get rounds structure
    console.log('\n📊 ROUNDS STRUCTURE:');
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');

    rounds.forEach(round => {
      console.log(`Round ${round.round_number}: ${round.name} (${round.status})`);
    });

    // Focus on Semifinals (should be round 5 based on the previous output)
    const semifinalRound = rounds.find(r => r.name === 'Semifinals' || r.round_number === 5);
    if (semifinalRound) {
      console.log(`\n📊 SEMIFINALS MATCHUPS (Round ${semifinalRound.round_number}):`);
      
      const { data: semifinals } = await supabase
        .from('matchups')
        .select(`
          *,
          contestant1:contestants!contestant1_id(name, quadrant, seed),
          contestant2:contestants!contestant2_id(name, quadrant, seed)
        `)
        .eq('round_id', semifinalRound.id)
        .order('position');

      if (semifinals) {
        semifinals.forEach((matchup, index) => {
          const c1 = matchup.contestant1;
          const c2 = matchup.contestant2;
          console.log(`Semifinal ${index + 1} (Position ${matchup.position}):`);
          if (c1 && c2) {
            console.log(`  ${c1.name} (Q${c1.quadrant}, Seed ${c1.seed}) vs ${c2.name} (Q${c2.quadrant}, Seed ${c2.seed})`);
            console.log(`  This is: Quadrant ${c1.quadrant} vs Quadrant ${c2.quadrant}`);
          } else {
            console.log(`  TBD vs TBD (not yet determined)`);
          }
        });

        // Analyze the pairing pattern
        console.log('\n🔍 PAIRING ANALYSIS:');
        if (semifinals.length >= 2) {
          const matchup1 = semifinals[0];
          const matchup2 = semifinals[1];
          
          if (matchup1.contestant1 && matchup1.contestant2 && matchup2.contestant1 && matchup2.contestant2) {
            const q1_m1 = matchup1.contestant1.quadrant;
            const q2_m1 = matchup1.contestant2.quadrant;
            const q1_m2 = matchup2.contestant1.quadrant;
            const q2_m2 = matchup2.contestant2.quadrant;
            
            console.log(`Current pattern: (Q${q1_m1} vs Q${q2_m1}) and (Q${q1_m2} vs Q${q2_m2})`);
            
            // Check if this is correct crossover (should be A vs C, B vs D)
            const isCorrectCrossover = 
              (q1_m1 === 1 && q2_m1 === 3 && q1_m2 === 2 && q2_m2 === 4) ||
              (q1_m1 === 3 && q2_m1 === 1 && q1_m2 === 4 && q2_m2 === 2) ||
              (q1_m1 === 2 && q2_m1 === 4 && q1_m2 === 1 && q2_m2 === 3) ||
              (q1_m1 === 4 && q2_m1 === 2 && q1_m2 === 3 && q2_m2 === 1);
            
            const isIncorrectPattern = 
              (q1_m1 === 1 && q2_m1 === 2 && q1_m2 === 3 && q2_m2 === 4) ||
              (q1_m1 === 2 && q2_m1 === 1 && q1_m2 === 4 && q2_m2 === 3);
            
            if (isCorrectCrossover) {
              console.log('✅ CORRECT: This follows standard tournament crossover (A vs C, B vs D)');
            } else if (isIncorrectPattern) {
              console.log('❌ INCORRECT: This is adjacent pairing (A vs B, C vs D) - should be crossover!');
            } else {
              console.log('❓ UNKNOWN: Pairing pattern needs analysis');
            }
          }
        }
      }
    }

    // Check the bracket generation function if available
    console.log('\n📊 CHECKING BRACKET GENERATION FUNCTION:');
    try {
      const { data: bracketData } = await supabase.rpc('get_bracket_data', {
        tournament_uuid: tournamentId
      });
      
      if (bracketData && Array.isArray(bracketData)) {
        const semifinalData = bracketData.find(round => round.round_name === 'Semifinals');
        if (semifinalData && semifinalData.matchups) {
          console.log('Bracket data shows semifinals structure:');
          semifinalData.matchups.forEach((matchup, index) => {
            console.log(`  Semifinal ${index + 1}: ${matchup.contestant1?.name || 'TBD'} vs ${matchup.contestant2?.name || 'TBD'}`);
          });
        }
      }
    } catch (error) {
      console.log(`❌ Could not call get_bracket_data: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🏆 Final Four Structure Investigator');
console.log('=' .repeat(50));
investigateFinalFour().catch(console.error);