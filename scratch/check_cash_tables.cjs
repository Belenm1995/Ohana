const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log("Checking cash_movements...");
  const { data: mData, error: mErr } = await supabase.from('cash_movements').select('*').limit(1);
  console.log("cash_movements error:", mErr);
  
  console.log("Checking cash_closures...");
  const { data: cData, error: cErr } = await supabase.from('cash_closures').select('*').limit(1);
  console.log("cash_closures error:", cErr);
}

checkTables();
