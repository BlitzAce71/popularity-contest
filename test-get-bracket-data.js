#!/usr/bin/env node

// Test what get_bracket_data actually returns
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGetBracketData() {
  const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  console.log('🔍 Testing get_bracket_data function...\n');

  const { data, error } = await supabase.rpc('get_bracket_data', {
    tournament_uuid: tournamentId
  });

  if (error) {
    console.log(`❌ Error: ${error.message}`);
  } else {
    console.log('✅ get_bracket_data works');
    console.log(`Returned ${data?.length || 0} rounds\n`);
    
    if (data && data.length > 0) {
      data.forEach(round => {
        console.log(`Round ${round.round_number} (${round.round_name}): ${round.round_status}`);
        if (round.matchups && round.matchups.length > 0) {
          round.matchups.forEach(matchup => {
            const votes = matchup.voteCounts || matchup.vote_counts;
            if (votes) {
              console.log(`  Matchup ${matchup.position}: ${votes.contestant1Votes || votes.contestant1_votes || 0} vs ${votes.contestant2Votes || votes.contestant2_votes || 0}`);
            } else {
              console.log(`  Matchup ${matchup.position}: NO VOTE DATA`);
            }
          });
        }
        console.log('');
      });
    }
  }
}

testGetBracketData().catch(console.error);