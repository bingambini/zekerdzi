const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqYWtr5sLnkZFFMhq6eiudBo84je0sPlfrsD-MlDwjDWoPKFqmOQqHl26Y21QedRgc/exec';

var dishes = []; 
var menu = [];   
var cart = {}, prevView = 'home', curView = 'home';
var dataLoaded = false; 

// ცვლადები დეტალური გვერდისთვის
var selectedOptions = { label: '', extra: 0 };
var detailQty = 1; 

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
    const formattedData = allData.map(item => {
        const getString = (val) => (val !== undefined && val !== null) ? String(val).trim() : "";
        
        let rawWeight = getString(item.weight);
        let unit = getString(item.unit);
        let time = getString(item.prep_time || item.time);

        if (!unit && rawWeight) {
            const cat = getString(item.category || item.cat).toLowerCase();
            unit = (cat.includes('სასმელი') || cat.includes('drink') || cat.includes('wine')) ? "მლ" : "გრ";
        }

        return {
            id: parseInt(item.id),
            name: getString(item.name),
            ka: getString(item.name_ka || item.ka) || getString(item.name),
            cat: getString(item.category || item.cat),
            price: parseFloat(item.price) || 0,
            desc: getString(item.description || item.desc),
            emoji: getString(item.image || item.emoji) || "🍽️",
            bs: String(item.is_popular || item.bs).toLowerCase() === 'true',
            options: getString(item.options),
            extras: getString(item.extras),
            time: time,    
            weight: rawWeight, 
            unit: unit
        };
    }).filter(item => item.id);

    dishes = formattedData.filter(item => item.bs === true);
    menu = formattedData;

    buildCategoryFilters();
    renderHome('all');
    
    if (menu.length > 0) {
        const uniqueCats = [...new Set(menu.map(i => i.cat))].filter(c => c);
        if (uniqueCats.length > 0) renderMenu(uniqueCats[0]);
    }
}

// --- რაოდენობის მართვის ფუნქციები დეტალურ გვერდზე ---
function changeDetailQty(amount) {
    detailQty += amount;
    if (detailQty < 1) detailQty = 1;
    document.getElementById('detail-qty-val').textContent = detailQty;
    
    // განვაახლოთ ფასი ღილაკზე
    const item = getItem(window.currentDetailId);
    if (item) updateDetailPrice(item.price);
}

function updateDetailPrice(basePrice) {
    let extraToppingsPrice = 0;
    const checkboxes = document.querySelectorAll('#extras-options-container input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        extraToppingsPrice += parseFloat(cb.getAttribute('data-price')) || 0;
    });

    const unitPrice = basePrice + selectedOptions.extra + extraToppingsPrice;
    const total = unitPrice * detailQty;
    
    document.getElementById('detail-price').textContent = '₾' + unitPrice.toFixed(2);
    document.getElementById('detail-btn-price').textContent = '₾' + total.toFixed(2);
}

