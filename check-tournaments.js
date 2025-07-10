#!/usr/bin/env node

// Check what tournaments actually exist
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTournaments() {
  console.log('🔍 Checking what tournaments exist...\n');
  
  // Get all tournaments
  const { data: tournaments, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false });
    
  if (tournamentError) {
    console.log(`❌ Error getting tournaments: ${tournamentError.message}`);
    return;
  }
  
  console.log(`📊 Found ${tournaments.length} tournaments:`);
  tournaments.forEach(t => {
    console.log(`  ${t.id}: "${t.name}" (${t.status})`);
  });
  
  if (tournaments.length > 0) {
    const tournamentId = tournaments[0].id;
    console.log(`\n🔍 Checking data for tournament: ${tournamentId}`);
    
    // Get rounds for this tournament
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');
      
    console.log(`📊 Tournament has ${rounds?.length || 0} rounds:`);
    rounds?.forEach(r => {
      console.log(`  Round ${r.round_number}: ${r.name} (${r.status})`);
    });
    
    // Get matchups for this tournament
    const { data: matchups } = await supabase
      .from('matchups')
      .select('id, round_id, position, status')
      .eq('tournament_id', tournamentId)
      .order('round_id', 'position');
      
    console.log(`📊 Tournament has ${matchups?.length || 0} matchups`);
    
    // Get vote results
    const { data: voteResults } = await supabase
      .from('vote_results')
      .select('matchup_id, contestant1_votes, contestant2_votes')
      .limit(5);
      
    console.log(`📊 Sample vote results (${voteResults?.length || 0} total):`);
    voteResults?.forEach(vr => {
      console.log(`  Matchup ${vr.matchup_id}: ${vr.contestant1_votes} vs ${vr.contestant2_votes}`);
    });
  }
}

checkTournaments().catch(console.error);