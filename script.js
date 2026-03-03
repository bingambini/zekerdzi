const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqYWtr5sLnkZFFMhq6eiudBo84je0sPlfrsD-MlDwjDWoPKFqmOQqHl26Y21QedRgc/exec';

var dishes = []; 
var menu = [];   
var cart = {}, prevView = 'home', curView = 'home';
var dataLoaded = false; 

// ცვლადი არჩეული ზომის შესანახად
var selectedOptions = { label: '', extra: 0 };

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

function processMenuData(allData) {
    const formattedData = allData.map(item => ({
        id: parseInt(item.id),
        name: item.name?.trim(),
        ka: (item.name_ka || item.ka)?.trim(),
        cat: (item.category || item.cat)?.trim(),
        price: parseFloat(item.price) || 0,
        desc: (item.description || item.desc)?.trim(),
        emoji: (item.image || item.emoji)?.trim() || "🍽️",
        bs: String(item.is_popular || item.bs).toLowerCase() === 'true',
        options: item.options || '' // ვიღებთ options სვეტს
    })).filter(item => item.id);

    dishes = formattedData.filter(item => item.bs === true);
    menu = formattedData;

    buildCategoryFilters();
    renderHome('all');
    
    if (menu.length > 0) {
        const uniqueCats = [...new Set(menu.map(i => i.cat))].filter(c => c);
        if (uniqueCats.length > 0) renderMenu(uniqueCats[0]);
    }
}

function buildCategoryFilters() {
    const container = document.querySelector('.cat-pills-container');
    if (!container) return;
    const categories = [...new Set(menu.map(item => item.cat))].filter(c => c);
    container.innerHTML = categories.map((cat, index) => {
        return `<div class="cat-pill ${index === 0 ? 'active-cat' : ''}" 
                     data-cat="${cat}" 
                     onclick="renderMenu('${cat}', this)">
                     ${cat}
                </div>`;
    }).join('');
}

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

function showView(n) {
    prevView = curView; curView = n;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); v.classList.remove('active'); });
    var t = document.getElementById('view-' + n);
    if (t) { t.classList.remove('hidden'); t.classList.add('active'); t.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.toggle('active-nav', b.dataset.nav === n); });
    if (n === 'cart') renderCart();
}

function goBack() { showView(prevView || 'home'); }

// --- დეტალური გვერდი ოფციებით ---
function openProductDetail(id) {
    var item = getItem(id);
    if (!item) return;

    // საწყისი მნიშვნელობების დაყენება
    selectedOptions = { label: '', extra: 0 };
    
    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-ka').textContent = item.ka;
    document.getElementById('detail-price').textContent = '₾' + item.price.toFixed(2);
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').innerHTML = getMediaHtml(item.emoji, ''); 
    document.getElementById('detail-btn-price').textContent = '₾' + item.price.toFixed(2);

    const optionsCont = document.getElementById('size-options-container');
    const sizeSection = document.getElementById('size-selection');
    
    if (optionsCont) optionsCont.innerHTML = '';

    // ოფციების დამუშავება (მაგ: "25სმ:0, 33სმ:7")
    if (item.options && item.options.includes(':') && sizeSection) {
        sizeSection.classList.remove('hidden');
        const optionsArray = item.options.split(',').map(opt => opt.trim());
        
        optionsArray.forEach((opt, index) => {
            const [label, priceAdd] = opt.split(':');
            const btn = document.createElement('div');
            btn.className = `size-option ${index === 0 ? 'active' : ''}`;
            btn.innerHTML = `<div>${label}</div><div style="font-size:10px; opacity:0.6">+₾${parseFloat(priceAdd).toFixed(2)}</div>`;
            
            if(index === 0) {
                selectedOptions = { label: label, extra: parseFloat(priceAdd) };
            }

            btn.onclick = function() {
                document.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedOptions = { label: label, extra: parseFloat(priceAdd) };
                
                const newPrice = item.price + selectedOptions.extra;
                document.getElementById('detail-price').textContent = '₾' + newPrice.toFixed(2);
                document.getElementById('detail-btn-price').textContent = '₾' + newPrice.toFixed(2);
            };
            optionsCont.appendChild(btn);
        });
    } else if (sizeSection) {
        sizeSection.classList.add('hidden');
    }

    const addBtn = document.getElementById('detail-add-btn');
    addBtn.onclick = function () {
        addToCart(id, selectedOptions);
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
          </div>
          <div class="dish-info">
            <p class="dish-name">${d.name}</p>
            <p class="dish-price">₾${d.price.toFixed(2)}</p>
            <button class="add-btn" onclick="event.stopPropagation();openProductDetail(${d.id})">+</button>
          </div></div>`;
    }).join('');
}

function renderMenu(cat, element) {
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
          <button class="menu-add" onclick="event.stopPropagation();openProductDetail(${i.id})">+</button>
        </div>`;
    }).join('');
}

// CART LOGIC
function getItem(id) { 
    return menu.find(function (d) { return d.id === parseInt(id); }); 
}

function addToCart(id, options = { label: '', extra: 0 }) {
    var it = getItem(id); if (!it) return;
    
    // ვქმნით უნიკალურ გასაღებს კალათისთვის (სახელი + ზომა)
    var cartId = options.label ? id + '-' + options.label : id;
    var finalName = options.label ? it.name + ' (' + options.label + ')' : it.name;
    var finalPrice = it.price + options.extra;

    if (cart[cartId]) {
        cart[cartId].qty++;
    } else {
        cart[cartId] = {
            id: it.id,
            cartId: cartId,
            name: finalName,
            price: finalPrice,
            emoji: it.emoji,
            qty: 1
        };
    }
    badge();
}

function removeFromCart(cartId) {
    if (!cart[cartId]) return;
    cart[cartId].qty--;
    if (cart[cartId].qty <= 0) delete cart[cartId];
    badge(); renderCart();
}

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
              <button class="qty-btn" onclick="removeFromCart('${i.cartId}')">−</button>
              <span class="qty-val">${i.qty}</span>
              <button class="qty-btn plus" onclick="addToCart(${i.id}, {label:'${i.name.includes('(') ? i.name.split('(')[1].replace(')','') : ''}', extra: 0});renderCart()">+</button>
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
