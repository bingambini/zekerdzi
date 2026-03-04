const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqYWtr5sLnkZFFMhq6eiudBo84je0sPlfrsD-MlDwjDWoPKFqmOQqHl26Y21QedRgc/exec';

var dishes = []; 
var menu = [];   
var cart = {}, prevView = 'home', curView = 'home';
var dataLoaded = false; 

// ცვლადები დეტალური გვერდისთვის
var selectedOptions = { label: '', extra: 0 };
var selectedExtras = {}; // ახალი ობიექტი დანამატების რაოდენობისთვის
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
    
    const qtyEl = document.querySelector('#view-item-detail .fixed span.w-8');
    if (qtyEl) qtyEl.textContent = detailQty;
    
    const item = getItem(window.currentDetailId);
    if (item) updateDetailPrice(item.price);
}

// --- ახალი ფუნქცია დანამატების რაოდენობის შესაცვლელად ---
function updateExtraQty(name, delta, price, basePrice) {
    const safeName = name.replace(/\s+/g, '');
    const currentQty = selectedExtras[name] || 0;
    const newQty = currentQty + delta;

    if (newQty >= 0) {
        selectedExtras[name] = newQty;
        
        const qtyLabel = document.getElementById(`qty-${safeName}`);
        const minusBtn = document.querySelector(`.extra-minus-${safeName}`);
        
        if (qtyLabel) qtyLabel.innerText = newQty;

        if (minusBtn) {
            if (newQty > 0) {
                minusBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                minusBtn.classList.add('text-[#1D6FE8]');
            } else {
                minusBtn.classList.add('opacity-50', 'cursor-not-allowed');
                minusBtn.classList.remove('text-[#1D6FE8]');
            }
        }
        updateDetailPrice(basePrice);
    }
}

function updateDetailPrice(basePrice) {
    let extraToppingsPrice = 0;
    
    // დანამატების ჯამური ფასი რაოდენობების მიხედვით
    for (const [name, qty] of Object.entries(selectedExtras)) {
        const item = getItem(window.currentDetailId);
        const extraData = item.extras.split(',').find(ex => ex.split(':')[0].trim() === name);
        if (extraData) {
            const price = parseFloat(extraData.split(':')[1]);
            extraToppingsPrice += price * qty;
        }
    }

    const unitPrice = basePrice + selectedOptions.extra + extraToppingsPrice;
    const total = unitPrice * detailQty;
    
    const detailPriceEl = document.getElementById('detail-price');
    const detailBtnPriceEl = document.getElementById('detail-btn-price');
    
    if (detailPriceEl) detailPriceEl.textContent = '₾' + unitPrice.toFixed(2);
    if (detailBtnPriceEl) detailBtnPriceEl.textContent = '₾' + total.toFixed(2);
}

