// Simple script to create minimal PNG icons using Node.js
const fs = require('fs');
const path = require('path');

// This is a minimal 1x1 green pixel PNG in base64
// It's the smallest valid PNG file Chrome will accept
const greenPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sizes = [16, 32, 48, 128];

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Create icon files
sizes.forEach(size => {
  const buffer = Buffer.from(greenPixelBase64, 'base64');
  const filepath = path.join(iconsDir, `icon${size}.png`);
  
  fs.writeFileSync(filepath, buffer);
  console.log(`Created ${filepath}`);
});

console.log('All icon files created successfully!');
console.log('Note: These are minimal placeholder icons. Use generate-icons.html to create proper icons.');