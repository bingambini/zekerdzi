const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyI-67cqENKBz9kBP5AAQ_cfPxeMnQhRwsy8yM4P47qRm0LpYur64WrFrU43hq-JRyl/exec';

var dishes = []; // პოპულარული კერძებისთვის
var menu = [];   // სრული მენიუსთვის
var cart = {}, prevView = 'home', curView = 'home';

// 1. მონაცემების წამოღება Google Apps Script-დან
async function fetchMenuData() {
    try {
        const response = await fetch(SCRIPT_URL);
        const allData = await response.json();
        
        // მონაცემების ფორმატირება (Mapping) შიტის სათაურების მიხედვით
        const formattedData = allData.map(item => {
            return {
                id: parseInt(item.id),
                name: item.name?.trim(),
                ka: (item.name_ka || item.ka)?.trim(),
                cat: (item.category || item.cat)?.trim().toLowerCase(),
                price: parseFloat(item.price) || 0,
                desc: (item.description || item.desc)?.trim(),
                emoji: (item.image || item.emoji)?.trim() || "🍽️",
                bs: String(item.is_popular || item.bs).toLowerCase() === 'true'
            };
        }).filter(item => item.id);

        // ვანაწილებთ მონაცემებს
        dishes = formattedData.filter(item => item.bs === true);
        menu = formattedData;

        // საწყისი რენდერი მონაცემების ჩატვირთვის შემდეგ
        renderHome('all');
    } catch (error) {
        console.error('Error fetching menu via Apps Script:', error);
    }
}

// SPLASH LOGIC
(function () {
    var bar = document.getElementById('splash-bar');
    var pct = document.getElementById('splash-pct');
    var step = 0, steps = 60, iv = setInterval(function () {
        step++;
        var p = Math.round(step / steps * 100);
        if (bar) bar.style.width = p + '%';
        if (pct) pct.textContent = p + '%';
        if (step >= steps) {
            clearInterval(iv);
            var s = document.getElementById('splash');
            if (s) {
                s.style.opacity = '0';
                s.style.pointerEvents = 'none';
                setTimeout(function () {
                    s.style.display = 'none';
                    document.getElementById('app').classList.remove('hidden');
                    fetchMenuData(); // ვიძახებთ მონაცემებს აპლიკაციის გახსნისას
                }, 500);
            }
        }
    }, 50);
})();

// NAVIGATION FUNCTIONS
function showView(n) {
    prevView = curView; curView = n;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); v.classList.remove('active'); });
    var t = document.getElementById('view-' + n);
    if (t) { t.classList.remove('hidden'); t.classList.add('active'); t.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.toggle('active-nav', b.dataset.nav === n); });
    if (n === 'cart') renderCart();
    if (n === 'menu') renderMenu(null);
}

function goBack() { showView(prevView || 'home'); }
function goToCart() { showView('cart'); }

// DISH DETAIL FUNCTION
function openProductDetail(id) {
    var item = getItem(id);
    if (!item) return;

    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-ka').textContent = item.ka;
    document.getElementById('detail-price').textContent = '₾' + item.price.toFixed(2);
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').textContent = item.emoji;
    document.getElementById('detail-btn-price').textContent = '₾' + item.price.toFixed(2);

    const addBtn = document.getElementById('detail-add-btn');
    addBtn.onclick = function () {
        addToCart(id);
        goBack();
    };

    showView('item-detail');
}

// EVENT LISTENERS
document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.dataset.nav); });
});

document.querySelectorAll('.filter-pill').forEach(function (p) {
    p.addEventListener('click', function () {
        document.querySelectorAll('.filter-pill').forEach(function (x) { x.classList.remove('active-pill'); });
        p.classList.add('active-pill'); renderHome(p.dataset.filter);
    });
});

document.querySelectorAll('.cat-pill').forEach(function (p) {
    p.addEventListener('click', function () {
        document.querySelectorAll('.cat-pill').forEach(function (x) { x.classList.remove('active-cat'); });
        p.classList.add('active-cat'); renderMenu(p.dataset.cat);
    });
});

const searchInput = document.getElementById('menu-search');
if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        var q = e.target.value.toLowerCase();
        renderMenuItems(menu.filter(function (i) { 
            return i.name.toLowerCase().includes(q) || (i.ka && i.ka.includes(q)); 
        }));
    });
}

