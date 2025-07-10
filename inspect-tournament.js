#!/usr/bin/env node

// Script to inspect the current state of the specific tournament
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTournament() {
  const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  console.log(`🔍 Inspecting tournament: ${tournamentId}\n`);

  try {
    // Check round statuses
    console.log('📊 ROUND STATUSES:');
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');

    if (roundsError) {
      console.log(`❌ Error querying rounds: ${roundsError.message}`);
    } else {
      rounds.forEach(round => {
        console.log(`Round ${round.round_number} (${round.name}): ${round.status}`);
      });
    }

    console.log('\n📊 MATCHUP STATUSES:');
    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select(`
        id,
        round_id,
        match_number,
        position,
        status,
        winner_id,
        contestant1_id,
        contestant2_id,
        rounds!inner(round_number, name, status)
      `)
      .eq('tournament_id', tournamentId)
;

    if (matchupsError) {
      console.log(`❌ Error querying matchups: ${matchupsError.message}`);
    } else {
      let currentRound = null;
      matchups.forEach(matchup => {
        if (currentRound !== matchup.rounds.round_number) {
          currentRound = matchup.rounds.round_number;
          console.log(`\n--- Round ${currentRound} (${matchup.rounds.name}) - Round Status: ${matchup.rounds.status} ---`);
        }
        const hasContestants = matchup.contestant1_id && matchup.contestant2_id;
        const hasWinner = matchup.winner_id ? 'YES' : 'NO';
        console.log(`  Matchup ${matchup.position}: ${matchup.status} | Contestants: ${hasContestants ? 'YES' : 'NO'} | Winner: ${hasWinner}`);
      });
    }

    console.log('\n📊 VOTE RESULTS:');
    const { data: voteResults, error: voteError } = await supabase
      .from('vote_results')
      .select(`
        matchup_id,
        contestant1_votes,
        contestant2_votes,
        total_votes,
        matchups!inner(
          position,
          rounds!inner(round_number, name)
        )
      `)
      .eq('matchups.tournament_id', tournamentId);

    if (voteError) {
      console.log(`❌ Error querying vote results: ${voteError.message}`);
    } else {
      let currentRound = null;
      voteResults.forEach(result => {
        if (currentRound !== result.matchups.rounds.round_number) {
          currentRound = result.matchups.rounds.round_number;
          console.log(`\n--- Round ${currentRound} Vote Results ---`);
        }
        console.log(`  Matchup ${result.matchups.position}: ${result.contestant1_votes} vs ${result.contestant2_votes} (Total: ${result.total_votes})`);
      });
    }

  } catch (error) {
    console.error('❌ Tournament inspection failed:', error.message);
  }
}

console.log('🏆 Tournament State Inspector');
console.log('=' .repeat(50));
inspectTournament().catch(console.error);