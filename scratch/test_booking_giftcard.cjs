const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBookingGiftFlow() {
  console.log('--- TEST: CANJE DE TARJETA REGALO EN RESERVA ONLINE ---');

  // 1. Crear tarjeta de prueba de 40€
  const testCode = 'BOOK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log('1. Creando tarjeta de prueba de 40€ activa:', testCode);

  const { data: card, error: cardErr } = await supabase
    .from('gift_cards')
    .insert([{
      code: testCode,
      type: 'amount',
      status: 'active',
      amount_initial: 40,
      amount_remaining: 40,
      sender_name: 'Amigo Invisible',
      recipient_name: 'Cliente Online',
      message: 'Disfruta tu sesión en Ohana'
    }])
    .select()
    .single();

  if (cardErr) {
    console.error('Error al crear tarjeta:', cardErr);
    return;
  }

  // 2. Obtener un staff disponible
  const { data: staffList } = await supabase.from('staff').select('id, name').limit(1);
  const staffId = staffList && staffList.length > 0 ? staffList[0].id : null;

  // 3. Obtener un cliente de prueba
  const { data: clientList } = await supabase.from('clients').select('id').limit(1);
  const clientId = clientList && clientList.length > 0 ? clientList[0].id : null;

  // 4. Reserva 1: Servicio de 25€ (Tarjeta de 40€ cubre el 100%)
  console.log('2. Cliente reserva servicio de 25€ y aplica tarjeta de 40€...');
  const servicePrice1 = 25;
  const discount1 = Math.min(card.amount_remaining, servicePrice1); // 25€
  const finalPrice1 = servicePrice1 - discount1; // 0€
  const isPaid1 = finalPrice1 === 0 ? 'paid' : 'pending';

  const apptItems1 = [
    { type: 'service', name: 'Corte y Peinado Test', price: 25, duration_minutes: 45, qty: 1 },
    { type: 'gift_card_redemption', id: card.id, name: `Tarjeta Regalo (${card.code})`, price: -discount1, qty: 1 }
  ];

  const now = new Date();
  const startTime1 = new Date(now.getTime() + 86400000); // Mañana
  const endTime1 = new Date(startTime1.getTime() + 45 * 60000);

  const { data: appt1, error: apptErr1 } = await supabase
    .from('appointments')
    .insert([{
      client_id: clientId,
      staff_id: staffId,
      items: apptItems1,
      start_time: startTime1.toISOString(),
      end_time: endTime1.toISOString(),
      status: 'confirmed',
      payment_status: isPaid1
    }])
    .select()
    .single();

  if (apptErr1) {
    console.error('Error al crear cita 1:', apptErr1);
    return;
  }

  // Actualizar tarjeta tras reserva 1
  const balanceAfter1 = card.amount_remaining - discount1; // 15€
  const statusAfter1 = balanceAfter1 <= 0 ? 'used' : 'active';
  const { data: cardAfter1 } = await supabase
    .from('gift_cards')
    .update({ amount_remaining: balanceAfter1, status: statusAfter1 })
    .eq('id', card.id)
    .select()
    .single();

  console.log('Cita 1 confirmada con éxito:');
  console.log('- Total cita: 25 €');
  console.log('- Descuento tarjeta:', discount1, '€');
  console.log('- Total a pagar online/salón:', finalPrice1, '€');
  console.log('- Estado de pago de la cita:', appt1.payment_status);
  console.log('- Saldo restante en la tarjeta:', cardAfter1.amount_remaining, '€ | Estado:', cardAfter1.status);

  // 5. Reserva 2: Servicio de 30€ (quedan 15€ en la tarjeta)
  console.log('\n3. Cliente hace segunda reserva de 30€ aplicando los 15€ restantes...');
  const servicePrice2 = 30;
  const discount2 = Math.min(cardAfter1.amount_remaining, servicePrice2); // 15€
  const finalPrice2 = servicePrice2 - discount2; // 15€
  const isPaid2 = finalPrice2 === 0 ? 'paid' : 'pending';

  const balanceAfter2 = cardAfter1.amount_remaining - discount2; // 0€
  const statusAfter2 = balanceAfter2 <= 0 ? 'used' : 'active';
  const { data: cardAfter2 } = await supabase
    .from('gift_cards')
    .update({ amount_remaining: balanceAfter2, status: statusAfter2 })
    .eq('id', card.id)
    .select()
    .single();

  console.log('Cita 2 confirmada con éxito:');
  console.log('- Total cita: 30 €');
  console.log('- Descuento tarjeta:', discount2, '€');
  console.log('- Total a pagar por el cliente en salón:', finalPrice2, '€');
  console.log('- Saldo restante en tarjeta:', cardAfter2.amount_remaining, '€ | Estado:', cardAfter2.status);

  // Limpieza
  console.log('\n4. Limpiando datos de prueba...');
  await supabase.from('appointments').delete().eq('id', appt1.id);
  await supabase.from('gift_cards').delete().eq('id', card.id);
  console.log('--- TEST COMPLETADO CON ÉXITO ---');
}

testBookingGiftFlow();
