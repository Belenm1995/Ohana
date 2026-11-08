const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAppointment() {
  console.log("Fetching client, service, and staff...");
  const { data: clients } = await supabase.from('clients').select('id').limit(1);
  const { data: services } = await supabase.from('services').select('id, name, price, duration_minutes').limit(1);
  const { data: staff } = await supabase.from('staff').select('id').limit(1);

  if (!clients.length || !services.length || !staff.length) {
    console.error("Missing data to create appointment");
    return;
  }

  const today = new Date();
  today.setHours(17, 0, 0, 0); // 17:00 today

  const endTime = new Date(today.getTime() + services[0].duration_minutes * 60000);

  console.log("Inserting appointment...");
  const { data, error } = await supabase
    .from('appointments')
    .insert([{
      client_id: clients[0].id,
      service_id: services[0].id,
      staff_id: staff[0].id,
      start_time: today.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed',
      payment_status: 'pending',
      items: [{
        type: 'service',
        id: services[0].id,
        name: services[0].name,
        price: services[0].price,
        qty: 1,
        duration_minutes: services[0].duration_minutes
      }]
    }])
    .select();

  if (error) {
    console.error("Error creating appointment:", error);
  } else {
    console.log("Success! Appointment ID:", data[0].id);
  }
}

createTestAppointment();
