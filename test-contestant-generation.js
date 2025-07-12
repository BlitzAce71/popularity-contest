#!/usr/bin/env node

// Test if contestants are being generated for new tournaments
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

async function testContestantGeneration() {
  console.log('🔍 Checking recent tournaments and their contestants...\n');
  
  // Get the most recent tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (tournaments && tournaments.length > 0) {
    console.log('Recent tournaments:');
    for (const tournament of tournaments) {
      console.log(`\n📊 Tournament: ${tournament.name} (ID: ${tournament.id})`);
      console.log(`   Created: ${tournament.created_at}`);
      console.log(`   Max contestants: ${tournament.max_contestants}`);
      console.log(`   Status: ${tournament.status}`);
      
      // Check contestants for this tournament
      const { data: contestants } = await supabase
        .from('contestants')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (contestants && contestants.length > 0) {
        console.log(`   ✅ Has ${contestants.length} contestants:`);
        contestants.slice(0, 10).forEach(c => {
          console.log(`      - ${c.name} (seed: ${c.seed}, quadrant: ${c.quadrant || 'N/A'})`);
        });
        if (contestants.length > 10) {
          console.log(`      ... and ${contestants.length - 10} more`);
        }
      } else {
        console.log(`   ❌ No contestants found`);
      }
    }
  } else {
    console.log('No tournaments found');
  }
}

testContestantGeneration().catch(console.error);