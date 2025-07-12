#!/usr/bin/env node

// Test the dummy contestant generation function directly
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

// Simplified version of the generateDummyContestants function to test
async function testGenerateDummyContestants(tournamentId, maxContestants, quadrantNames = ['A', 'B', 'C', 'D']) {
  try {
    console.log(`🤖 Testing generation of ${maxContestants} dummy contestants for tournament ${tournamentId}`);
    
    // Calculate contestants per quadrant
    const contestantsPerQuadrant = Math.ceil(maxContestants / 4);
    console.log(`📊 Contestants per quadrant: ${contestantsPerQuadrant}`);
    
    const dummyContestants = [];
    
    for (let quadrantIndex = 0; quadrantIndex < 4; quadrantIndex++) {
      const quadrantLetter = quadrantNames[quadrantIndex].charAt(0).toUpperCase();
      const quadrantNumber = quadrantIndex + 1;
      
      console.log(`🏁 Generating for quadrant ${quadrantNumber} (${quadrantLetter})`);
      
      // Generate contestants for this quadrant
      for (let seed = 1; seed <= contestantsPerQuadrant && dummyContestants.length < maxContestants; seed++) {
        const contestant = {
          tournament_id: tournamentId,
          name: `${quadrantLetter}${seed}`,
          description: `Dummy contestant for ${quadrantNames[quadrantIndex]} quadrant, seed ${seed}`,
          seed: dummyContestants.length + 1, // Sequential seeding
          quadrant: quadrantNumber,
        };
        dummyContestants.push(contestant);
        console.log(`   Created: ${contestant.name} (seed ${contestant.seed}, quadrant ${contestant.quadrant})`);
      }
    }
    
    console.log(`\n📋 Generated ${dummyContestants.length} dummy contestants`);
    console.log(`First few: ${dummyContestants.slice(0, 8).map(c => c.name).join(', ')}`);
    
    // Try to insert them (commented out for safety - don't want to mess up existing data)
    console.log('\n🚫 Skipping actual database insertion for safety');
    
    return dummyContestants;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function main() {
  // Test with a small tournament first
  console.log('=== Testing with 8 contestants ===');
  await testGenerateDummyContestants('test-id', 8, ['Region A', 'Region B', 'Region C', 'Region D']);
  
  console.log('\n=== Testing with 64 contestants ===');
  await testGenerateDummyContestants('test-id', 64);
}

main().catch(console.error);