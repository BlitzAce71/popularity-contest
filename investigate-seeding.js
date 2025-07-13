// Investigation script to check current tournament seeding
// Run with: node investigate-seeding.js

import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateSeeding() {
  try {
    console.log('🔍 Investigating current tournament seeding...\n');
    
    // Get active tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('status', 'active')
      .limit(1);
    
    if (tournamentsError) throw tournamentsError;
    
    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No active tournaments found. Please start a tournament first.');
      return;
    }
    
    const tournament = tournaments[0];
    console.log(`📊 Analyzing tournament: ${tournament.name} (${tournament.id})`);
    
    // Get contestants with their seeds and quadrants
    const { data: contestants, error: contestantsError } = await supabase
      .from('contestants')
      .select('id, name, seed, quadrant')
      .eq('tournament_id', tournament.id)
      .eq('is_active', true)
      .order('quadrant, seed');
    
    if (contestantsError) throw contestantsError;
    
    console.log('\n👥 Contestants by quadrant and seed:');
    let currentQuadrant = null;
    contestants.forEach(c => {
      if (c.quadrant !== currentQuadrant) {
        console.log(`\nQuadrant ${c.quadrant}:`);
        currentQuadrant = c.quadrant;
      }
      console.log(`  Seed ${c.seed}: ${c.name}`);
    });
    
    // Get first round matchups
    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select(`
        id, position,
        contestant1:contestants!contestant1_id(name, seed, quadrant),
        contestant2:contestants!contestant2_id(name, seed, quadrant),
        rounds!inner(round_number)
      `)
      .eq('rounds.tournament_id', tournament.id)
      .eq('rounds.round_number', 1)
      .order('position');
    
    if (matchupsError) throw matchupsError;
    
    console.log('\n🥊 First Round Matchups (Current):');
    matchups.forEach((m, i) => {
      if (m.contestant1 && m.contestant2) {
        console.log(`${i + 1}. Seed ${m.contestant1.seed} (${m.contestant1.name}) vs Seed ${m.contestant2.seed} (${m.contestant2.name})`);
        console.log(`   Quadrants: ${m.contestant1.quadrant} vs ${m.contestant2.quadrant}`);
      }
    });
    
    console.log('\n💡 Analysis:');
    console.log('   Current seeding appears to match consecutive seeds (1 vs 2, 3 vs 4, etc.)');
    console.log('   Proper tournament seeding should be (1 vs N, 2 vs N-1, etc.)');
    console.log('   where N is the highest seed in each quadrant.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigateSeeding();