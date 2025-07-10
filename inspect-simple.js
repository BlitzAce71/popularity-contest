#!/usr/bin/env node

// Simple script to check tournament state
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTournament() {
  const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
  
  console.log('🔍 Checking rounds...');
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_number');
    
  rounds.forEach(round => {
    console.log(`Round ${round.round_number} (${round.name}): ${round.status}`);
  });

  console.log('\n🔍 Checking semifinals matchups...');
  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round_id', rounds.find(r => r.round_number === 2)?.id);
    
  matchups.forEach(matchup => {
    console.log(`Matchup ${matchup.position}: status=${matchup.status}, c1=${!!matchup.contestant1_id}, c2=${!!matchup.contestant2_id}`);
  });
}

checkTournament().catch(console.error);