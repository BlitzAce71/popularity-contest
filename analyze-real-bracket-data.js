#!/usr/bin/env node

// Script to analyze the actual bracket data structure to understand the flow
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeRealBracketData() {
  console.log('🔍 Analyzing real bracket data structure...\n');
  
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';

  try {
    // Get the actual bracket data
    const { data: bracketData, error } = await supabase.rpc('get_bracket_data', {
      tournament_uuid: tournamentId
    });
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }
    
    console.log('📊 FULL BRACKET DATA STRUCTURE:');
    console.log(`Rounds found: ${bracketData.length}`);
    
    bracketData.forEach((round, index) => {
      console.log(`\n--- Round ${round.round_number}: ${round.round_name} (${round.round_status}) ---`);
      
      if (round.matchups && Array.isArray(round.matchups)) {
        console.log(`Matchups: ${round.matchups.length}`);
        
        round.matchups.forEach((matchup, matchupIndex) => {
          console.log(`  Matchup ${matchupIndex + 1}:`);
          console.log(`    ID: ${matchup.id?.substring(0, 8) || 'N/A'}`);
          console.log(`    Position: ${matchup.position || 'N/A'}`);
          console.log(`    Match Number: ${matchup.match_number || 'N/A'}`);
          console.log(`    Status: ${matchup.status || 'N/A'}`);
          
          if (matchup.contestant1) {
            console.log(`    Contestant 1: ${matchup.contestant1.name} (Q${matchup.contestant1.quadrant}, Seed ${matchup.contestant1.seed})`);
          } else {
            console.log(`    Contestant 1: TBD`);
          }
          
          if (matchup.contestant2) {
            console.log(`    Contestant 2: ${matchup.contestant2.name} (Q${matchup.contestant2.quadrant}, Seed ${matchup.contestant2.seed})`);
          } else {
            console.log(`    Contestant 2: TBD`);
          }
          
          if (matchup.winner) {
            console.log(`    Winner: ${matchup.winner.name} (Q${matchup.winner.quadrant})`);
          }
          
          console.log(''); // Empty line for readability
        });
      } else {
        console.log('  No matchups data');
      }
    });
    
    // Analyze the quarterfinals and semifinals specifically
    const quarterfinals = bracketData.find(r => r.round_name === 'Quarterfinals');
    const semifinals = bracketData.find(r => r.round_name === 'Semifinals');
    
    if (quarterfinals && quarterfinals.matchups) {
      console.log('\n🔍 QUARTERFINALS ANALYSIS:');
      quarterfinals.matchups.forEach((qf, index) => {
        if (qf.contestant1 && qf.contestant2) {
          console.log(`QF${index + 1} (Position ${qf.position}): Q${qf.contestant1.quadrant} vs Q${qf.contestant2.quadrant}`);
        } else {
          console.log(`QF${index + 1} (Position ${qf.position}): TBD vs TBD`);
        }
      });
    }
    
    if (semifinals && semifinals.matchups) {
      console.log('\n🔍 SEMIFINALS ANALYSIS:');
      semifinals.matchups.forEach((sf, index) => {
        if (sf.contestant1 && sf.contestant2) {
          console.log(`SF${index + 1} (Position ${sf.position}): Q${sf.contestant1.quadrant} vs Q${sf.contestant2.quadrant}`);
        } else {
          console.log(`SF${index + 1} (Position ${sf.position}): TBD vs TBD`);
        }
      });
      
      // Check if we can predict the pattern
      console.log('\n🔮 PREDICTED FINAL FOUR PATTERN:');
      if (quarterfinals && quarterfinals.matchups && quarterfinals.matchups.length >= 4) {
        console.log('Based on quarterfinals structure:');
        console.log('Current advancement logic appears to be:');
        console.log('- SF1: QF1 winner vs QF2 winner');  
        console.log('- SF2: QF3 winner vs QF4 winner');
        
        // Check if this creates the wrong pattern
        const qf1Quadrants = [quarterfinals.matchups[0]?.contestant1?.quadrant, quarterfinals.matchups[0]?.contestant2?.quadrant];
        const qf2Quadrants = [quarterfinals.matchups[1]?.contestant1?.quadrant, quarterfinals.matchups[1]?.contestant2?.quadrant];
        
        console.log(`QF1 involves quadrants: ${qf1Quadrants.filter(q => q).join(', ')}`);
        console.log(`QF2 involves quadrants: ${qf2Quadrants.filter(q => q).join(', ')}`);
        
        if (qf1Quadrants.includes(1) && qf2Quadrants.includes(2)) {
          console.log('❌ This would create A vs B pattern - INCORRECT!');
        } else if (qf1Quadrants.includes(1) && qf2Quadrants.includes(3)) {
          console.log('✅ This would create A vs C pattern - CORRECT!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

console.log('📊 Real Bracket Data Analyzer');
console.log('=' .repeat(50));
analyzeRealBracketData().catch(console.error);