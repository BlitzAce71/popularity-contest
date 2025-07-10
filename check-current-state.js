#!/usr/bin/env node

// Check actual current state of the tournament
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentState() {
  const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  console.log('🔍 Checking actual current state...\n');

  // Check rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_number');

  console.log('📊 ROUNDS:');
  rounds.forEach(round => {
    console.log(`  Round ${round.round_number} (${round.name}): ${round.status}`);
  });

  // Check ALL matchups regardless of status
  const { data: allMatchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_id', 'position');

  console.log('\n📊 ALL MATCHUPS:');
  let currentRoundId = null;
  allMatchups.forEach(matchup => {
    if (currentRoundId !== matchup.round_id) {
      currentRoundId = matchup.round_id;
      const round = rounds.find(r => r.id === matchup.round_id);
      console.log(`\n--- Round ${round?.round_number} (${round?.name}) ---`);
    }
    console.log(`  Matchup ${matchup.position}: status=${matchup.status}, winner=${!!matchup.winner_id}`);
  });

  // Check all vote_results
  const { data: allVoteResults } = await supabase
    .from('vote_results')
    .select('*');

  console.log(`\n📊 ALL VOTE_RESULTS: ${allVoteResults.length} total records`);
  allVoteResults.forEach(result => {
    console.log(`  Matchup ${result.matchup_id}: ${result.contestant1_votes} vs ${result.contestant2_votes}`);
  });

  // Check if votes table has any data
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .limit(10);

  console.log(`\n📊 VOTES TABLE: ${votes.length} sample records`);
  votes.forEach(vote => {
    console.log(`  Vote: matchup=${vote.matchup_id}, contestant=${vote.selected_contestant_id}`);
  });
}

checkCurrentState().catch(console.error);