function openProductDetail(id) {
    var item = getItem(id);
    if (!item) return;

    window.currentDetailId = id; // შევინახოთ მიმდინარე ID
    selectedOptions = { label: '', extra: 0 };
    detailQty = 1; 
    document.getElementById('detail-qty-val').textContent = detailQty;
    
    // სახელები: ქართული (დიდი) და ინგლისური (პატარა)
    document.getElementById('detail-ka').textContent = item.ka;
    document.getElementById('detail-name').textContent = item.name;
    
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').innerHTML = getMediaHtml(item.emoji, ''); 

    // ბეიჯების პირობითი გამოჩენა
    const badgeCont = document.getElementById('detail-badges-container');
    if (badgeCont) {
        let badgesHtml = '<div class="d-badge">⭐ 4.9</div>';
        if (item.time) badgesHtml += `<div class="d-badge">⏱ ${item.time} წთ</div>`;
        if (item.weight) badgesHtml += `<div class="d-badge">⚖ ${item.weight} ${item.unit}</div>`;
        badgeCont.innerHTML = badgesHtml;
    }

    // ზომების და ექსტრების სექცია
    const optionsCont = document.getElementById('size-options-container');
    const sizeSection = document.getElementById('size-selection');
    if (optionsCont) optionsCont.innerHTML = '';

    if (item.options && item.options.includes(':') && sizeSection) {
        sizeSection.classList.remove('hidden');
        const optionsArray = item.options.split(',').map(opt => opt.trim());
        optionsArray.forEach((opt, index) => {
            const [label, priceAdd] = opt.split(':');
            const cleanLabel = label.trim();
            const priceVal = parseFloat(priceAdd);
            const btn = document.createElement('div');
            btn.className = `size-pill ${index === 0 ? 'active' : ''}`;
            btn.innerHTML = `
                <div class="pizza-draft-icon">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="45" stroke-width="4" stroke="currentColor"/>
                        <path d="M50 5V95M5 50H95M18 18L82 82M82 18L18 82" stroke-width="3" stroke="currentColor" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="size-info-block">
                    <span class="size-name">${cleanLabel}</span>
                    <span class="size-price">+₾${priceVal.toFixed(2)}</span>
                </div>`;
            
            if(index === 0) selectedOptions = { label: cleanLabel, extra: priceVal };

            btn.onclick = function() {
                document.querySelectorAll('.size-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedOptions = { label: cleanLabel, extra: priceVal };
                updateDetailPrice(item.price);
            };
            optionsCont.appendChild(btn);
        });
    } else if (sizeSection) {
        sizeSection.classList.add('hidden');
    }

    const extrasCont = document.getElementById('extras-options-container');
    const extrasSection = document.getElementById('extras-selection');
    if (extrasCont) extrasCont.innerHTML = '';

    if (item.extras && item.extras.trim() !== "" && extrasSection) {
        extrasSection.classList.remove('hidden');
        const extrasArray = item.extras.split(',').map(ex => ex.trim());
        extrasArray.forEach(ex => {
            const [exLabel, exPrice] = ex.split(':');
            const div = document.createElement('div');
            div.className = 'extra-item-row';
            div.innerHTML = `
                <label style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #F0F0F0; width:100%; cursor:pointer;">
                    <span style="font-size:14px; color:#2D2D2D;">${exLabel.trim()} (+₾${parseFloat(exPrice).toFixed(2)})</span>
                    <input type="checkbox" data-price="${exPrice}" style="width:20px; height:20px;" onchange="updateDetailPrice(${item.price})">
                </label>`;
            extrasCont.appendChild(div);
        });
    } else if (extrasSection) {
        extrasSection.classList.add('hidden');
    }

    updateDetailPrice(item.price);

    // დამატების ღილაკი ეფექტით
    const addBtn = document.getElementById('detail-add-btn');
    addBtn.onclick = function () {
        const selectedExtras = [];
        document.querySelectorAll('#extras-options-container input[type="checkbox"]:checked').forEach(cb => {
            selectedExtras.push({
                label: cb.closest('label').querySelector('span').textContent.split(' (+₾')[0],
                price: parseFloat(cb.getAttribute('data-price'))
            });
        });
        
        // დამატება მითითებული რაოდენობით
        for(let i=0; i < detailQty; i++) {
            addToCart(id, selectedOptions, selectedExtras);
        }

        // ეფექტი და გადასვლა
        const originalContent = addBtn.innerHTML;
        addBtn.style.background = '#28a745';
        addBtn.innerHTML = '✓ დაემატა კალათაში';
        
        setTimeout(() => {
            addBtn.style.background = '#1D6FE8';
            addBtn.innerHTML = originalContent;
            showView('cart');
        }, 600);
    };

    showView('item-detail');
}

// დანარჩენი ფუნქციები (getMediaHtml, renderHome, renderCart და ა.შ. რჩება უცვლელი)

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

function renderHome(f) {
    var list = (f === 'all' || !f) ? dishes : dishes.filter(function (d) { return d.cat === f; });
    var grid = document.getElementById('dishes-grid');
    if (!grid) return;
    
    grid.innerHTML = list.map(function (d) {
        const timeBadge = d.time ? `<span style="position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,0.6); color:white; padding:4px 10px; border-radius:10px; font-size:10px; backdrop-filter:blur(5px); font-weight:600;">⏱ ${d.time} წთ</span>` : '';
        const weightBadge = d.weight ? `<span style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:4px 10px; border-radius:10px; font-size:10px; backdrop-filter:blur(5px); font-weight:600;">⚖ ${d.weight}${d.unit}</span>` : '';

        return `
        <div class="dish-card" onclick="openProductDetail(${d.id})" style="display: flex; flex-direction: column; overflow:hidden; border-radius: 1.5rem; background: #fff; height: 100%;">
          <div style="position:relative; height:150px; overflow: hidden; border-radius: 1.5rem 1.5rem 0 0;">
            ${getMediaHtml(d.emoji, 'dish-img')}
            ${d.bs ? '<span class="bsb" style="top: 10px; left: 10px; font-size: 10px; padding: 4px 8px;">BEST SELLER</span>' : ''}
            ${timeBadge}
            ${weightBadge}
          </div>
          <div class="dish-info" style="padding: 15px; display: flex; flex-direction: column; flex: 1; justify-content: flex-start;">
            <p class="dish-name" style="margin: 0; font-weight: 700; font-size: 15px; color: #000; line-height: 1.2;">${d.ka}</p>
            <div style="margin-top: 15px; display:flex; justify-content:space-between; align-items:center; width:100%;">
                <p class="dish-price" style="margin:0; color:#1D6FE8; font-weight:800; font-size:18px; letter-spacing: -0.3px;">₾${d.price.toFixed(2)}</p>
                <button class="add-btn" style="position:static; width: 28px; height: 28px; background: #1D6FE8; border-radius: 8px; border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="event.stopPropagation();openProductDetail(${d.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
          </div>
        </div>`;
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
            <p class="menu-name">${i.ka}</p>
            <p class="menu-ka">${i.name}</p>
            <p class="menu-desc">${i.desc}</p>
            <span class="menu-price">₾${i.price.toFixed(2)}</span>
          </div>
          <button class="menu-add" onclick="event.stopPropagation();openProductDetail(${i.id})">+</button>
        </div>`;
    }).join('');
}

function getItem(id) { 
    return menu.find(function (d) { return d.id === parseInt(id); }); 
}

function addToCart(id, options = { label: '', extra: 0 }, extras = []) {
    var it = getItem(id); if (!it) return;
    
    var extrasKey = extras.map(e => e.label).sort().join('|');
    var cartId = id + '-' + options.label + '-' + extrasKey;
    
    var extrasPrice = extras.reduce((sum, e) => sum + e.price, 0);
    var finalPrice = it.price + options.extra + extrasPrice;
    
    var displayName = it.ka;
    if (options.label) displayName += ' (' + options.label + ')';
    if (extras.length > 0) displayName += ' + ' + extras.map(e => e.label).join(', ');

    if (cart[cartId]) {
        cart[cartId].qty++;
    } else {
        cart[cartId] = {
            id: it.id,
            cartId: cartId,
            name: displayName,
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
              <button class="qty-btn plus" onclick="cart['${i.cartId}'].qty++; badge(); renderCart();">+</button>
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
