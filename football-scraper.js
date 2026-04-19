// ============================================================
// PASTE THIS INTO YOUR BROWSER CONSOLE
// while on any eBay page (ebay.com)
// Scrapes ONLY the Football Cards category store page
// Downloads football-products.js when done
// ============================================================

(async function() {
  const FOOTBALL_URL = 'https://www.ebay.com/str/qceshop/Football-Cards/_i.html?store_cat=43121585011';
  const MAX_PAGES = 100;
  const CONCURRENCY = 3;
  const DELAY = 900;

  const allProducts = new Map(); // itemId -> product data
  let errors = 0;

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
        if (!allProducts.has(id)) {
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
