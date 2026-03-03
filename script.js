/* ===== DATA ===== */
const dishes = [
  { id: 1, name: "Adjaruli Khachapuri", ka: "აჭარული ხაჭაპური", desc: "Cheese bread with egg yolk and butter", price: 14.00, emoji: "🍳", category: "khachapuri", bestSeller: true },
  { id: 2, name: "Shish Kebab Mixed", ka: "შიშ-ქებაბი შერეული", desc: "Grilled mixed meat skewers", price: 28.50, emoji: "🍢", category: "grilled", bestSeller: true },
  { id: 3, name: "Walnut Pkhali Trio", ka: "თხილის ფხალი", desc: "Spinach, beet and bean pkhali", price: 12.00, emoji: "🥗", category: "salads", bestSeller: false },
  { id: 4, name: "Creamy Shkmeruli", ka: "შქმერული", desc: "Roasted chicken in garlic cream sauce", price: 19.50, emoji: "🍗", category: "traditional", bestSeller: true },
  { id: 5, name: "Pork Ojakhuri", ka: "ოჯახური", desc: "Pan-fried pork with potatoes", price: 16.00, emoji: "🥩", category: "grilled", bestSeller: false },
  { id: 6, name: "Lobio in Pot", ka: "ლობიო ქოთანში", desc: "Spiced kidney beans in clay pot", price: 11.00, emoji: "🫘", category: "traditional", bestSeller: false },
];

const menuItems = [
  // traditional
  { id: 7, name: "Khinkali (Kalakuri)", ka: "ხინკალი ქალაქური", desc: "Meat, herbs, and juicy broth", price: 2.00, emoji: "🥟", category: "traditional" },
  { id: 8, name: "Adjaruli Khachapuri", ka: "აჭარული ხაჭაპური", desc: "Cheese bread with egg yolk and butter", price: 15.50, emoji: "🍳", category: "traditional" },
  { id: 9, name: "Badrijani Nigvzit", ka: "ბადრიჯანი ნიგვზით", desc: "Fried eggplant with walnut paste", price: 12.00, emoji: "🍆", category: "traditional" },
  // grilled
  { id: 10, name: "Pork Mtsvadi", ka: "ღორის მწვადი", desc: "Tender pork grilled over vine wood", price: 18.00, emoji: "🍖", category: "grilled" },
  { id: 11, name: "Chicken Tabaka", ka: "წიწილა ტაბაკა", desc: "Crispy pressed whole chicken", price: 22.00, emoji: "🍗", category: "grilled" },
  // salads
  { id: 12, name: "Tomato & Cucumber Salad", ka: "პომიდვრის სალათი", desc: "Fresh summer salad", price: 8.00, emoji: "🥗", category: "salads" },
  { id: 13, name: "Glekhuri Salad", ka: "გლეხური სალათი", desc: "Village-style fresh vegetables", price: 9.00, emoji: "🥙", category: "salads" },
  // drinks
  { id: 14, name: "Homemade Lemonade", ka: "სახლის ლიმონათი", desc: "Fresh-squeezed citrus lemonade", price: 6.00, emoji: "🍋", category: "drinks" },
  { id: 15, name: "House Red Wine", ka: "სახლის წითელი ღვინო", desc: "Georgian Saperavi wine (200ml)", price: 8.50, emoji: "🍷", category: "drinks" },
];

/* ===== CART STATE ===== */
let cart = {};

/* ===== NAVIGATION ===== */
let previousView = 'home';
let currentView = 'home';

function showView(name) {
  previousView = currentView;
  currentView = name;

  document.querySelectorAll('.view').forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('active');
  });
  const target = document.getElementById('view-' + name);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
    target.scrollTop = 0;
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active-nav', btn.dataset.nav === name);
  });

  if (name === 'cart') renderCart();
  if (name === 'menu') renderMenu();
}

function goBack() {
  showView(previousView || 'home');
}
function goToCart() {
  showView('cart');
}

/* ===== SPLASH ===== */
window.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('splash-bar');
  const pct = document.getElementById('splash-pct');
  const duration = 3000; // 3 წამი
  const steps = 60;
  const stepTime = duration / steps;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    const progress = Math.round((step / steps) * 100);
    bar.style.width = progress + '%';
    pct.textContent = progress + '%';

    if (step >= steps) {
      clearInterval(interval);
      const splash = document.getElementById('splash');
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        renderHome();
      }, 500);
    }
  }, stepTime);

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.nav));
  });

  // Filter pills (home)
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active-pill'));
      pill.classList.add('active-pill');
      renderHome(pill.dataset.filter);
    });
  });

  // Category pills (menu)
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active-cat'));
      pill.classList.add('active-cat');
      renderMenu(pill.dataset.cat);
    });
  });

  // Menu search
  document.getElementById('menu-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = menuItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q)
    );
    renderMenuItems(filtered);
  });
});

