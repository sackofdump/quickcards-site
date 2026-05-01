// ebay-auto-sync.js
// Calls eBay Trading API → rebuilds products.js + stock.json → git commit + push
// Run manually:  node C:\qce\ebay-auto-sync.js
// Scheduled:     schtasks /create /tn "QCE Inventory Sync" /tr "node C:\qce\ebay-auto-sync.js" /sc hourly /mo 1 /st 00:00

const https   = require('https');
const fs      = require('fs');
const { execSync } = require('child_process');

const CREDS        = require('./ebay-credentials.js');
const LOG_FILE     = 'C:\\qce\\sync-log.txt';
const PRODUCTS_FILE = 'C:\\qce\\products.js';
const STOCK_FILE   = 'C:\\qce\\stock.json';
const REPO_DIR     = 'C:\\qce';

// ─────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

// ─────────────────────────────────────────────────────────
// Blacklist — parse IDs from auction-blacklist.js
// ─────────────────────────────────────────────────────────
function loadBlacklist() {
  const src = fs.readFileSync('C:\\qce\\auction-blacklist.js', 'utf8');
  const ids = [...src.matchAll(/"(\d{10,})"/g)].map(m => m[1]);
  return new Set(ids);
}

// ─────────────────────────────────────────────────────────
// categorize() — identical to refresh-inventory.js
// ─────────────────────────────────────────────────────────
function categorize(name) {
  const lower = name.toLowerCase();
  const isCard = /(topps|bowman|panini|upper deck|donruss|fleer|score|leaf|prizm|chrome|refractor|parallel|insert|patch|relic)/.test(lower);

  if (/\bpsa\b|\bbgs\b|\bsgc\b|\bbvg\b/.test(lower)) return 'graded';
  if (/\bstickers?\b/.test(lower)) return 'stickers';
  if (/\bpins?\b/.test(lower)) return 'pins';
  if (/\bcharms?\b/.test(lower)) return 'charms';
  if (/yu.?gi.?oh|yugioh/i.test(lower)) return 'yugioh';
  if (/topps now/i.test(lower)) return 'topps-now';

  if (/pok[eé]mon/i.test(lower)) return 'pokemon';
  if (/\bswsh\b/.test(lower)) return 'pokemon';
  if (/(silver tempest|vivid voltage|astral radiance|battle styles|evolving skies|brilliant stars|fusion strike|lost origin|crown zenith|chilling reign|paldea evolved|obsidian flames|paradox rift|temporal forces|twilight masquerade|stellar crown|surging sparks|prismatic evolutions|diamond & pearl|heartgold|soulsilver|base set|jungle set|fossil set|team rocket|gym heroes|gym challenge|neo genesis|neo discovery|neo revelation|neo destiny|legendary collection|expedition|aquapolis|skyridge|ruby.*sapphire|sandstorm|dragon set|magma.*aqua|hidden legends|firered.*leafgreen|team rocket returns|deoxys|emerald set|unseen forces|delta species|legend maker|holon phantoms|crystal guardians|dragon frontiers|power keepers|diamond.*pearl|mysterious treasures|secret wonders|great encounters|majestic dawn|legends awakened|stormfront|platinum set|rising rivals|supreme victors|arceus set|heartgold soulsilver|unleashed|undaunted|triumphant|call of legends|black.*white|emerging powers|noble victories|next destinies|dark explorers|dragons exalted|boundaries crossed|plasma storm|plasma freeze|plasma blast|legendary treasures|x.*y base|flashfire|furious fists|phantom forces|primal clash|roaring skies|ancient origins|breakthrough|breakpoint|generations|fates collide|steam siege|evolutions|sun.*moon base|guardians rising|burning shadows|crimson invasion|ultra prism|forbidden light|celestial storm|dragon majesty|lost thunder|team up|unbroken bonds|unified minds|hidden fates|cosmic eclipse|sword.*shield base|rebel clash|darkness ablaze|champions path|shining fates|future flash|clay burst|snow hazard|wild force|cyber judge|mask of change|night wanderer|shrouded fable|journey together)/.test(lower)) return 'pokemon';

  if (/baseball/.test(lower) || /\bmlb\b/.test(lower)) return 'baseball';
  if (/basketball/.test(lower) || /\bnba\b/.test(lower)) return 'basketball';
  if (/football/.test(lower) || /\bnfl\b/.test(lower)) return 'football';
  if (/(packers|steelers|patriots|cowboys|eagles|bears|vikings|saints|falcons|buccaneers|seahawks|broncos|raiders|chargers|chiefs|ravens|bengals|jaguars|titans|texans|colts|dolphins|commanders|redskins|oilers|49ers|niners|\brams\b|panthers|lions)/.test(lower)) return 'football';
  if (/hockey/.test(lower) || /\bnhl\b/.test(lower)) return 'hockey';
  if (/(yankees|red sox|cubs|dodgers|cardinals|mets|braves|phillies|nationals|marlins|padres|rockies|diamondbacks|pirates|\breds\b|brewers|astros|rangers|angels|athletics|mariners|tigers|guardians|indians|white sox|twins|rays|blue jays|orioles|royals|giants)/.test(lower)) return 'baseball';
  if (/(lakers|celtics|warriors|bulls|knicks|\bheat\b|\bmagic\b|\bnets\b|bucks|raptors|pistons|cavaliers|pacers|hornets|hawks|wizards|sixers|76ers|thunder|blazers|\bjazz\b|nuggets|suns|clippers|kings|grizzlies|pelicans|spurs|rockets|mavericks|timberwolves)/.test(lower)) return 'basketball';
  if (/20\d\d-\d\d topps/.test(lower)) return 'basketball';
  if (/topps/.test(lower) && /#\d+bk-/i.test(lower)) return 'basketball';
  if (/(8-bit ballers|clutch city|bowman u now|march madness)/.test(lower)) return 'basketball';
  const hasTopps = /topps/.test(lower);
  const hasBaseballLine = /(topps series|topps heritage|topps update|topps chrome|topps now|topps archives|topps rookie cup|topps big ticket|topps all-topps|topps finest|topps opening day|topps s1\b|topps holiday|stadium club|living set|bowman chrome|bowman's best|bowman platinum|bowman draft|allen.*ginter|allen & ginter)/.test(lower)
    || (hasTopps && /\barchives\b/.test(lower))
    || (hasTopps && /\bs1\b/.test(lower))
    || (hasTopps && /8-bit baller/.test(lower));
  if (hasBaseballLine) {
    if (/8-bit baller/.test(lower)) return 'basketball';
    if (/(olympics|nintendo|march madness|ncaa)/.test(lower)) return 'other';
    return 'baseball';
  }
  if (/(panini mosaic|panini prizm|panini contenders|elite extra edition|contenders auto|donruss optic)/.test(lower)) return 'baseball';
  if (/(sp authentic|ud exclusives|upper deck exclusives|upper deck sp|upper deck game|upper deck heritage)/.test(lower)) return 'baseball';
  if (/\bgame jersey\b|\bgame-used\b|\bgame worn\b/.test(lower)) return 'baseball';
  if (/\bleaf\b.*(auto|parallel|rc\b|rookie|refractor|trading card)/i.test(lower)) return 'baseball';
  if (hasTopps && /(mojo refractor|sand glitter|rainbow foil|silver pack|anniversary mojo|foilboard|holiday relic|cyber stats|foil cyber|topps archive\b)/.test(lower) && !/(olympics|nintendo|nba|ncaa)/.test(lower)) return 'baseball';
  if (hasTopps && /\barchive\b/.test(lower) && !/(olympics|nintendo|nba|ncaa)/.test(lower)) return 'baseball';

  if (!isCard && /(coin|cent|dime|nickel|quarter|bullion|numismatic|troy|circulated|commemorative)/.test(lower)) return 'coins';
  if (!isCard && /(silver|gold)/.test(lower) && /(bar |oz |troy|bullion|ingot|round|medal)/.test(lower)) return 'coins';
  return 'other';
}

function isNumbered(name) {
  return /\d+\/\d+/.test(name) || /\bpsa\b/i.test(name) || /\bsgc\b/i.test(name) || /\bbgs\b/i.test(name);
}

// ─────────────────────────────────────────────────────────
// eBay Trading API
// ─────────────────────────────────────────────────────────
function callAPIOnce(xmlBody) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(xmlBody, 'utf8');
    const req = https.request({
      hostname: 'api.ebay.com',
      path: '/ws/api.dll',
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': body.length,
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1155',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-APP-NAME': CREDS.appId,
        'X-EBAY-API-DEV-NAME': CREDS.devId,
        'X-EBAY-API-CERT-NAME': CREDS.certId,
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.write(body);
    req.end();
  });
}

const TRANSIENT = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|socket hang up|timeout/i;

async function callAPI(xmlBody) {
  const delays = [2000, 8000, 30000];
  let lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await callAPIOnce(xmlBody);
    } catch (err) {
      lastErr = err;
      if (attempt === delays.length || !TRANSIENT.test(err.message)) throw err;
      log(`  transient error (${err.message}); retry ${attempt + 1}/${delays.length} in ${delays[attempt] / 1000}s`);
      await new Promise(r => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

function buildXML(page) {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${CREDS.userToken}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
}

function extractText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.match(/<Item>[\s\S]*?<\/Item>/g) || [];
  for (const block of blocks) {
    const itemId  = extractText(block, 'ItemID');
    const title   = extractText(block, 'Title');
    const type    = extractText(block, 'ListingType');

    if (!itemId || !title) continue;
    // Skip auctions (Chinese = standard auction, Dutch = Dutch auction)
    if (type && type !== 'FixedPriceItem') continue;

    const price   = parseFloat(extractText(block, 'CurrentPrice') || 0);
    const gallery = extractText(block, 'GalleryURL');

    // Quantity: prefer QuantityAvailable (remaining), fall back to Quantity - QuantitySold
    const qtyAvail = extractText(block, 'QuantityAvailable');
    const qty      = parseInt(extractText(block, 'Quantity') || 0);
    const qtySold  = parseInt(extractText(block, 'QuantitySold') || 0);
    const stock    = qtyAvail !== null ? parseInt(qtyAvail) : Math.max(0, qty - qtySold);

    items.push({ itemId, title, price, galleryUrl: gallery, stock });
  }
  return items;
}

function getTotalPages(xml) {
  const m = xml.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/);
  return m ? parseInt(m[1]) : 1;
}

function checkErrors(xml) {
  const ack = xml.match(/<Ack>([^<]+)<\/Ack>/);
  if (ack && ack[1] === 'Failure') {
    const msg = xml.match(/<LongMessage>([^<]+)<\/LongMessage>/);
    throw new Error('eBay API Failure: ' + (msg ? msg[1] : 'unknown error'));
  }
}

async function fetchAllListings(blacklist) {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const resp = await callAPI(buildXML(page));
    checkErrors(resp);

    if (page === 1) {
      totalPages = getTotalPages(resp);
      log(`Total pages: ${totalPages}`);
    }

    const items = parseItems(resp);
    let added = 0;
    for (const item of items) {
      if (blacklist.has(item.itemId)) continue;
      all.push(item);
      added++;
    }
    log(`  Page ${page}/${totalPages}: ${added} items (${items.length - added} blacklisted/skipped)`);

    page++;
    if (page <= totalPages) await new Promise(r => setTimeout(r, 300));
  } while (page <= totalPages);

  return all;
}

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────
async function main() {
  log('=== QuickCards Auto-Sync Starting ===');

  const blacklist = loadBlacklist();
  log(`Blacklist: ${blacklist.size} IDs loaded`);

  const items = await fetchAllListings(blacklist);
  log(`Total active fixed-price listings: ${items.length}`);

  // Write stock.json
  const stockMap = {};
  for (const item of items) stockMap[item.itemId] = item.stock;
  fs.writeFileSync(STOCK_FILE, JSON.stringify(stockMap, null, 2));
  log(`stock.json written: ${Object.keys(stockMap).length} entries`);

  // Build a map of existing images keyed by eBay item ID so we don't lose
  // images that the API fails to return a GalleryURL for.
  const existingImages = {};
  if (fs.existsSync(PRODUCTS_FILE)) {
    try {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
      const m = raw.match(/window\.products\s*=\s*(\[[\s\S]*\])/);
      if (m) {
        const existing = JSON.parse(m[1]);
        for (const p of existing) {
          const idMatch = p.url && p.url.match(/\/itm\/(\d+)/);
          if (idMatch && p.image) existingImages[idMatch[1]] = p.image;
        }
        log(`Preserved images map: ${Object.keys(existingImages).length} entries`);
      }
    } catch (_) {}
  }

  // Write products.js — newest items first (highest ItemID = most recently listed)
  items.sort((a, b) => parseInt(b.itemId) - parseInt(a.itemId));
  const products = items.map((item, i) => ({
    id: i + 1,
    name: item.title,
    price: item.price,
    image: item.galleryUrl ? item.galleryUrl.replace(/s-l\d+/g, 's-l300') : (existingImages[item.itemId] || null),
    url: `https://www.ebay.com/itm/${item.itemId}`,
    category: categorize(item.title),
    badge: null,
    discount: null,
    numbered: isNumbered(item.title),
    stock: item.stock,
  }));
  fs.writeFileSync(PRODUCTS_FILE, 'window.products = ' + JSON.stringify(products, null, 2) + ';\n');
  log(`products.js written: ${products.length} products`);

  // Category breakdown
  const cats = {};
  for (const p of products) cats[p.category] = (cats[p.category] || 0) + 1;
  for (const [c, n] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    log(`  ${c}: ${n}`);
  }

  // Git commit + push (non-fatal if nothing changed or push fails)
  try {
    execSync(`git -C "${REPO_DIR}" add products.js stock.json`, { stdio: 'pipe' });
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    execSync(`git -C "${REPO_DIR}" commit -m "Auto-sync inventory: ${products.length} products (${date})"`, { stdio: 'pipe' });
    execSync(`git -C "${REPO_DIR}" push`, { stdio: 'pipe' });
    log('Git: committed and pushed → Netlify deploying');
  } catch (err) {
    const out = (err.stdout?.toString() || '') + (err.stderr?.toString() || '') + err.message;
    if (/nothing to commit/i.test(out)) {
      log('Git: no changes (inventory unchanged since last sync)');
    } else {
      log('Git error: ' + out.slice(0, 300));
    }
  }

  log('=== Sync complete ===\n');
}

main().catch(err => {
  log('FATAL: ' + err.message);
  process.exit(1);
});
