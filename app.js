/* ============================================
   QuickCards — App Logic with Tree Navigation
   Uses window.products from products.js
   ============================================ */

// ---- Products from external file ----
const products = window.products || [];

// ---- State ----
let currentCategory = 'all';
let activeNodeId = 'all';
let currentSort = 'default';
let currentView = 'grid';
let searchQuery = '';
let currentPage = 1;
const ITEMS_PER_PAGE = 48;

// ---- Tree Data Structure ----
const treeData = [
  { id: 'all', label: 'All Items', icon: '\u25C7', filter: null },
  { id: 'sports', label: 'Sports Cards', icon: '\u26A1', filter: ['baseball', 'basketball', 'football', 'hockey'], expanded: true, children: [
    { id: 'baseball', label: 'Baseball', icon: '\u25E6', filter: 'baseball' },
    { id: 'basketball', label: 'Basketball', icon: '\u25E6', filter: 'basketball' },
    { id: 'football', label: 'Football', icon: '\u25E6', filter: 'football' },
    { id: 'hockey', label: 'Hockey', icon: '\u25E6', filter: 'hockey' },
  ]},
  { id: 'pokemon', label: 'Pok\u00E9mon', icon: '\u2605', filter: 'pokemon' },
  { id: 'coins', label: 'Coins & Currency', icon: '\u25C9', filter: 'coins' },
  { id: 'other', label: 'Other Collectibles', icon: '\u25C8', filter: 'other' },
];

// ---- DOM Refs ----
const productsGrid = document.getElementById('productsGrid');
const resultsCount = document.getElementById('resultsCount');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const navbar = document.getElementById('navbar');
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');
const treeNav = document.getElementById('treeNav');
const treeToggleMobile = document.getElementById('treeToggleMobile');
const treeSidebar = document.getElementById('treeSidebar');

// ---- Tree: Count items for a node ----
function getNodeCount(node) {
  if (node.filter === null) return products.length;
  if (Array.isArray(node.filter)) {
    return products.filter(p => node.filter.includes(p.category)).length;
  }
  return products.filter(p => p.category === node.filter).length;
}

// ---- Tree: Find a node by ID ----
function findNode(id, nodes) {
  if (!nodes) nodes = treeData;
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(id, node.children);
      if (found) return found;
    }
  }
  return null;
}

// ---- Tree: Check if node or its children are active ----
function isInActivePath(node) {
  if (node.id === activeNodeId) return true;
  if (node.children) {
    return node.children.some(c => c.id === activeNodeId);
  }
  return false;
}

// ---- Tree: Render ----
function buildTree() {
  treeNav.innerHTML = treeData.map((node, i) => {
    let html = renderTreeNode(node);
    // Add separator after "All Items"
    if (i === 0) html += '<div class="tree-sep"></div>';
    return html;
  }).join('');
}