// RENDER LOGIC
function renderHome(f) {
    var list = f === 'all' ? dishes : dishes.filter(function (d) { return d.cat === f; });
    var grid = document.getElementById('dishes-grid');
    if (!grid) return;
    grid.innerHTML = list.map(function (d) {
        return `<div class="dish-card" onclick="openProductDetail(${d.id})">
          <div style="position:relative">
            <div class="dish-img">${d.emoji}</div>
            ${d.bs ? '<span class="bsb">BEST SELLER</span>' : ''}
            <button style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,.9);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px" onclick="event.stopPropagation()">♡</button>
          </div>
          <div class="dish-info">
            <p class="dish-name">${d.name}</p>
            <p class="dish-price">₾${d.price.toFixed(2)}</p>
            <button class="add-btn" onclick="event.stopPropagation();addToCart(${d.id})">+</button>
          </div></div>`;
    }).join('');
}

function renderMenu(cat) {
    var ap = document.querySelector('.cat-pill.active-cat');
    cat = cat || (ap ? ap.dataset.cat : 'traditional');
    renderMenuItems(menu.filter(function (i) { return i.cat === cat; }));
}

function renderMenuItems(items) {
    var el = document.getElementById('menu-list');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="text-align:center;color:#AAA;padding:40px;font-size:14px">No dishes found</p>'; return; }
    el.innerHTML = items.map(function (i) {
        return `<div class="menu-item" onclick="openProductDetail(${i.id})">
          <div class="menu-img">${i.emoji}</div>
          <div class="menu-info">
            <p class="menu-name">${i.name}</p>
            <p class="menu-ka">${i.ka}</p>
            <p class="menu-desc">${i.desc}</p>
            <span class="menu-price">₾${i.price.toFixed(2)}</span>
          </div>
          <button class="menu-add" onclick="event.stopPropagation();addToCart(${i.id})">+</button>
        </div>`;
    }).join('');
}

// CART LOGIC
function getItem(id) { 
    return menu.find(function (d) { return d.id === parseInt(id); }); 
}

function addToCart(id) {
    var it = getItem(id); if (!it) return;
    if (cart[id]) cart[id].qty++; else cart[id] = Object.assign({}, it, { qty: 1 });
    badge();
}

function removeFromCart(id) {
    if (!cart[id]) return;
    cart[id].qty--;
    if (cart[id].qty <= 0) delete cart[id];
    badge(); renderCart();
}

function clearCart() { cart = {}; badge(); renderCart(); }

function badge() {
    var t = Object.values(cart).reduce(function (s, i) { return s + i.qty; }, 0);
    ['nav-cart-badge', 'menu-cart-badge'].forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        if (t > 0) { el.textContent = t; el.classList.remove('hidden'); } else el.classList.add('hidden');
    });
}

function renderCart() {
    var c = document.getElementById('cart-items');
    if (!c) return;
    var items = Object.values(cart);
    if (!items.length) {
        c.innerHTML = `<div class="ecart"><div style="font-size:48px">🛒</div><p>Your cart is empty</p>
          <button onclick="showView('menu')" style="margin-top:16px;background:#1D6FE8;color:white;border:none;border-radius:12px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">Browse Menu</button></div>`;
        setSummary(0); return;
    }
    c.innerHTML = items.map(function (i) {
        return `<div class="cart-item">
          <div class="cart-img">${i.emoji}</div>
          <div class="cart-info">
            <p class="cart-name">${i.name}</p>
            <p class="cart-price">₾${i.price.toFixed(2)}</p>
            <div class="qty-controls">
              <button class="qty-btn" onclick="removeFromCart(${i.id})">−</button>
              <span class="qty-val">${i.qty}</span>
              <button class="qty-btn plus" onclick="addToCart(${i.id});renderCart()">+</button>
            </div></div></div>`;
    }).join('');
    setSummary(items.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
}

function setSummary(sub) {
    var tot = sub + (sub > 0 ? 3.50 : 0);
    const subEl = document.getElementById('summary-subtotal');
    const totEl = document.getElementById('summary-total');
    const checkEl = document.getElementById('checkout-total');
    if (subEl) subEl.textContent = '₾' + sub.toFixed(2);
    if (totEl) totEl.textContent = '₾' + tot.toFixed(2);
    if (checkEl) checkEl.textContent = '₾' + tot.toFixed(2);
}
