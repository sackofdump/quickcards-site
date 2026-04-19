const fs = require('fs');
const raw = fs.readFileSync('C:/qce/products.js','utf8');
const prods = JSON.parse(raw.match(/window\.products\s*=\s*(\[\s*[\s\S]*\])/)[1]);
const before = prods.length;
const pat = /display card|fan card/i;
const removed = prods.filter(p => pat.test(p.name));
const filtered = prods.filter(p => !pat.test(p.name));
console.log('Removing', removed.length, 'items:');
removed.forEach(p => console.log(' -', p.name));
console.log('\nRemaining:', filtered.length);
// Re-index IDs
filtered.forEach((p, i) => { p.id = i + 1; });
fs.writeFileSync('C:/qce/products.js', 'window.products = ' + JSON.stringify(filtered, null, 2) + ';\n');
console.log('\nDone.');
