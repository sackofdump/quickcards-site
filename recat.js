const fs = require('fs');
const raw = fs.readFileSync('C:/qce/products.js','utf8');
const prods = JSON.parse(raw.match(/window\.products\s*=\s*(\[[\s\S]*\])/)[1]);

function categorize(name) {
  const lower = name.toLowerCase();
  const isCard = /(topps|bowman|panini|upper deck|donruss|fleer|score|leaf|prizm|chrome|refractor|parallel|insert|patch|relic)/.test(lower);

  // Graded first (PSA/BGS/SGC wins everything)
  if (/\bpsa\b|\bbgs\b|\bsgc\b|\bbvg\b/.test(lower)) return 'graded';
  // Stickers
  if (/\bstickers?\b/.test(lower)) return 'stickers';
  // Pins
  if (/\bpins?\b/.test(lower)) return 'pins';
  // Charms
  if (/\bcharms?\b/.test(lower)) return 'charms';
  // Yu-Gi-Oh
  if (/yu.?gi.?oh|yugioh/i.test(lower)) return 'yugioh';
  // Topps NOW (before sport detection)
  if (/topps now/i.test(lower)) return 'topps-now';

  if (/pok[eé]mon/i.test(lower)) return 'pokemon';
  // Pokemon set names / series codes (cards that don't say "pokemon" in title)
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
  // Baseball product lines — flexible word order
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
  // Remaining baseball catches — Panini/Leaf MLB players, Chrome Mojo parallels
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

const updated = prods.map(p => Object.assign({}, p, {category: categorize(p.name)}));
const cats = {};
updated.forEach(p => { cats[p.category] = (cats[p.category]||0)+1; });
console.log('NEW counts:', JSON.stringify(cats));
const others = updated.filter(p=>p.category==='other').slice(0,20).map(p=>p.name);
console.log('\nRemaining other:');
others.forEach(n=>console.log(' -',n));
fs.writeFileSync('C:/qce/products.js', 'window.products = ' + JSON.stringify(updated, null, 2) + ';\n');
console.log('\nDone.');
