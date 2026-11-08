const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = ['tocado.JPG', 'labios.JPG', 'pelu.JPG', 'rimel.JPG'];

async function optimizeImages() {
  for (const file of files) {
    const filePath = path.join(publicDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Optimizing ${file}...`);
      const tempPath = path.join(publicDir, `temp_${file}`);
      
      // Optimize image
      await sharp(filePath)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(tempPath);
        
      // Replace original with optimized
      fs.renameSync(tempPath, filePath);
      console.log(`${file} optimized successfully.`);
    } else {
      console.log(`${file} not found.`);
    }
  }
}

optimizeImages().catch(console.error);
