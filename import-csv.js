// ============================================================
// Run when stock quantities change:
//   node C:/qce/import-csv.js "C:/path/to/ActiveListings.csv"
//
// Generates stock.json and applies quantities to products.js.
// ============================================================

const fs = require('fs');

const csvPath = process.argv[2];
if (!csvPath) {
  console.log('Usage: node import-csv.js "C:/path/to/ActiveListings.csv"');
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split('\n');

// Find header row
const headerIdx = lines.findIndex(l => /item\s*id|item number/i.test(l));
if (headerIdx === -1) {
  console.error('Could not find header row in CSV');
  process.exit(1);
}

const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
const itemIdCol = headers.findIndex(h => /item\s*id|item number/i.test(h));
const qtyCol    = headers.findIndex(h => /available quantity|quantity available|qty available/i.test(h));
const formatCol = headers.findIndex(h => /format|listing type/i.test(h));

if (itemIdCol === -1 || qtyCol === -1) {
  console.error('Could not find required columns. Found:', headers.join(', '));
  process.exit(1);
}

const AUCTION_BLACKLIST = new Set([
  "168308662215","168308662719","168308663128","168308663322","168308663776","168308667809","168309074764",
  "168307367313","168308656544","168308660550","168308660989","168308661511","168308661840","168308662079",
  "168307367309","168307357095","168307367311","168307357094","168307367302","168307367312","168307357102",
  "168307367308","168307357087","168307357105","168307367305","168307357103","168307357088","168307225762",
  "168307225765","168307225768","168307357097","168307357092","168307357089","168307357086","168307220750",
  "168307220751","168307220752","168307220753","168307220754","168307220755","168307225761","168306310457",
  "168306310459","168306310464","168307220741","168307220743","168307220746","168307220748","168306299711",
  "168306299712","168306310461","168306310455","168306310462","168306310460","168306310463","168304944812",
  "168306234437","168306299704","168306299705","168306299706","168306299707","168306299710","168304917784",
  "168304917785","168304917786","168304936489","168304936490","168304936491","168304944811","168304898885",
  "168304898888","168304898891","168304898894","168304917781","168304917782","168304917783","168302512536",
  "168302512532","168302512533","168302512528","168304893206","168304893207","168304893208","168302497246",
  "168302512529","168302512535","168302512530","168302512538","168302512531","168301978628","168302497247",
  "168302497256","168302497254","168302497251","168302497245","168302497249","168313900301","168304598685",
  "168309301918","168312556508","168312557411","168311297161",
  // Manual blacklist
  "168317527664","168317524609","168317522281","168317116130","168319098347",
  "168320549997","168322651012","168322652705","168323058527",
  // DISPLAY Card items - blacklisted 2026-04-18
  "166810253434","166810256891","166810253008","166981910953","166792292958",
  "166792590053","166810260406","166792019344","166981916897","166792292979",
  "166810257827","166810255866","166792265857","166792292959","166792292978",
  "166810265775","166810255398","166981906920"
]);

const stockMap = {};
let skipped = 0;

for (let i = headerIdx + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Handle quoted CSV fields
  const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || line.split(',');
  const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());

  const itemId = clean[itemIdCol];
  const qty = parseInt(clean[qtyCol]);
  const format = formatCol !== -1 ? clean[formatCol] : '';

  if (!itemId || isNaN(qty)) continue;
  if (AUCTION_BLACKLIST.has(itemId)) { skipped++; continue; }
  if (/auction/i.test(format)) { skipped++; continue; }

  stockMap[itemId] = qty;
}

// Preserve manually-set out-of-stock entries (stock: 0) that aren't in the CSV
if (fs.existsSync('C:/qce/stock.json')) {
  const existing = JSON.parse(fs.readFileSync('C:/qce/stock.json', 'utf8'));
  let preserved = 0;
  for (const [id, qty] of Object.entries(existing)) {
    if (qty === 0 && !(id in stockMap)) {
      stockMap[id] = 0;
      preserved++;
    }
  }
  if (preserved > 0) console.log('Preserved out-of-stock entries:', preserved);
}

fs.writeFileSync('C:/qce/stock.json', JSON.stringify(stockMap, null, 2));
console.log('stock.json saved:', Object.keys(stockMap).length, 'items');
console.log('Skipped (auctions/blacklist):', skipped);

// Apply stock to products.js
const newRaw = fs.readFileSync('C:/qce/products.js', 'utf8');
const newProds = JSON.parse(newRaw.match(/window\.products\s*=\s*(\[[\s\S]*\])/)[1]);
let updated = 0;
newProds.forEach(p => {
  const m = p.url && p.url.match(/\/itm\/(\d+)/);
  if (m && stockMap[m[1]] !== undefined) {
    p.stock = stockMap[m[1]];
    updated++;
  }
});
console.log('products.js items updated with stock:', updated);
fs.writeFileSync('C:/qce/products.js', 'window.products = ' + JSON.stringify(newProds, null, 2) + ';\n');
console.log('Done.');
