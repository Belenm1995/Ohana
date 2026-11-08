import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('gift_cards').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success! Table exists. Data:", data);
  }
}
check();
