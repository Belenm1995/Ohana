const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vvfdbdzxdkchuqvjanxy.supabase.co', 'sb_publishable_MHZd8beRq8z253ZA7Adr0Q_n4LgaT2n');

function parseTechnicalData(client) {
  let data = {
    allergies: client?.allergies || '',
    hair_type: client?.hair_type || '',
    hair_thickness: client?.hair_thickness || '',
    hair_condition: client?.hair_condition || '',
    scalp_type: client?.scalp_type || '',
    gray_percentage: client?.gray_percentage || '',
    skin_type: client?.skin_type || '',
    patch_test_date: client?.patch_test_date || '',
    patch_test_result: client?.patch_test_result || 'Negativo (Apto)',
    preferred_stylist: client?.preferred_stylist || ''
  };

  if (client?.notes && client.notes.includes('<!--FICHA_JSON:')) {
    try {
      const match = client.notes.match(/<!--FICHA_JSON:(.*?)-->/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        data = { ...data, ...parsed };
      }
    } catch (e) {
      console.warn('Error al deserializar ficha técnica de notes:', e);
    }
  }

  return data;
}

async function simulate() {
  // 1. Fetch Belen
  const { data: client } = await supabase.from('clients').select('*').eq('name', 'Belen').single();
  console.log('1. Initial Belen from DB:', client);

  // 2. Client is selected:
  let selectedClient = client;
  let clientTechnical = parseTechnicalData(client);
  console.log('2. Loaded clientTechnical:', clientTechnical);

  // 3. User modifies allergies:
  clientTechnical.allergies = 'NUEVA ALERGIA AL LATEX Y AMONIACO';
  clientTechnical.hair_type = 'Liso (1A-1C)';

  // 4. User clicks Guardar (handleSaveTechnicalData):
  const payload = { ...clientTechnical };
  console.log('4. Saving payload:', payload);

  let serializedNotes = '';
  try {
    const { error } = await supabase.from('clients').update(payload).eq('id', selectedClient.id);
    if (error) throw error;
    console.log('Native update succeeded!');
  } catch (colErr) {
    console.log('Catch block reached with error:', colErr.message);
    if (colErr.message && (colErr.message.includes('column') || colErr.code === '42703')) {
      console.log('Using fallback in notes...');
      let baseNotes = (selectedClient.notes || '').replace(/<!--FICHA_JSON:.*?-->/g, '').trim();
      serializedNotes = `${baseNotes ? baseNotes + '\n' : ''}<!--FICHA_JSON:${JSON.stringify(payload)}-->`;
      const { error: fallbackErr } = await supabase
        .from('clients')
        .update({ notes: serializedNotes })
        .eq('id', selectedClient.id);
      if (fallbackErr) {
        console.error('Fallback error:', fallbackErr);
        throw fallbackErr;
      }
      console.log('Fallback update to notes succeeded!');
    } else {
      console.error('Did not match fallback condition!');
      throw colErr;
    }
  }

  // Local state update as in AdminClients.jsx:
  const updated = { ...selectedClient, ...payload };
  selectedClient = updated;

  // 5. User leaves and re-enters or page re-renders:
  // Suppose user reloads or navigates:
  const { data: reloadedClient } = await supabase.from('clients').select('*').eq('id', client.id).single();
  console.log('5. DB state after reload:', reloadedClient);
  const reloadedTech = parseTechnicalData(reloadedClient);
  console.log('6. Parsed tech after reload:', reloadedTech);
}

simulate();
