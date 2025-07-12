#!/usr/bin/env node

// Script to check how the bracket flow is structured
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBracketFlow() {
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';
  
  console.log(`🔍 Checking bracket flow for tournament: ${tournamentId}\n`);

  try {
    // Get quarterfinals structure
    console.log('📊 QUARTERFINALS STRUCTURE:');
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');

    const quarterfinalsRound = rounds.find(r => r.name === 'Quarterfinals');
    
    if (quarterfinalsRound) {
      const { data: quarterfinals } = await supabase
        .from('matchups')
        .select(`
          *,
          contestant1:contestants!contestant1_id(name, quadrant, seed),
          contestant2:contestants!contestant2_id(name, quadrant, seed)
        `)
        .eq('round_id', quarterfinalsRound.id)
        .order('position');

      if (quarterfinals) {
        console.log('Quarterfinals setup:');
        quarterfinals.forEach((matchup, index) => {
          console.log(`QF${index + 1} (Position ${matchup.position}):`);
          console.log(`  Next matchup position: ${matchup.next_matchup_position || 'Not set'}`);
          if (matchup.contestant1 && matchup.contestant2) {
            console.log(`  Would be: Q${matchup.contestant1.quadrant} vs Q${matchup.contestant2.quadrant}`);
          }
        });
      }
    }

    // Get semifinals structure  
    console.log('\n📊 SEMIFINALS STRUCTURE:');
    const semifinalsRound = rounds.find(r => r.name === 'Semifinals');
    
    if (semifinalsRound) {
      const { data: semifinals } = await supabase
        .from('matchups')
        .select('*')
        .eq('round_id', semifinalsRound.id)
        .order('position');

      if (semifinals) {
        console.log('Semifinals setup:');
        semifinals.forEach((matchup, index) => {
          console.log(`SF${index + 1} (Position ${matchup.position}):`);
          console.log(`  Next matchup position: ${matchup.next_matchup_position || 'Not set'}`);
        });
      }
    }

    // Check bracket generation logic by looking at position patterns
    console.log('\n📊 POSITION FLOW ANALYSIS:');
    
    for (const round of rounds) {
      const { data: matchups } = await supabase
        .from('matchups')
        .select('position, next_matchup_position')
        .eq('round_id', round.id)
        .order('position');
        
      if (matchups && matchups.length > 0) {
        console.log(`${round.name} (Round ${round.round_number}):`);
        matchups.forEach(matchup => {
          console.log(`  Position ${matchup.position} → Next: ${matchup.next_matchup_position || 'Final'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

console.log('🏆 Bracket Flow Checker');
console.log('=' .repeat(50));
checkBracketFlow().catch(console.error);