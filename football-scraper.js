// ============================================================
// PASTE THIS INTO YOUR BROWSER CONSOLE
// while on any eBay page (ebay.com)
// Scrapes ONLY the Football Cards category store page
// Downloads football-products.js when done
// ============================================================

(async function() {
  const FOOTBALL_URL = 'https://www.ebay.com/str/qceshop/Football-Cards/_i.html?store_cat=43121585011';
  const MAX_PAGES = 30;
  const CONCURRENCY = 3;
  const DELAY = 900;

  const allProducts = new Map(); // itemId -> product data
  let errors = 0;

  const BLACKLIST = new Set([
    "168308662215","168308662719","168308663128","168308663322","168308663776",
    "168308667809","168309074764","168307367313","168308656544","168308660550",
    "168308660989","168308661511","168308661840","168308662079","168307367309",
    "168307357095","168307367311","168307357094","168307367302","168307367312",
    "168307357102","168307367308","168307357087","168307357105","168307367305",
    "168307357103","168307357088","168307225762","168307225765","168307225768",
    "168307357097","168307357092","168307357089","168307357086","168307220750",
    "168307220751","168307220752","168307220753","168307220754","168307220755",
    "168307225761","168306310457","168306310459","168306310464","168307220741",
    "168307220743","168307220746","168307220748","168306299711","168306299712",
    "168306310461","168306310455","168306310462","168306310460","168306310463",
    "168304944812","168306234437","168306299704","168306299705","168306299706",
    "168306299707","168306299710","168304917784","168304917785","168304917786",
    "168304936489","168304936490","168304936491","168304944811","168304898885",
    "168304898888","168304898891","168304898894","168304917781","168304917782",
    "168304917783","168302512536","168302512532","168302512533","168302512528",
    "168304893206","168304893207","168304893208","168302497246","168302512529",
    "168302512535","168302512530","168302512538","168302512531","168301978628",
    "168302497247","168302497256","168302497254","168302497251","168302497245",
    "168302497249","168313900301","168304598685","168309301918","168312556508",
    "168312557411","168311297161",
    // DISPLAY Card items
    "166810253434","166810256891","166810253008","166981910953","166792292958",
    "166792590053","166810260406","166792019344","166981916897","166792292979",
    "166810257827","166810255866","166792265857","166792292959","166792292978",
    "166810265775","166810255398","166981906920",
    // Manual blacklist
    "168317527664","168317524609","168317522281","168317116130"
  ]);

  function isNumbered(name) {
    return /\d+\/\d+/.test(name) || /\bpsa\b/i.test(name) || /\bsgc\b/i.test(name) || /\bbgs\b/i.test(name);
  }

  function parseFromJson(html) {
    const results = [];
    const seenIds = new Set();
    const urlPattern = /"URL"\s*:\s*"(https?:\/\/www\.ebay\.com\/itm\/(\d{10,})[^"]*)"/g;
    const itemEntries = [];
    let m;
    while ((m = urlPattern.exec(html)) !== null) {
      if (!seenIds.has(m[2])) {
        seenIds.add(m[2]);
        itemEntries.push({ url: m[1].split('?')[0], id: m[2], pos: m.index });
      }
    }
    for (let i = 0; i < itemEntries.length; i++) {
      const { url, id, pos } = itemEntries[i];
      const windowEnd = i + 1 < itemEntries.length
        ? Math.min(itemEntries[i + 1].pos, pos + 8000)
        : pos + 8000;
      const block = html.slice(pos, Math.min(html.length, windowEnd));

      let title = null;
      const titleRe = /"title"\s*:\s*"([^"]{12,200})"/g;
      let tm;
      while ((tm = titleRe.exec(block)) !== null) {
        const c = tm[1];
        if (/^(shop by|filter by|scroll to|your new|store|all items|topps now drops)/i.test(c)) continue;
        if (c.length < 12) continue;
        title = c;
        break;
      }
      if (!title) continue;

      const priceMatch = block.match(/"displayPrice"[^{]*\{[^}]*"value"\s*:\s*\{"value"\s*:\s*([\d.]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      const imgMatch = block.match(/i\.ebayimg\.com\/images\/[^"'\s\\]+/);
      const image = imgMatch ? 'https://' + imgMatch[0].replace(/s-l\d+/g, 's-l300') : null;

      const qtyMatch = block.match(/"quantityInfo"\s*:\s*\{[^}]*"totalQuantity"\s*:\s*(\d+)/) ||
                       block.match(/"quantity"\s*:\s*(\d+)/);
      const stock = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      results.push({ url, name: title, price, image, stock });
    }
    return results;
  }

  function parseFromDom(doc) {
    const results = [];
    doc.querySelectorAll('.s-item').forEach(item => {
      const link = item.querySelector('a.s-item__link');
      const titleEl = item.querySelector('.s-item__title');
      const priceEl = item.querySelector('.s-item__price');
      const img = item.querySelector('.s-item__image-wrapper img, .s-item__image img');
      if (!link || !titleEl) return;
      const href = link.href || '';
      const idMatch = href.match(/\/itm\/(?:[^/]+\/)?(\d{10,})/);
      if (!idMatch) return;
      const name = titleEl.textContent.trim();
      if (!name || /shop on ebay/i.test(name)) return;
      const priceText = priceEl ? priceEl.textContent.replace(/,/g, '') : '';
      const priceNum = priceText.match(/\d+\.?\d*/);
      const price = priceNum ? parseFloat(priceNum[0]) : 0;
      let image = null;
      if (img) {
        image = (img.src || img.dataset.src || '').replace(/s-l\d+/g, 's-l300').split('?')[0];
        if (!image.includes('ebayimg.com')) image = null;
      }
      results.push({ url: href.split('?')[0], name, price, image, stock: 1 });
    });
    return results;
  }

  async function fetchPage(pageNum) {
    const url = pageNum === 1
      ? FOOTBALL_URL
      : `${FOOTBALL_URL}&_pgn=${pageNum}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      if (/captcha|Security Measure/i.test(html.slice(0, 3000))) {
        throw new Error('CAPTCHA — solve it in another tab then retry');
      }
      let listings = parseFromJson(html);
      if (listings.length === 0) {
        const parser = new DOMParser();
        listings = parseFromDom(parser.parseFromString(html, 'text/html'));
      }
      let newCount = 0;
      for (const item of listings) {
        const idMatch = item.url.match(/\/itm\/(\d+)/);
        if (!idMatch) continue;
        const id = idMatch[1];
        if (!allProducts.has(id) && !BLACKLIST.has(id)) {
          allProducts.set(id, item);
          newCount++;
        }
      }
      console.log(`%c[Football p${pageNum}] ${listings.length} items, ${newCount} new | Total: ${allProducts.size}`, 'color:#8f8');
      return listings.length > 0;
    } catch (err) {
      errors++;
      console.log(`%c[Football p${pageNum}] ERROR: ${err.message}`, 'color:#f55');
      return false;
    }
  }

  console.log('%c[Football Scraper] Starting...', 'color:#2196F3;font-weight:bold;font-size:14px');
  console.log(`%c[Football Scraper] URL: ${FOOTBALL_URL}`, 'color:#aaa');

  let consecutiveEmpty = 0;
  for (let start = 1; start <= MAX_PAGES; start += CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + CONCURRENCY && p <= MAX_PAGES; p++) {
      batch.push(fetchPage(p));
    }
    const results = await Promise.all(batch);
    const hadItems = results.some(r => r === true);
    if (!hadItems) {
      consecutiveEmpty += CONCURRENCY;
      if (consecutiveEmpty >= 6) {
        console.log('%c[Football Scraper] No more pages, stopping.', 'color:#fa0');
        break;
      }
    } else {
      consecutiveEmpty = 0;
    }
    if (start + CONCURRENCY <= MAX_PAGES) {
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  const total = allProducts.size;
  console.log(`%c[Football Scraper] Done! ${total} unique products, ${errors} errors`, 'color:#2196F3;font-weight:bold;font-size:14px');

  if (total === 0) {
    console.log('%c[Football Scraper] No products found.', 'color:#f55;font-weight:bold');
    return;
  }

  const products = [...allProducts.values()].map((item, i) => ({
    id: i + 1,
    name: item.name,
    price: item.price,
    image: item.image,
    url: item.url,
    category: 'football',
    badge: null,
    discount: null,
    numbered: isNumbered(item.name),
    stock: item.stock || 1,
  }));

  const noImage = products.filter(p => !p.image).length;
  if (noImage > 0) console.log(`%c[Football Scraper] Warning: ${noImage} products missing image`, 'color:#fa0');

  const output = 'window.footballProducts = ' + JSON.stringify(products, null, 2) + ';\n';
  const blob = new Blob([output], { type: 'application/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'football-products.js';
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log(`%c[Football Scraper] football-products.js downloaded! (${products.length} products)`, 'color:#4CAF50;font-weight:bold;font-size:14px');
})();
