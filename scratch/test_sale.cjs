const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSale() {
  console.log("Creating test sale...");
  const { data: saleData, error: saleErr } = await supabase
    .from('sales')
    .insert([{
      total_amount: 15.50,
      discount_amount: 0,
      payment_method: 'cash',
      notes: 'test sale from node'
    }])
    .select()
    .single();

  if (saleErr) {
    console.error("sale error:", saleErr);
    return;
  }
  
  console.log("Sale created:", saleData.id);
  
  console.log("Deleting test sale...");
  await supabase.from('sales').delete().eq('id', saleData.id);
  console.log("Done");
}

testSale();
