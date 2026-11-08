const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function reassignAppt() {
  const { data, error } = await supabase
    .from('appointments')
    .update({ staff_id: '613e7e38-ef14-47f8-8696-eac5565f0e9f' })
    .eq('id', '416217a9-38a2-4af7-92fd-807443a405f4')
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

reassignAppt();