function openProductDetail(id) {
    var item = getItem(id);
    if (!item) return;

    window.currentDetailId = id; 
    selectedOptions = { label: '', extra: 0 };
    selectedExtras = {}; // განულება
    detailQty = 1; 
    
    const qtyEl = document.querySelector('#view-item-detail .fixed span.w-8');
    if (qtyEl) qtyEl.textContent = detailQty;
    
    document.getElementById('detail-ka').textContent = item.ka;
    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').innerHTML = getMediaHtml(item.emoji, ''); 

    const badgeContainer = document.querySelector('#view-item-detail .flex.gap-2.mb-6');
    if (badgeContainer) {
        let badgesHtml = '<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⭐ 4.9</div>';
        if (item.time) badgesHtml += `<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⏱️ ${item.time} MIN</div>`;
        if (item.weight) badgesHtml += `<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⚖️ ${item.weight}${item.unit || 'G'}</div>`;
        badgeContainer.innerHTML = badgesHtml;
    }

    const optionsCont = document.getElementById('size-options-container');
    const sizeSection = document.getElementById('size-selection');
    if (optionsCont) {
        optionsCont.innerHTML = '';
        if (item.options && item.options.includes(':')) {
            sizeSection.classList.remove('hidden');
            const optionsArray = item.options.split(',').map(opt => opt.trim());
            optionsArray.forEach((opt, index) => {
                const [label, priceAdd] = opt.split(':');
                const cleanLabel = label.trim();
                const priceVal = parseFloat(priceAdd);
                const btn = document.createElement('div');
                btn.className = `size-pill ${index === 0 ? 'active' : ''}`;
                btn.innerHTML = `<div class="size-info-block"><span class="size-name">${cleanLabel}</span><span class="size-price">+₾${priceVal.toFixed(2)}</span></div>`;
                if(index === 0) selectedOptions = { label: cleanLabel, extra: priceVal };
                btn.onclick = function() {
                    optionsCont.querySelectorAll('.size-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedOptions = { label: cleanLabel, extra: priceVal };
                    updateDetailPrice(item.price);
                };
                optionsCont.appendChild(btn);
            });
        } else if (sizeSection) {
            sizeSection.classList.add('hidden');
        }
    }

    const extrasCont = document.getElementById('extras-options-container');
    const extrasSection = document.getElementById('extras-selection');
    if (extrasCont) {
        extrasCont.innerHTML = '';
        if (item.extras && item.extras.trim() !== "") {
            extrasSection.classList.remove('hidden');
            const extrasArray = item.extras.split(',').map(ex => ex.trim());
            extrasArray.forEach(ex => {
                const [exLabel, exPrice] = ex.split(':');
                const name = exLabel.trim();
                const price = parseFloat(exPrice);
                const safeName = name.replace(/\s+/g, '');
                
                selectedExtras[name] = 0; // ინიციალიზაცია

                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm mb-2 border border-[#EEE]";
                div.innerHTML = `
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold text-[#333]">${name}</span>
                        <span class="text-[11px] text-[#1D6FE8] font-bold">+₾${price.toFixed(2)}</span>
                    </div>
                    <div class="flex items-center bg-[#F5F3EF] rounded-xl p-1 gap-2 border border-[#EEE]">
                        <button onclick="updateExtraQty('${name}', -1, ${price}, ${item.price})" 
                                class="extra-minus-${safeName} w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#888] font-bold active:scale-90 transition-all opacity-50 cursor-not-allowed">
                            −
                        </button>
                        <span id="qty-${safeName}" class="w-5 text-center text-xs font-bold text-[#0D0D0D]">0</span>
                        <button onclick="updateExtraQty('${name}', 1, ${price}, ${item.price})" 
                                class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#1D6FE8] font-bold active:scale-90 transition-all">
                            +
                        </button>
                    </div>`;
                extrasCont.appendChild(div);
            });
        } else if (extrasSection) {
            extrasSection.classList.add('hidden');
        }
    }

    const qtyBtns = document.querySelectorAll('#view-item-detail .fixed button');
    if(qtyBtns.length >= 2) {
        qtyBtns[0].onclick = () => changeDetailQty(-1);
        qtyBtns[1].onclick = () => changeDetailQty(1);
    }

    updateDetailPrice(item.price);

    const addBtn = document.getElementById('detail-add-btn');
    addBtn.onclick = function () {
        const extrasToPush = [];
        for (const [name, qty] of Object.entries(selectedExtras)) {
            if (qty > 0) {
                const itemData = getItem(id);
                const extraData = itemData.extras.split(',').find(ex => ex.split(':')[0].trim() === name);
                const price = parseFloat(extraData.split(':')[1]);
                extrasToPush.push({ label: name, price: price, qty: qty });
            }
        }
        
        for(let i=0; i < detailQty; i++) {
            addToCart(id, selectedOptions, extrasToPush);
        }

        const originalContent = addBtn.innerHTML;
        addBtn.style.background = '#10B981';
        addBtn.innerHTML = '<span>Added to Cart!</span>';
        
        setTimeout(() => {
            addBtn.style.background = '#1D6FE8';
            addBtn.innerHTML = originalContent;
            showView('cart');
        }, 600);
    };

    showView('item-detail');
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
        return `
        <div class="dish-card bg-white rounded-3xl overflow-hidden shadow-sm flex flex-col h-full cursor-pointer" onclick="openProductDetail(${d.id})">
          <div class="relative h-32 overflow-hidden">
            ${getMediaHtml(d.emoji, 'w-full h-full object-cover')}
            ${d.bs ? '<span class="absolute top-2 left-2 bg-[#C9A84C] text-[#0D0D0D] text-[8px] font-bold px-2 py-1 rounded-full uppercase">Best Seller</span>' : ''}
          </div>
          <div class="p-3 flex flex-col flex-1">
            <h4 class="font-bold text-sm text-[#0D0D0D] line-clamp-1">${d.ka}</h4>
            <div class="mt-auto pt-2 flex items-center justify-between">
                <span class="text-[#1D6FE8] font-bold text-sm">₾${d.price.toFixed(2)}</span>
                <button class="w-7 h-7 bg-[#1D6FE8] text-white rounded-lg flex items-center justify-center" onclick="event.stopPropagation();openProductDetail(${d.id})">+</button>
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
    if (!items.length) { el.innerHTML = '<p class="text-center text-[#AAA] py-10">No dishes found</p>'; return; }
    el.innerHTML = items.map(function (i) {
        return `
        <div class="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm cursor-pointer" onclick="openProductDetail(${i.id})">
          <div class="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            ${getMediaHtml(i.emoji, 'w-full h-full object-cover')}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-[#0D0D0D] text-sm truncate">${i.ka}</h4>
            <p class="text-[10px] text-[#888] line-clamp-1 mt-0.5">${i.desc || ''}</p>
            <div class="flex items-center justify-between mt-2">
                <span class="text-[#1D6FE8] font-bold text-sm">₾${i.price.toFixed(2)}</span>
                <button class="w-6 h-6 bg-[#F5F3EF] text-[#0D0D0D] rounded-lg flex items-center justify-center font-bold" onclick="event.stopPropagation();openProductDetail(${i.id})">+</button>
            </div>
          </div>
        </div>`;
    }).join('');
}

function getItem(id) { 
    return menu.find(function (d) { return d.id === parseInt(id); }); 
}

function addToCart(id, options = { label: '', extra: 0 }, extras = []) {
    var it = getItem(id); if (!it) return;
    
    // ქართული სახელის ფორმირება დანამატების რაოდენობით
    var extrasKey = extras.map(e => e.label + 'x' + e.qty).sort().join('|');
    var cartId = id + '-' + (options.label || 'std') + '-' + extrasKey;
    
    var extrasPrice = extras.reduce((sum, e) => sum + (e.price * e.qty), 0);
    var finalPrice = it.price + options.extra + extrasPrice;
    
    var displayName = it.ka;
    if (options.label) displayName += ' (' + options.label + ')';
    if (extras.length > 0) {
        displayName += ' + ' + extras.map(e => `${e.label}(${e.qty})`).join(', ');
    }

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
        c.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-4">🛒</div><p class="text-[#888]">Your cart is empty</p></div>`;
        setSummary(0); return;
    }
    c.innerHTML = items.map(function (i) {
        return `
        <div class="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
          <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">${getMediaHtml(i.emoji, 'w-full h-full object-cover')}</div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm text-[#0D0D0D] truncate">${i.name}</h4>
            <p class="text-[#1D6FE8] font-bold text-sm mt-1">₾${i.price.toFixed(2)}</p>
          </div>
          <div class="flex items-center bg-[#F5F3EF] rounded-xl p-1">
            <button class="w-7 h-7 flex items-center justify-center font-bold" onclick="removeFromCart('${i.cartId}')">−</button>
            <span class="w-6 text-center text-xs font-bold">${i.qty}</span>
            <button class="w-7 h-7 flex items-center justify-center font-bold" onclick="cart['${i.cartId}'].qty++; badge(); renderCart();">+</button>
          </div>
        </div>`;
    }).join('');
    setSummary(items.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
}

function setSummary(sub) {
    var delivery = sub > 0 ? 2.50 : 0;
    var service = sub > 0 ? 1.00 : 0;
    var tot = sub + delivery + service;
    
    const subEl = document.getElementById('summary-subtotal');
    const totEl = document.getElementById('summary-total');
    const checkEl = document.getElementById('checkout-total');
    
    if (subEl) subEl.textContent = '₾' + sub.toFixed(2);
    if (totEl) totEl.textContent = '₾' + tot.toFixed(2);
    if (checkEl) checkEl.textContent = '₾' + tot.toFixed(2);
}

function clearCart() {
    cart = {};
    badge();
    renderCart();
}
