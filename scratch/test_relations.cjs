const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('sales').select('*, items:sale_items(*)').order('created_at', {ascending:false}).limit(1);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
test();
