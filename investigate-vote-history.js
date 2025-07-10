#!/usr/bin/env node

// Investigation script to understand vote history display issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateVoteHistory() {
  const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  console.log('🔍 Investigating vote history issue...\n');

  // Check vote_results table for completed matchups
  console.log('📊 VOTE_RESULTS TABLE (completed matchups):');
  const { data: voteResults, error: voteError } = await supabase
    .from('vote_results')
    .select(`
      matchup_id,
      contestant1_votes,
      contestant2_votes,
      total_votes,
      matchups!inner(
        tournament_id,
        status,
        position,
        rounds!inner(round_number, name, status)
      )
    `)
    .eq('matchups.tournament_id', tournamentId)
    .eq('matchups.status', 'completed');

  if (voteError) {
    console.log(`❌ Error: ${voteError.message}`);
  } else {
    console.log(`Found ${voteResults.length} completed matchups with vote results:`);
    voteResults.forEach(result => {
      console.log(`  Round ${result.matchups.rounds.round_number} Matchup ${result.matchups.position}: ${result.contestant1_votes} vs ${result.contestant2_votes}`);
    });
  }

  // Check how BracketVisualization gets vote counts
  console.log('\n📊 TESTING get_bracket_data FUNCTION:');
  const { data: bracketData, error: bracketError } = await supabase.rpc('get_bracket_data', {
    tournament_uuid: tournamentId
  });

  if (bracketError) {
    console.log(`❌ Error: ${bracketError.message}`);
  } else {
    console.log('✅ get_bracket_data function works');
    if (bracketData && bracketData.length > 0) {
      // Check first round for vote counts
      const firstRound = bracketData.find(round => round.round_number === 1);
      if (firstRound && firstRound.matchups) {
        console.log(`Round 1 has ${firstRound.matchups.length} matchups:`);
        firstRound.matchups.forEach(matchup => {
          const votes = matchup.voteCounts || matchup.vote_counts || {};
          console.log(`  Matchup ${matchup.position}: ${votes.contestant1Votes || votes.contestant1_votes || 0} vs ${votes.contestant2Votes || votes.contestant2_votes || 0}`);
        });
      }
    }
  }

  // Check if there's a mismatch between vote_results and what the UI gets
  console.log('\n🔍 CHECKING FOR DATA INCONSISTENCIES:');
  
  // Get raw matchups data
  const { data: matchups, error: matchupError } = await supabase
    .from('matchups')
    .select('id, position, status, tournament_id, round_id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed');

  if (!matchupError && matchups) {
    console.log(`Found ${matchups.length} completed matchups in matchups table`);
    
    // For each completed matchup, check if vote_results exists
    for (const matchup of matchups) {
      const { data: voteResult } = await supabase
        .from('vote_results')
        .select('contestant1_votes, contestant2_votes, total_votes')
        .eq('matchup_id', matchup.id)
        .single();
        
      if (voteResult) {
        console.log(`  Matchup ${matchup.id}: Has vote_results (${voteResult.contestant1_votes} vs ${voteResult.contestant2_votes})`);
      } else {
        console.log(`  Matchup ${matchup.id}: ❌ NO vote_results found`);
      }
    }
  }
}

investigateVoteHistory().catch(console.error);