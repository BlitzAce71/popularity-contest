#!/usr/bin/env node

// Simple script to check bracket structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBracket() {
  const tournamentId = '36c00774-a65a-482b-a50f-c4b1a09dbf5d';
  
  console.log('🔍 Checking quarterfinals...');
  
  // Get quarterfinals round
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('name', 'Quarterfinals')
    .single();
    
  if (!rounds) {
    console.log('No quarterfinals round found');
    return;
  }
  
  console.log(`Found quarterfinals round: ${rounds.id}`);
  
  // Get quarterfinals matchups
  const { data: matchups } = await supabase
    .from('matchups')
    .select(`
      position,
      contestant1:contestants!contestant1_id(name, quadrant, seed),
      contestant2:contestants!contestant2_id(name, quadrant, seed)
    `)
    .eq('round_id', rounds.id)
    .order('position');
    
  console.log('\n📊 Quarterfinals structure:');
  matchups.forEach(matchup => {
    const c1 = matchup.contestant1;
    const c2 = matchup.contestant2;
    if (c1 && c2) {
      console.log(`  QF${matchup.position}: Q${c1.quadrant} vs Q${c2.quadrant} (${c1.name} vs ${c2.name})`);
    } else {
      console.log(`  QF${matchup.position}: TBD vs TBD`);
    }
  });
  
  // Check current pairing pattern
  if (matchups.length >= 4 && matchups[0].contestant1) {
    console.log('\n🔍 Current bracket pairing pattern:');
    const pattern = matchups.map(m => ({
      position: m.position,
      q1: m.contestant1?.quadrant,
      q2: m.contestant2?.quadrant
    }));
    
    console.log('Pattern:', pattern.map(p => `QF${p.position}:Q${p.q1}vsQ${p.q2}`).join(', '));
    
    // Predict semifinals
    console.log('\n🔮 Predicted semifinals (based on QF winners advancing):');
    console.log(`  SF1: Winner of QF1 vs Winner of QF2`);
    console.log(`  SF2: Winner of QF3 vs Winner of QF4`);
    
    const sf1_quadrants = [pattern[0].q1, pattern[0].q2, pattern[1].q1, pattern[1].q2];
    const sf2_quadrants = [pattern[2].q1, pattern[2].q2, pattern[3].q1, pattern[3].q2];
    
    console.log(`  SF1 would be: [Q${sf1_quadrants.join(',Q')}] pool`);
    console.log(`  SF2 would be: [Q${sf2_quadrants.join(',Q')}] pool`);
    
    // Check if this creates proper crossover
    const hasProperCrossover = 
      (sf1_quadrants.includes(1) && sf1_quadrants.includes(3) && 
       sf2_quadrants.includes(2) && sf2_quadrants.includes(4)) ||
      (sf1_quadrants.includes(2) && sf1_quadrants.includes(4) && 
       sf2_quadrants.includes(1) && sf2_quadrants.includes(3));
       
    if (hasProperCrossover) {
      console.log('  ✅ This creates CORRECT crossover (opposite quadrants can meet in semis)');
    } else {
      console.log('  ❌ This creates INCORRECT pairing (adjacent quadrants would meet)');
    }
  }
}

checkBracket().catch(console.error);