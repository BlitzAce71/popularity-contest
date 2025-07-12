#!/usr/bin/env node

// Script to query actual database schema and function definitions
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryActualSchema() {
  console.log('🔍 Querying actual database schema...\n');

  try {
    // Check what tables we can access
    console.log('📊 ACCESSIBLE TABLES:');
    const tables = ['tournaments', 'rounds', 'matchups', 'contestants', 'votes'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error && data) {
          console.log(`✅ ${table}: accessible`);
          if (data.length > 0) {
            console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
          }
        } else {
          console.log(`❌ ${table}: ${error?.message}`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }

    // Try to get function information
    console.log('\n📊 TRYING TO ACCESS FUNCTION INFORMATION:');
    
    // Method 1: Try information_schema.routines
    try {
      const { data: routines, error: routinesError } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_definition')
        .eq('routine_schema', 'public')
        .like('routine_name', '%bracket%');
        
      if (routines && routines.length > 0) {
        console.log('✅ Found bracket functions via information_schema:');
        routines.forEach(routine => {
          console.log(`- ${routine.routine_name}`);
          if (routine.routine_definition) {
            console.log(`  Definition: ${routine.routine_definition.substring(0, 200)}...`);
          }
        });
      } else {
        console.log('❌ No bracket functions found via information_schema');
      }
    } catch (err) {
      console.log(`❌ information_schema access failed: ${err.message}`);
    }

    // Method 2: Try pg_proc directly
    try {
      const { data: procs, error: procError } = await supabase
        .from('pg_proc')
        .select('proname, prosrc')
        .like('proname', '%bracket%');
        
      if (procs && procs.length > 0) {
        console.log('\n✅ Found bracket functions via pg_proc:');
        procs.forEach(proc => {
          console.log(`- ${proc.proname}`);
          if (proc.prosrc) {
            console.log(`  Source: ${proc.prosrc.substring(0, 300)}...`);
          }
        });
      } else {
        console.log('\n❌ No bracket functions found via pg_proc');
      }
    } catch (err) {
      console.log(`\n❌ pg_proc access failed: ${err.message}`);
    }

    // Method 3: Try calling the functions to see their signatures
    console.log('\n📊 TESTING FUNCTION CALLS:');
    
    const functionsToTest = [
      'generate_single_elimination_bracket',
      'advance_to_next_round', 
      'get_bracket_data',
      'reset_tournament_bracket'
    ];
    
    for (const funcName of functionsToTest) {
      try {
        // Try calling with minimal params to see error message (reveals signature)
        const { data, error } = await supabase.rpc(funcName, {});
        
        if (error) {
          console.log(`📝 ${funcName}: ${error.message}`);
          // Error messages often reveal expected parameters
        } else {
          console.log(`✅ ${funcName}: callable (returned: ${typeof data})`);
        }
      } catch (err) {
        console.log(`❌ ${funcName}: ${err.message}`);
      }
    }

    // Check actual matchups table structure in detail
    console.log('\n📊 DETAILED MATCHUPS TABLE ANALYSIS:');
    try {
      const { data: sampleMatchup } = await supabase
        .from('matchups')
        .select('*')
        .limit(1)
        .single();
        
      if (sampleMatchup) {
        console.log('Matchups table structure:');
        Object.entries(sampleMatchup).forEach(([key, value]) => {
          console.log(`  ${key}: ${typeof value} = ${value}`);
        });
      }
    } catch (err) {
      console.log(`Could not analyze matchups: ${err.message}`);
    }

    // Check rounds table structure
    console.log('\n📊 DETAILED ROUNDS TABLE ANALYSIS:');
    try {
      const { data: sampleRound } = await supabase
        .from('rounds')
        .select('*')
        .limit(1)
        .single();
        
      if (sampleRound) {
        console.log('Rounds table structure:');
        Object.entries(sampleRound).forEach(([key, value]) => {
          console.log(`  ${key}: ${typeof value} = ${value}`);
        });
      }
    } catch (err) {
      console.log(`Could not analyze rounds: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Schema query failed:', error.message);
  }
}

console.log('🔍 Database Schema Inspector');
console.log('=' .repeat(50));
queryActualSchema().catch(console.error);