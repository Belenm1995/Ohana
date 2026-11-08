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

const mockClient = {
  id: '12ba32b0-d604-428c-a911-a696ef6ca55d',
  name: 'Cristian',
  notes: '<!--FICHA_JSON:{"allergies":"PPD"}-->'
};

console.log('Parsed:', parseTechnicalData(mockClient));
