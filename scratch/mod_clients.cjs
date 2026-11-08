const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/AdminClients.jsx', 'latin1');

content = content.replace(
  /name: '', phone: '', email: '', color_formula: '', notes: '',/g,
  "name: '', phone: '', email: '', birth_date: '', color_formula: '', notes: '',"
);

const htmlToAdd = `              <div>
                <label className="block text-sm font-medium mb-1">Fecha de Nacimiento</label>
                <input type="date" className="w-full border p-2 rounded" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} />
              </div>
`;

content = content.replace(
  /<div>\s*<label className="block text-sm font-medium mb-1">Email<\/label>/,
  htmlToAdd + '              <div>\n                <label className="block text-sm font-medium mb-1">Email</label>'
);

fs.writeFileSync('src/pages/admin/AdminClients.jsx', content, 'latin1');
console.log('Modified AdminClients.jsx successfully.');
