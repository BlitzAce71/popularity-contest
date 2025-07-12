#!/usr/bin/env node

// Test the actual dummy contestant generation with database insertion
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testActualGeneration() {
  try {
    console.log('🔍 Getting most recent tournament...');
    
    // Get the most recent tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No tournaments found');
      return;
    }

    const tournament = tournaments[0];
    console.log(`📊 Testing with tournament: ${tournament.name} (ID: ${tournament.id})`);
    console.log(`   Max contestants: ${tournament.max_contestants}`);

    // Check current contestants
    const { data: currentContestants } = await supabase
      .from('contestants')
      .select('*')
      .eq('tournament_id', tournament.id);

    console.log(`📋 Current contestants: ${currentContestants?.length || 0}`);

    // Generate just 4 test contestants to avoid messing up the tournament
    console.log('\n🤖 Generating 4 test contestants...');
    
    const testContestants = [
      {
        tournament_id: tournament.id,
        name: 'TEST_A1',
        description: 'Test dummy contestant',
        seed: 999, // Use high seed to avoid conflicts
      },
      {
        tournament_id: tournament.id,
        name: 'TEST_B1',
        description: 'Test dummy contestant',
        seed: 998,
      },
      {
        tournament_id: tournament.id,
        name: 'TEST_C1',
        description: 'Test dummy contestant',  
        seed: 997,
      },
      {
        tournament_id: tournament.id,
        name: 'TEST_D1',
        description: 'Test dummy contestant',
        seed: 996,
      }
    ];

    // Try to insert test contestants
    const { data, error } = await supabase
      .from('contestants')
      .insert(testContestants)
      .select();

    if (error) {
      console.error('❌ Database insertion error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log(`✅ Successfully inserted ${data?.length || 0} test contestants`);
      console.log('Created contestants:', data?.map(c => `${c.name} (seed: ${c.seed})`));
      
      // Clean up - delete the test contestants
      console.log('\n🧹 Cleaning up test contestants...');
      const testIds = data?.map(c => c.id) || [];
      if (testIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('contestants')
          .delete()
          .in('id', testIds);
        
        if (deleteError) {
          console.error('⚠️ Failed to clean up test contestants:', deleteError);
        } else {
          console.log('✅ Cleaned up test contestants');
        }
      }
    }

  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testActualGeneration().catch(console.error);