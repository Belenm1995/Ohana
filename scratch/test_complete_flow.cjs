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

async function testCompleteSaveFlow() {
  const { data: client } = await supabase.from('clients').select('*').eq('name', 'Belen').single();
  console.log('Client before save:', client.name, 'Notes length:', client.notes.length);

  const clientTechnical = {
    allergies: 'Alergia al amoniaco y polen (Test ok)',
    hair_type: 'Ondulado (2A-2C)',
    hair_thickness: 'Fino',
    hair_condition: 'Sensibilizado / Dañado',
    scalp_type: 'Sensible / Reactivo',
    gray_percentage: '30% - 50%',
    skin_type: 'Mixta',
    patch_test_date: '2026-11-01',
    patch_test_result: 'Negativo (Apto)',
    preferred_stylist: 'Cristian'
  };

  const newFormula = 'Raíz: 6.0 (30g) + 6.1 (15g) a 20 Vol. | Tiempo: 35 min';

  // Perform save
  let baseNotes = (client.notes || '').replace(/<!--FICHA_JSON:.*?-->/g, '').trim();
  const serializedNotes = `${baseNotes ? baseNotes + '\n' : ''}<!--FICHA_JSON:${JSON.stringify(clientTechnical)}-->`;

  const updatePayload = {
    notes: serializedNotes,
    color_formula: newFormula
  };

  const { error } = await supabase.from('clients').update(updatePayload).eq('id', client.id);
  if (error) {
    console.error('Update error:', error);
    return;
  }
  console.log('Save to Supabase succeeded!');

  // Fresh reload:
  const { data: freshClient } = await supabase.from('clients').select('*').eq('id', client.id).single();
  console.log('Fresh client loaded from DB:');
  console.log('Formula in DB:', freshClient.color_formula);
  console.log('Technical parsed:', parseTechnicalData(freshClient));
}

testCompleteSaveFlow();
