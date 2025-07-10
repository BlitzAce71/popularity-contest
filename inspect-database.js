#!/usr/bin/env node

// Script to inspect the actual current database schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('🔍 Inspecting current database schema...\n');

  try {
    // Check if matchups table exists and get its columns
    console.log('📊 MATCHUPS TABLE STRUCTURE:');
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .limit(1);

    if (matchupsError) {
      console.log(`❌ Error querying matchups: ${matchupsError.message}`);
    } else if (matchupsData && matchupsData.length > 0) {
      console.log('✅ Matchups table exists');
      console.log('📋 Available columns:', Object.keys(matchupsData[0]));
    } else {
      console.log('⚠️  Matchups table exists but is empty');
    }

    console.log('\n📊 VOTE_RESULTS TABLE STRUCTURE:');
    const { data: voteResultsData, error: voteResultsError } = await supabase
      .from('vote_results')
      .select('*')
      .limit(1);

    if (voteResultsError) {
      console.log(`❌ Error querying vote_results: ${voteResultsError.message}`);
    } else if (voteResultsData && voteResultsData.length > 0) {
      console.log('✅ Vote_results table exists');
      console.log('📋 Available columns:', Object.keys(voteResultsData[0]));
    } else {
      console.log('⚠️  Vote_results table exists but is empty');
    }

    console.log('\n📊 ROUNDS TABLE STRUCTURE:');
    const { data: roundsData, error: roundsError } = await supabase
      .from('rounds')
      .select('*')
      .limit(1);

    if (roundsError) {
      console.log(`❌ Error querying rounds: ${roundsError.message}`);
    } else if (roundsData && roundsData.length > 0) {
      console.log('✅ Rounds table exists');
      console.log('📋 Available columns:', Object.keys(roundsData[0]));
    } else {
      console.log('⚠️  Rounds table exists but is empty');
    }

    console.log('\n🔧 TESTING FUNCTION CALLS:');
    
    // Test if force_advance_round function exists
    const { data: functionTest, error: functionError } = await supabase.rpc('force_advance_round', {
      tournament_uuid: '00000000-0000-0000-0000-000000000000' // dummy UUID to test function signature
    });

    if (functionError) {
      console.log(`❌ force_advance_round function error: ${functionError.message}`);
      console.log(`💡 This tells us about the expected function signature`);
    } else {
      console.log('✅ force_advance_round function exists and responds');
    }

  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
  }
}

console.log('🗄️  Database Schema Inspector');
console.log('=' .repeat(50));
inspectDatabase().catch(console.error);