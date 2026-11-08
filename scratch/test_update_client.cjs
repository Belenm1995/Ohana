const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vvfdbdzxdkchuqvjanxy.supabase.co', 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n');

async function test() {
  const { data: clients } = await supabase.from('clients').select('id, name, notes').limit(1);
  const clientId = clients[0].id;
  console.log('Client before:', clients[0]);
  
  const serializedNotes = '<!--FICHA_JSON:{"allergies":"PPD"}-->';
  const res = await supabase.from('clients').update({ notes: serializedNotes }).eq('id', clientId);
  console.log('Update res:', res);
  
  const { data: updated } = await supabase.from('clients').select('*').eq('id', clientId).single();
  console.log('Client after:', updated);
}
test();
