const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqYWtr5sLnkZFFMhq6eiudBo84je0sPlfrsD-MlDwjDWoPKFqmOQqHl26Y21QedRgc/exec';

var dishes = []; // პოპულარული კერძებისთვის
var menu = [];   // სრული მენიუსთვის
var cart = {}, prevView = 'home', curView = 'home';
var dataLoaded = false; // მონაცემების სტატუსი

// 1. მონაცემების წამოღება ოპტიმიზაციით (Caching & Async Processing)
async function fetchMenuData() {
    const cache = localStorage.getItem('menu_cache');
    if (cache) {
        processMenuData(JSON.parse(cache));
    }

    try {
        const response = await fetch(SCRIPT_URL);
        const allData = await response.json();
        
        localStorage.setItem('menu_cache', JSON.stringify(allData));
        processMenuData(allData);
        dataLoaded = true; 
    } catch (error) {
        console.error('Error fetching menu:', error);
        dataLoaded = true; 
    }
}

// მონაცემების დამუშავების და კატეგორიების გენერირების ფუნქცია
function processMenuData(allData) {
    const formattedData = allData.map(item => ({
        id: parseInt(item.id),
        name: item.name?.trim(),
        ka: (item.name_ka || item.ka)?.trim(),
        cat: (item.category || item.cat)?.trim(), // იღებს მნიშვნელობას შენი Dropdown-იდან
        price: parseFloat(item.price) || 0,
        desc: (item.description || item.desc)?.trim(),
        emoji: (item.image || item.emoji)?.trim() || "🍽️",
        bs: String(item.is_popular || item.bs).toLowerCase() === 'true'
    })).filter(item => item.id);

    dishes = formattedData.filter(item => item.bs === true);
    menu = formattedData;

    // აშენებს კატეგორიის ღილაკებს შიტის მონაცემებზე დაყრდნობით
    buildCategoryFilters();

    renderHome('all');
    
    // საწყისი რენდერი პირველივე ხელმისაწვდომი კატეგორიით
    if (menu.length > 0) {
        const uniqueCats = [...new Set(menu.map(i => i.cat))].filter(c => c);
        if (uniqueCats.length > 0) renderMenu(uniqueCats[0]);
    }
}

// კატეგორიის ღილაკების (Pills) დინამიური შექმნა
function buildCategoryFilters() {
    const container = document.querySelector('.cat-pills-container');
    if (!container) return;

    // პოულობს ყველა უნიკალურ კატეგორიას, რაც რეალურად წერია შიტში
    const categories = [...new Set(menu.map(item => item.cat))].filter(c => c);

    container.innerHTML = categories.map((cat, index) => {
        return `<div class="cat-pill ${index === 0 ? 'active-cat' : ''}" 
                     data-cat="${cat}" 
                     onclick="renderMenu('${cat}', this)">
                     ${cat}
                </div>`;
    }).join('');
}

// დამხმარე ფუნქცია სურათის/ემოჯის გამოსაჩენად
function getMediaHtml(val, cls) {
    if (val && val.startsWith('http')) {
        return `<img src="${val}" class="${cls}" alt="dish" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
    }
    return `<div class="${cls}">${val}</div>`;
}

// OPTIMIZED SPLASH LOGIC
(function () {
    var bar = document.getElementById('splash-bar');
    var pct = document.getElementById('splash-pct');
    var p = 0;
    
    var iv = setInterval(function () {
        if (p < 85) {
            p += Math.random() * 5;
        } else if (dataLoaded && p < 100) {
            p += 5;
        }

        var currentP = Math.min(Math.round(p), 100);
        if (bar) bar.style.width = currentP + '%';
        if (pct) pct.textContent = currentP + '%';

        if (currentP >= 100) {
            clearInterval(iv);
            var s = document.getElementById('splash');
            if (s) {
                s.style.opacity = '0';
                s.style.transition = 'opacity 0.5s ease';
                setTimeout(function () {
                    s.style.display = 'none';
                    document.getElementById('app').classList.remove('hidden');
                }, 500);
            }
        }
    }, 80);

    fetchMenuData();
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
    
    const imgCont = document.getElementById('detail-img');
    imgCont.innerHTML = getMediaHtml(item.emoji, ''); 
    
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

const searchInput = document.getElementById('menu-search');
if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        var q = e.target.value.toLowerCase();
        renderMenuItems(menu.filter(function (i) { 
            return i.name.toLowerCase().includes(q) || (i.ka && i.ka.toLowerCase().includes(q)); 
        }));
    });
}

// RENDER LOGIC
function renderHome(f) {
    var list = (f === 'all' || !f) ? dishes : dishes.filter(function (d) { return d.cat === f; });
    var grid = document.getElementById('dishes-grid');
    if (!grid) return;
    grid.innerHTML = list.map(function (d) {
        return `<div class="dish-card" onclick="openProductDetail(${d.id})">
          <div style="position:relative; height:140px;">
            ${getMediaHtml(d.emoji, 'dish-img')}
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

function renderMenu(cat, element) {
    // თუ ფუნქცია გამოიძახა ღილაკზე დაჭერამ
    if (element) {
        document.querySelectorAll('.cat-pill').forEach(el => el.classList.remove('active-cat'));
        element.classList.add('active-cat');
    }

    if (!cat) {
        var ap = document.querySelector('.cat-pill.active-cat');
        cat = ap ? ap.dataset.cat : (menu.length > 0 ? menu[0].cat : '');
    }
    
    renderMenuItems(menu.filter(function (i) { return i.cat === cat; }));
}

function renderMenuItems(items) {
    var el = document.getElementById('menu-list');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="text-align:center;color:#AAA;padding:40px;font-size:14px">No dishes found</p>'; return; }
    el.innerHTML = items.map(function (i) {
        return `<div class="menu-item" onclick="openProductDetail(${i.id})">
          <div class="menu-img-cont" style="width:80px; height:80px; flex-shrink:0;">
            ${getMediaHtml(i.emoji, 'menu-img')}
          </div>
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
          <div class="cart-img" style="width:60px; height:60px;">${getMediaHtml(i.emoji, '')}</div>
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
