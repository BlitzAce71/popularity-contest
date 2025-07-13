#!/usr/bin/env node

// Check if there are any working tournaments to understand the correct pattern
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkingTournament() {
  console.log('🔍 Looking for working tournaments to understand correct pattern...\n');

  try {
    // Look for tournaments that have matchups with actual contestants
    const { data: workingMatchups } = await supabase
      .from('matchups')
      .select(`
        tournament_id,
        contestant1_id,
        contestant2_id,
        rounds(tournament_id, name, round_number),
        tournaments(name, status)
      `)
      .not('contestant1_id', 'is', null)
      .not('contestant2_id', 'is', null)
      .limit(5);

    if (workingMatchups && workingMatchups.length > 0) {
      console.log('✅ Found working tournaments with populated matchups:');
      
      const tournamentIds = [...new Set(workingMatchups.map(m => m.tournament_id))];
      
      for (const tournamentId of tournamentIds) {
        const matchupsForTournament = workingMatchups.filter(m => m.tournament_id === tournamentId);
        const tournament = matchupsForTournament[0].tournaments;
        
        console.log(`\n📊 Tournament: ${tournament.name} (${tournament.status})`);
        console.log(`   Found ${matchupsForTournament.length} populated matchups`);
        
        // Get detailed info for this working tournament
        const { data: contestants } = await supabase
          .from('contestants')
          .select('id, name, quadrant, seed')
          .eq('tournament_id', tournamentId)
          .order('quadrant', 'seed');
          
        const { data: firstRoundMatchups } = await supabase
          .from('matchups')
          .select(`
            position, match_number,
            contestant1:contestants!contestant1_id(name, quadrant, seed),
            contestant2:contestants!contestant2_id(name, quadrant, seed),
            rounds(round_number, name)
          `)
          .eq('tournament_id', tournamentId)
          .not('contestant1_id', 'is', null)
          .not('contestant2_id', 'is', null)
          .order('position')
          .limit(4);
          
        if (firstRoundMatchups && firstRoundMatchups.length > 0) {
          console.log(`   First round pattern:`);
          firstRoundMatchups.forEach(m => {
            console.log(`     Match ${m.position}: ${m.contestant1.name} (Q${m.contestant1.quadrant}) vs ${m.contestant2.name} (Q${m.contestant2.quadrant})`);
          });
          
          // Analyze the pattern
          console.log(`   Pattern analysis:`);
          console.log(`     Total contestants: ${contestants?.length || 'unknown'}`);
          console.log(`     Contestants by quadrant:`);
          if (contestants) {
            [1,2,3,4].forEach(q => {
              const quadrantContestants = contestants.filter(c => c.quadrant === q);
              console.log(`       Q${q}: ${quadrantContestants.map(c => c.name).join(', ')}`);
            });
          }
        }
      }
      
    } else {
      console.log('❌ No working tournaments found with populated matchups');
      
      // Check if there are ANY matchups at all
      const { data: anyMatchups } = await supabase
        .from('matchups')
        .select('tournament_id, contestant1_id, contestant2_id')
        .limit(10);
        
      console.log(`Found ${anyMatchups?.length || 0} total matchups in database`);
      
      if (anyMatchups && anyMatchups.length > 0) {
        const populatedCount = anyMatchups.filter(m => m.contestant1_id && m.contestant2_id).length;
        console.log(`  ${populatedCount} have contestants assigned`);
        console.log(`  ${anyMatchups.length - populatedCount} are empty (NULL vs NULL)`);
      }
    }

    // Also check the exact SQL that should be working
    console.log('\n🔧 TESTING MINIMAL CONTESTANT ASSIGNMENT:');
    console.log('The issue is likely in the contestant assignment logic.');
    console.log('Need to debug:');
    console.log('1. Array creation from contestants');
    console.log('2. UPDATE statement execution');  
    console.log('3. Round ID lookup');

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🔍 Working Tournament Checker');
console.log('=' .repeat(50));
checkWorkingTournament().catch(console.error);