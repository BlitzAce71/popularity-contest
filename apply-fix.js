#!/usr/bin/env node

// Apply the get_bracket_data function fix directly
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('🔧 Applying get_bracket_data function fix...\n');
  
  // Read the SQL file
  const sql = readFileSync('./fix-get-bracket-data.sql', 'utf8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sql
    });
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log('✅ Successfully applied get_bracket_data function fix');
      
      // Test the function
      console.log('\n🧪 Testing the fixed function...');
      const tournamentId = '02524a19-72c4-49a8-b04d-63d7aaec22ff';
      
      const { data: testData, error: testError } = await supabase.rpc('get_bracket_data', {
        tournament_uuid: tournamentId
      });
      
      if (testError) {
        console.log(`❌ Test Error: ${testError.message}`);
      } else {
        console.log(`✅ Function test successful! Returned ${testData?.length || 0} rounds`);
        
        if (testData && testData.length > 0) {
          // Check for vote counts in first round
          const firstRound = testData[0];
          if (firstRound.matchups && firstRound.matchups.length > 0) {
            const firstMatchup = firstRound.matchups[0];
            const votes = firstMatchup.voteCounts || firstMatchup.vote_counts || {};
            console.log(`📊 Sample vote count: ${votes.contestant1Votes || votes.contestant1_votes || 0} vs ${votes.contestant2Votes || votes.contestant2_votes || 0}`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
  }
}

applyFix().catch(console.error);