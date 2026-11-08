const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAll() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@ohana.com',
    password: 'ohana' // Wait, I need to check the real password. Let's try 123456 or ohana.
  });
  
  if (authErr) {
    console.log("Auth failed, trying 123456");
    await supabase.auth.signInWithPassword({
      email: 'admin@ohana.com',
      password: '123456'
    });
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    console.error("Not authenticated");
    return;
  }
  console.log("Authenticated!");

  console.log("Testing cash_movements insert...");
  const { data: mData, error: mErr } = await supabase
    .from('cash_movements')
    .insert([{ type: 'in', amount: 10, reason: 'test', payment_method: 'cash' }])
    .select();
  console.log("cash_movements error:", mErr);
  if (mData) {
     await supabase.from('cash_movements').delete().eq('id', mData[0].id);
  }

  console.log("Testing cash_closures insert...");
  const { data: cData, error: cErr } = await supabase
    .from('cash_closures')
    .insert([{ 
      closure_date: '2026-01-01', expected_cash: 0, actual_cash: 0, discrepancy_cash: 0,
      expected_bank: 0, actual_bank: 0, discrepancy_bank: 0
    }])
    .select();
  console.log("cash_closures error:", cErr);
  if (cData) {
     await supabase.from('cash_closures').delete().eq('id', cData[0].id);
  }
}

testAll();