/* ===== RENDER HOME ===== */
function renderHome(filter = 'all') {
  const grid = document.getElementById('dishes-grid');
  const filtered = filter === 'all' ? dishes : dishes.filter(d => d.category === filter);

  grid.innerHTML = filtered.map(dish => `
    <div class="dish-card" onclick="addToCart(${dish.id})">
      <div style="position:relative">
        <div class="dish-img">${dish.emoji}</div>
        ${dish.bestSeller ? '<span class="best-seller-badge">BEST SELLER</span>' : ''}
        <button class="heart-btn" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.9);border:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;" onclick="event.stopPropagation()">♡</button>
      </div>
      <div class="dish-info">
        <p class="dish-name">${dish.name}</p>
        <p class="dish-price">₾${dish.price.toFixed(2)}</p>
        <button class="add-btn" onclick="event.stopPropagation(); addToCart(${dish.id})">+</button>
      </div>
    </div>
  `).join('');
}

/* ===== RENDER MENU ===== */
function renderMenu(cat = null) {
  const activeCat = cat || document.querySelector('.cat-pill.active-cat')?.dataset.cat || 'traditional';
  const filtered = menuItems.filter(item => item.category === activeCat);
  renderMenuItems(filtered);
}

function renderMenuItems(items) {
  const list = document.getElementById('menu-list');
  if (!items.length) {
    list.innerHTML = '<p style="text-align:center;color:#AAA;padding:40px;font-size:14px;">No dishes found</p>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="menu-item">
      <div class="menu-img">${item.emoji}</div>
      <div class="menu-info">
        <p class="menu-name">${item.name}</p>
        <p class="menu-ka">${item.ka}</p>
        <p class="menu-desc">${item.desc}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
          <span class="menu-price">₾${item.price.toFixed(2)}</span>
        </div>
      </div>
      <button class="menu-add" onclick="addToCartByItem(${item.id}, 'menu')">+</button>
    </div>
  `).join('');
}

/* ===== CART FUNCTIONS ===== */
function getItemById(id) {
  return [...dishes, ...menuItems].find(d => d.id === id);
}

function addToCart(id) {
  const item = getItemById(id);
  if (!item) return;
  if (cart[id]) cart[id].qty++;
  else cart[id] = { ...item, qty: 1 };
  updateCartBadge();
  flashAddFeedback(id);
}

function addToCartByItem(id, fromView) {
  addToCart(id);
}

function removeFromCart(id) {
  if (!cart[id]) return;
  cart[id].qty--;
  if (cart[id].qty <= 0) delete cart[id];
  updateCartBadge();
  renderCart();
}

function clearCart() {
  cart = {};
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const total = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
  const badges = [document.getElementById('nav-cart-badge'), document.getElementById('menu-cart-badge')];
  badges.forEach(badge => {
    if (!badge) return;
    if (total > 0) {
      badge.textContent = total;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const items = Object.values(cart);

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <div style="font-size:48px">🛒</div>
        <p>Your cart is empty</p>
        <button onclick="showView('menu')" style="margin-top:16px;background:#1D6FE8;color:white;border:none;border-radius:12px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">Browse Menu</button>
      </div>`;
    updateSummary(0);
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-img">${item.emoji}</div>
      <div class="cart-info">
        <p class="cart-name">${item.name}</p>
        <p class="cart-price">₾${item.price.toFixed(2)}</p>
        <div class="qty-controls">
          <button class="qty-btn" onclick="removeFromCart(${item.id})">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn plus" onclick="addToCart(${item.id})">+</button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  updateSummary(subtotal);
}

function updateSummary(subtotal) {
  const delivery = 2.50;
  const service = 1.00;
  const total = subtotal + (subtotal > 0 ? delivery + service : 0);
  document.getElementById('summary-subtotal').textContent = '₾' + subtotal.toFixed(2);
  document.getElementById('summary-total').textContent = '₾' + total.toFixed(2);
  document.getElementById('checkout-total').textContent = '₾' + total.toFixed(2);
}

function flashAddFeedback(id) {
  // Simple visual cue - could animate a badge
}
