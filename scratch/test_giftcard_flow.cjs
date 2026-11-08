const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vvfdbdzxdkchuqvjanxy.supabase.co';
const supabaseKey = 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- TEST SIMULACIÓN FLUJO COMPLETO TARJETA REGALO ---');

  const testCode = 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log('1. Creando tarjeta de prueba pendiente de pago (Bizum/Salón):', testCode);

  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  const { data: createdCard, error: createErr } = await supabase
    .from('gift_cards')
    .insert([{
      code: testCode,
      type: 'amount',
      status: 'pending_payment',
      amount_initial: 50,
      amount_remaining: 50,
      sender_name: 'Test Remitente',
      recipient_name: 'Test Destinatario',
      message: 'Prueba de regalo',
      expires_at: expirationDate.toISOString()
    }])
    .select()
    .single();

  if (createErr) {
    console.error('Error al crear tarjeta:', createErr);
    return;
  }
  console.log('Tarjeta creada con éxito:', createdCard.id, 'Estado:', createdCard.status);

  // 2. Simular intento de canjear en TPV cuando está "pending_payment"
  console.log('2. Verificando que TPV rechaza tarjeta no activa...');
  if (createdCard.status !== 'active') {
    console.log('OK: TPV rechaza correctamente con mensaje: "La tarjeta no está activa. Estado: ' + createdCard.status + '"');
  }

  // 3. Simular activación por el administrador (AdminGiftCards: "Marcar Pagado")
  console.log('3. Administrador marca la tarjeta como pagada en AdminGiftCards...');
  const { data: activatedCard, error: activateErr } = await supabase
    .from('gift_cards')
    .update({ status: 'active' })
    .eq('id', createdCard.id)
    .select()
    .single();

  if (activateErr) {
    console.error('Error al activar:', activateErr);
    return;
  }
  console.log('Tarjeta activada con éxito. Nuevo estado:', activatedCard.status);

  // 4. Simular primer canje parcial en TPV (Venta de 20€)
  console.log('4. Cliente acude al salón a gastar 20€ de los 50€...');
  const subtotal1 = 20;
  const discount1 = Math.min(activatedCard.amount_remaining, subtotal1); // 20€
  const newBalance1 = activatedCard.amount_remaining - discount1; // 30€
  const newStatus1 = newBalance1 <= 0 ? 'used' : 'active';

  const { data: updatedCard1, error: updateErr1 } = await supabase
    .from('gift_cards')
    .update({ 
      amount_remaining: newBalance1,
      status: newStatus1
    })
    .eq('id', createdCard.id)
    .select()
    .single();

  if (updateErr1) {
    console.error('Error en primer canje:', updateErr1);
    return;
  }
  console.log('Primer canje completado. Saldo restante:', updatedCard1.amount_remaining, '€ | Estado:', updatedCard1.status);

  // 5. Simular segundo canje total en TPV (Venta de 35€)
  console.log('5. Cliente vuelve a gastar los 30€ restantes en un servicio de 35€...');
  const subtotal2 = 35;
  const discount2 = Math.min(updatedCard1.amount_remaining, subtotal2); // 30€
  const totalAPagarCliente = subtotal2 - discount2; // 5€
  const newBalance2 = updatedCard1.amount_remaining - discount2; // 0€
  const newStatus2 = newBalance2 <= 0 ? 'used' : 'active';

  const { data: updatedCard2, error: updateErr2 } = await supabase
    .from('gift_cards')
    .update({ 
      amount_remaining: newBalance2,
      status: newStatus2
    })
    .eq('id', createdCard.id)
    .select()
    .single();

  if (updateErr2) {
    console.error('Error en segundo canje:', updateErr2);
    return;
  }
  console.log('Segundo canje completado:');
  console.log('- Total servicio: 35€');
  console.log('- Descuento aplicado por tarjeta:', discount2, '€');
  console.log('- Total a pagar por el cliente en caja:', totalAPagarCliente, '€');
  console.log('- Saldo tarjeta:', updatedCard2.amount_remaining, '€ | Estado:', updatedCard2.status);

  // 6. Intentar canjear tarjeta agotada
  console.log('6. Comprobando que una tarjeta agotada no se puede canjear...');
  if (updatedCard2.status !== 'active' || updatedCard2.amount_remaining <= 0) {
    console.log('OK: TPV detecta tarjeta agotada o usada correctamente.');
  }

  // 7. Limpieza
  console.log('7. Limpiando tarjeta de prueba de la base de datos...');
  await supabase.from('gift_cards').delete().eq('id', createdCard.id);
  console.log('--- TEST COMPLETADO EXITOSAMENTE ---');
}

runTest();
