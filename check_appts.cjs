const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppts() {
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      staff_id,
      client:clients(name)
    `)
    .gte('start_time', '2026-09-18T00:00:00Z')
    .lt('start_time', '2026-09-20T00:00:00Z');

  console.log('Appointments for the 19th:', JSON.stringify(appointments, null, 2));

  if (appointments && appointments.length > 0) {
    const staffIds = appointments.map(a => a.staff_id);
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, name, color, role')
      .in('id', staffIds);

    console.log('Staff assigned:', JSON.stringify(staffData, null, 2));
  }
}

checkAppts();
