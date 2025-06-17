// Script to create base64 PNG icons for the Chrome extension
const fs = require('fs');
const path = require('path');

// Base64 encoded 1x1 green pixel PNG as a placeholder
// In production, you'd use proper icons
const greenPixelPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Create a simple green square PNG for each size
// This is a minimal valid PNG that Chrome will accept
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const buffer = Buffer.from(greenPixelPNG, 'base64');
  const filepath = path.join(__dirname, 'icons', `icon${size}.png`);
  
  fs.writeFileSync(filepath, buffer);
  console.log(`Created ${filepath}`);
});

console.log('Icon files created successfully!');