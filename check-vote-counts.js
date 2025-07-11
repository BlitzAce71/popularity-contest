#!/usr/bin/env node

// Check vote counts with and without admin votes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function compareVoteCounts() {
  console.log('🔍 Comparing vote counts with and without admin votes...\n');
  
  // Get a sample matchup with admin votes
  const { data: adminVotes } = await supabase
    .from('votes')
    .select('matchup_id')
    .eq('is_admin_vote', true)
    .limit(1);
    
  if (!adminVotes || adminVotes.length === 0) {
    console.log('No admin votes found');
    return;
  }
  
  const matchupId = adminVotes[0].matchup_id;
  console.log(`Testing matchup: ${matchupId}\n`);
  
  // Get all votes for this matchup
  const { data: allVotes } = await supabase
    .from('votes')
    .select('selected_contestant_id, is_admin_vote')
    .eq('matchup_id', matchupId);
    
  // Get vote_results table data
  const { data: voteResults } = await supabase
    .from('vote_results')
    .select('*')
    .eq('matchup_id', matchupId)
    .single();
    
  console.log('📊 VOTE_RESULTS TABLE DATA:');
  console.log(`Contestant 1: ${voteResults.contestant1_votes} votes`);
  console.log(`Contestant 2: ${voteResults.contestant2_votes} votes`);
  console.log(`Total: ${voteResults.total_votes} votes`);
  console.log(`Winner: ${voteResults.winner_id}`);
  console.log('');
  
  console.log('📊 ACTUAL VOTES BREAKDOWN:');
  const regularVotes = allVotes.filter(v => !v.is_admin_vote);
  const adminVotesList = allVotes.filter(v => v.is_admin_vote);
  
  console.log(`Regular votes: ${regularVotes.length}`);
  console.log(`Admin votes: ${adminVotesList.length}`);
  console.log(`Total votes: ${allVotes.length}`);
  console.log('');
  
  // Count by contestant excluding admin votes
  const contestant1Regular = regularVotes.filter(v => v.selected_contestant_id === voteResults.winner_id || 
    allVotes.filter(av => av.selected_contestant_id === v.selected_contestant_id).length > 1).length;
  
  console.log('📊 CORRECTED COUNTS (excluding admin votes):');
  console.log('This is what the UI should show for vote counts and percentages');
}

compareVoteCounts().catch(console.error);