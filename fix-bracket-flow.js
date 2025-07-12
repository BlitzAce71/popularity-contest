#!/usr/bin/env node

// Script to investigate and potentially fix the bracket flow issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBracketFlow() {
  console.log('🔍 Investigating bracket generation function...\n');
  
  try {
    // First, let's see what functions are available
    console.log('📊 CHECKING AVAILABLE RPC FUNCTIONS:');
    
    // Try to get the function definition if possible
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname, prosrc')
      .like('proname', '%bracket%')
      .limit(10);
      
    if (functions && functions.length > 0) {
      console.log('Found bracket-related functions:');
      functions.forEach(func => {
        console.log(`- ${func.proname}`);
        if (func.prosrc) {
          console.log(`  Source: ${func.prosrc.substring(0, 200)}...`);
        }
      });
    } else {
      console.log('❌ Could not access function definitions (this is normal for security)');
    }
    
    console.log('\n📊 ANALYZING CURRENT BRACKET LOGIC:');
    
    // Let's create a simple test tournament to understand the pattern
    console.log('The issue appears to be in the database function generate_single_elimination_bracket');
    console.log('This function needs to be modified to ensure proper crossover in semifinals.');
    console.log('\nStandard tournament bracket flow should be:');
    console.log('- Quarterfinals: A1 vs C*, A* vs C1, B1 vs D*, B* vs D1');
    console.log('- Semifinals: A winner vs C winner, B winner vs D winner');
    console.log('- Final: (A vs C) winner vs (B vs D) winner');
    
    console.log('\nCurrent problematic flow appears to be:');
    console.log('- Quarterfinals: A1 vs A*, B1 vs B*, C1 vs C*, D1 vs D*');
    console.log('- Semifinals: A winner vs B winner, C winner vs D winner (WRONG!)');
    
    console.log('\n🔧 RECOMMENDED FIX:');
    console.log('The database function generate_single_elimination_bracket needs to be updated.');
    console.log('Since we cannot modify the function directly from this script,');
    console.log('here is the SQL that needs to be executed in Supabase Studio:');
    
    console.log(`
-- This is the logic that needs to be implemented in the bracket generation function
-- The quarterfinals should be set up so that:
-- QF1: Best of Quadrant A vs Best remaining after other quadrants take their top seeds
-- QF2: Best of Quadrant C vs Best remaining after other quadrants take their top seeds  
-- QF3: Best of Quadrant B vs Best remaining after other quadrants take their top seeds
-- QF4: Best of Quadrant D vs Best remaining after other quadrants take their top seeds
--
-- Then the advancement should be:
-- SF1: QF1 winner (A region) vs QF2 winner (C region) 
-- SF2: QF3 winner (B region) vs QF4 winner (D region)
--
-- This ensures A vs C and B vs D in the Final Four
`);

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

console.log('🏆 Bracket Flow Fix Investigation');
console.log('=' .repeat(50));
fixBracketFlow().catch(console.error);