function renderTreeNode(node) {
  const hasChildren = node.children && node.children.length > 0;
  const count = getNodeCount(node);
  const isActive = node.id === activeNodeId;
  const inPath = isInActivePath(node);

  let html = `<div class="tree-node${inPath && hasChildren ? ' active-path' : ''}" data-id="${node.id}">`;

  // Node row
  html += `<div class="tree-node-row${isActive ? ' active' : ''}" data-node-id="${node.id}">`;

  // Toggle
  if (hasChildren) {
    html += `<span class="tree-toggle${node.expanded ? ' expanded' : ''}" data-toggle-id="${node.id}">\u25B8</span>`;
  } else {
    html += `<span class="tree-toggle leaf"></span>`;
  }

  // Icon
  html += `<span class="tree-icon">${node.icon}</span>`;

  // Label
  html += `<span class="tree-label">${node.label}</span>`;

  // Count
  if (count > 0) {
    html += `<span class="tree-count">${count}</span>`;
  }

  html += '</div>';

  // Children
  if (hasChildren) {
    html += `<div class="tree-children${node.expanded ? ' expanded' : ''}">`;
    html += node.children.map(child => renderTreeNode(child)).join('');
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ---- Tree: Event delegation ----
treeNav.addEventListener('click', (e) => {
  // Check if toggle arrow was clicked
  const toggleEl = e.target.closest('[data-toggle-id]');
  if (toggleEl) {
    e.stopPropagation();
    const nodeId = toggleEl.dataset.toggleId;
    toggleTreeNode(nodeId);
    return;
  }

  // Check if a node row was clicked
  const rowEl = e.target.closest('[data-node-id]');
  if (rowEl) {
    handleTreeClick(rowEl.dataset.nodeId);
  }
});

// ---- Tree: Toggle expand/collapse ----
function toggleTreeNode(id) {
  const node = findNode(id);
  if (node) {
    node.expanded = !node.expanded;
    buildTree();
  }
}

// ---- Tree: Click to filter ----
function handleTreeClick(id) {
  const node = findNode(id);
  if (!node) return;

  activeNodeId = id;

  // Set category filter
  if (node.filter === null) {
    currentCategory = 'all';
  } else {
    currentCategory = node.filter;
  }

  // Auto-expand parent if clicking a group
  if (node.children && !node.expanded) {
    node.expanded = true;
  }

  currentPage = 1;
  buildTree();
  renderProducts();
  updateBreadcrumb(node);
}

// ---- Tree: Select from external (footer links) ----
function selectTreeNode(categoryId) {
  // Find the node matching this category
  const node = findNode(categoryId);
  if (node) {
    // Expand parent if needed
    for (const parent of treeData) {
      if (parent.children) {
        const child = parent.children.find(c => c.id === categoryId);
        if (child) {
          parent.expanded = true;
          break;
        }
      }
    }
    handleTreeClick(categoryId);
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  }
}
window.selectTreeNode = selectTreeNode;

// ---- Breadcrumb: Update with typing animation ----
function updateBreadcrumb(node) {
  const el = document.getElementById('tpCurrent');
  if (!el) return;

  const text = node.id === 'all' ? 'all' : node.id.replace(/-/g, '_');
  el.textContent = '';
  let i = 0;
  const cursor = document.querySelector('.tp-cursor');
  if (cursor) cursor.style.animationPlayState = 'paused';

  function typeChar() {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
      setTimeout(typeChar, 40 + Math.random() * 30);
    } else {
      if (cursor) cursor.style.animationPlayState = 'running';
    }
  }
  typeChar();
}

// ---- Mobile tree toggle ----
if (treeToggleMobile) {
  // Start collapsed on mobile
  if (window.innerWidth <= 900) {
    treeSidebar.classList.add('collapsed');
  }

  treeToggleMobile.addEventListener('click', () => {
    treeSidebar.classList.toggle('collapsed');
    treeToggleMobile.classList.toggle('open');
  });
}

// ---- Render Products ----
function renderProducts() {
  let filtered = [...products];

  // Filter by category
  if (currentCategory !== 'all') {
    if (Array.isArray(currentCategory)) {
      filtered = filtered.filter(p => currentCategory.includes(p.category));
    } else {
      filtered = filtered.filter(p => p.category === currentCategory);
    }
  }

  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
  }

  // Sort
  switch (currentSort) {
    case 'price-low':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  resultsCount.textContent = `Showing ${totalFiltered === 0 ? 0 : startIdx + 1}\u2013${Math.min(startIdx + ITEMS_PER_PAGE, totalFiltered)} of ${totalFiltered} items`;

  if (totalFiltered === 0) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
        <p style="font-size: 1.2rem; color: var(--gray-300); margin-bottom: 8px;">No items found</p>
        <p style="font-size: 0.85rem; color: var(--gray-400);">Try a different search or category</p>
      </div>`;
    renderPagination(0, 0);
    return;
  }

  productsGrid.innerHTML = pageItems.map((p, i) => {
    const imgSrc = p.image || '';
    const hasImage = !!p.image;
    return `
    <div class="product-card" style="animation-delay: ${Math.min(i * 0.03, 0.8)}s">
      ${p.badge === 'numbered' || p.numbered ? '<span class="card-badge numbered">#\'d</span>' : ''}
      <div class="product-image${hasImage ? '' : ' no-image'}">
        ${hasImage
          ? `<img src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.parentElement.classList.add('no-image');this.remove();">`
          : `<div class="placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
             </div>`
        }
      </div>
      <div class="product-info">
        <span class="product-category">${getCategoryLabel(p.category)}</span>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-meta">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          ${p.discount ? `<span class="product-discount">${p.discount}</span>` : ''}
        </div>
        <div class="product-action">
          <a href="${p.url}" target="_blank" rel="noopener" class="btn-view">&gt; inspect()</a>
          <button class="btn-cart" onclick="addToCart(${p.id})">&gt; add.cart()</button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination(totalPages, totalFiltered);
}

function renderPagination(totalPages, totalItems) {
  let container = document.getElementById('pagination');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pagination';
    container.className = 'pagination';
    productsGrid.parentNode.insertBefore(container, productsGrid.nextSibling);
  }
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn${currentPage === 1 ? ' disabled' : ''}" onclick="goToPage(${currentPage - 1})">&laquo; Prev</button>`;

  const maxVisible = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span class="page-dots">...</span>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === currentPage ? ' active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="page-dots">...</span>`;
    html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="page-btn${currentPage === totalPages ? ' disabled' : ''}" onclick="goToPage(${currentPage + 1})">Next &raquo;</button>`;
  container.innerHTML = html;
}

window.goToPage = function(page) {
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCategoryLabel(cat) {
  const labels = {
    baseball: 'Baseball',
    pokemon: 'Pokemon',
    coins: 'Coins & Currency',
    basketball: 'Basketball',
    football: 'Football',
    hockey: 'Hockey',
    other: 'Collectibles'
  };
  return labels[cat] || cat;
}

// ---- Search ----
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    currentPage = 1;
    renderProducts();
  }, 300);
});

// ---- Sort ----
sortSelect.addEventListener('change', () => {
  currentSort = sortSelect.value;
  currentPage = 1;
  renderProducts();
});

// ---- View Toggle ----
gridViewBtn.addEventListener('click', () => {
  currentView = 'grid';
  productsGrid.classList.remove('list-view');
  gridViewBtn.classList.add('active');
  listViewBtn.classList.remove('active');
});

listViewBtn.addEventListener('click', () => {
  currentView = 'list';
  productsGrid.classList.add('list-view');
  listViewBtn.classList.add('active');
  gridViewBtn.classList.remove('active');
});

// ---- Navbar Scroll ----
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ---- Active Nav Link ----
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 200;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-link[href="#${id}"]`);
    if (link) {
      link.classList.toggle('active', scrollY >= top && scrollY < top + height);
    }
  });
});

