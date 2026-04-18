// ============================================================
// Run after every scrape: node C:/qce/merge-stock.js
//
// Uses stock.json (generated from eBay CSV) to restore qtys.
// Only re-run import-csv.js when your stock quantities change.
// ============================================================

const fs = require('fs');

// Load stock overrides (persistent, survives scrapes)
if (!fs.existsSync('C:/qce/stock.json')) {
  console.log('No stock.json found — run import-csv.js first to generate it.');
  console.log('Skipping stock merge.');
  process.exit(0);
}

const stockMap = JSON.parse(fs.readFileSync('C:/qce/stock.json', 'utf8'));
console.log('Stock overrides loaded:', Object.keys(stockMap).length, 'items');

// Load new products
const newRaw = fs.readFileSync('C:/qce/products.js', 'utf8');
const newProds = JSON.parse(newRaw.match(/window\.products\s*=\s*(\[\s*[\s\S]*\])/)[1]);

// Apply stock overrides by item ID
let updated = 0;
newProds.forEach(p => {
  const m = p.url && p.url.match(/\/itm\/(\d+)/);
  if (m && stockMap[m[1]] !== undefined) {
    p.stock = stockMap[m[1]];
    updated++;
  }
});

console.log('Items updated with stock:', updated);
fs.writeFileSync('C:/qce/products.js', 'window.products = ' + JSON.stringify(newProds, null, 2) + ';\n');
console.log('Done.');
