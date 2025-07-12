#!/usr/bin/env node

// Test what get_bracket_data actually returns
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read environment variables from .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, value] = line.split('=', 2);
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('Using Supabase Key:', supabaseKey ? 'SET' : 'NOT SET');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGetBracketData() {
  // First, let's find tournaments that exist
  console.log('🔍 Finding tournaments with data...\n');
  const { data: tournaments } = await supabase.from('tournaments').select('*').limit(5);
  
  if (tournaments && tournaments.length > 0) {
    console.log('Found tournaments:');
    tournaments.forEach(t => {
      console.log(`- ${t.id}: ${t.name} (${t.status})`);
    });
    console.log('');
  }
  
  // Try the first tournament
  const tournamentId = tournaments?.[0]?.id || '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  // Also check the raw matchups table
  console.log('🔍 Checking raw matchups data...\n');
  const { data: rawMatchups } = await supabase
    .from('matchups')
    .select(`
      *,
      round:rounds(*),
      contestant1:contestants!contestant1_id(*),
      contestant2:contestants!contestant2_id(*),
      winner:contestants!winner_id(*)
    `)
    .eq('rounds.tournament_id', tournamentId);

  if (rawMatchups) {
    console.log('Raw matchups from database:');
    rawMatchups.forEach(m => {
      console.log(`  Matchup ${m.id}: status=${m.status}, winner_id=${m.winner_id}, c1_votes=${m.contestant1_votes}, c2_votes=${m.contestant2_votes}`);
    });
    console.log('');
  }

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
            console.log(`  Matchup ${matchup.position}:`);
            console.log(`    Status: ${matchup.status}`);
            console.log(`    Contestant1: ${matchup.contestant1?.name || 'TBD'}`);
            console.log(`    Contestant2: ${matchup.contestant2?.name || 'TBD'}`);
            console.log(`    Winner: ${matchup.winner?.name || 'No winner yet'} (ID: ${matchup.winner?.id || 'None'})`);
            if (votes) {
              console.log(`    Votes: ${votes.contestant1Votes || votes.contestant1_votes || 0} vs ${votes.contestant2Votes || votes.contestant2_votes || 0}`);
            } else {
              console.log(`    Votes: NO VOTE DATA`);
            }
            console.log('');
          });
        }
        console.log('');
      });
    }
  }
}

testGetBracketData().catch(console.error);