// ---- Mobile Nav ----
mobileToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ---- Stat Counter Animation ----
function animateCounters() {
  document.querySelectorAll('.stat-value[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = Math.floor(current).toLocaleString() + '+';
    }, 16);
  });
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) statsObserver.observe(heroStats);

// ---- Particle Background ----
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.opacity = Math.random() * 0.5 + 0.1;
    const colors = [
      `rgba(33, 150, 243, ${this.opacity})`,
      `rgba(245, 166, 35, ${this.opacity})`,
      `rgba(229, 57, 53, ${this.opacity * 0.5})`
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
    if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

const particleCount = Math.min(80, Math.floor(window.innerWidth / 15));
const particlesArr = Array.from({ length: particleCount }, () => new Particle());

function drawLines() {
  for (let i = 0; i < particlesArr.length; i++) {
    for (let j = i + 1; j < particlesArr.length; j++) {
      const dx = particlesArr[i].x - particlesArr[j].x;
      const dy = particlesArr[i].y - particlesArr[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        ctx.beginPath();
        ctx.moveTo(particlesArr[i].x, particlesArr[i].y);
        ctx.lineTo(particlesArr[j].x, particlesArr[j].y);
        ctx.strokeStyle = `rgba(33, 150, 243, ${0.06 * (1 - dist / 150)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particlesArr.forEach(p => {
    p.update();
    p.draw();
  });
  drawLines();
  requestAnimationFrame(animateParticles);
}
animateParticles();

// ---- Scroll Reveal ----
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.section-header, .tree-window').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = '0.6s cubic-bezier(0.4, 0, 0.2, 1)';
  revealObserver.observe(el);
});

// ---- Init ----
buildTree();
renderProducts();

/* ============================================
   Cart System
   ============================================ */

const CART_KEY = 'qc_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

window.addToCart = function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, image: product.image || null, quantity: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  renderCartItems();
  openCart();

  // Flash the button green briefly
  const btns = document.querySelectorAll(`.btn-cart`);
  btns.forEach(btn => {
    if (btn.getAttribute('onclick') === `addToCart(${productId})`) {
      btn.classList.add('added');
      btn.textContent = '> added!';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.textContent = '> add.cart()';
      }, 1200);
    }
  });
};

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  if (total > 0) {
    badge.style.display = 'flex';
    badge.textContent = total > 99 ? '99+' : total;
  } else {
    badge.style.display = 'none';
  }
}

function renderCartItems() {
  const cart = getCart();
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <span>// cart is empty</span>
        <span style="color:var(--gray-400);font-size:0.7rem">add some cards to get started</span>
      </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      ${item.image
        ? `<img class="cart-item-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.outerHTML='<div class=cart-item-img-placeholder><svg width=24 height=24 viewBox=\\'0 0 24 24\\' fill=none stroke=currentColor stroke-width=1><rect x=3 y=3 width=18 height=18 rx=2/></svg></div>'">`
        : `<div class="cart-item-img-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
      }
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-bottom">
          <span class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
          <div class="cart-qty">
            <button class="cart-qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
            <span class="cart-qty-num">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${item.id})" aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  if (footer) footer.style.display = 'block';
  if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)}`;
}

window.changeQty = function(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    const idx = cart.indexOf(item);
    cart.splice(idx, 1);
  }
  saveCart(cart);
  updateCartBadge();
  renderCartItems();
};

window.removeFromCart = function(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
  updateCartBadge();
  renderCartItems();
};

// ---- Cart Drawer Open/Close ----
function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
document.getElementById('cartOverlay').addEventListener('click', closeCart);

// ---- Checkout ----
document.getElementById('checkoutBtn').addEventListener('click', async () => {
  const cart = getCart();
  if (cart.length === 0) return;

  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  btn.textContent = '> processing...';

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cart.map(i => ({
        name: i.name,
        price: i.price,
        image: i.image,
        quantity: i.quantity,
      }))),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Checkout error: ' + (data.error || 'Unknown error'));
      btn.disabled = false;
      btn.textContent = '> checkout.init()';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = '> checkout.init()';
  }
});

// ---- Init cart state ----
updateCartBadge();
