// --- 1. Telegram WebApp-ის ინიციალიზაცია ---
const tg = window.Telegram.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFlguNYQjoIKBzay9ZuCpm1RyoW9aiEO0yM2O59CtNtDuMtSjftBrKoQdwSk4tbwXU/exec';

var dishes = []; 
var menu = [];   
var cart = {}, prevView = 'home', curView = 'home';
var dataLoaded = false; 

// ცვლადები დეტალური გვერდისთვის
var selectedOptions = { label: '', extra: 0 };
var selectedExtras = {}; // დანამატების რაოდენობისთვის { "ყველი": 2 }
var detailQty = 1; 
let currentOrderMethod = 'delivery'; 
let currentDiscount = 0; 

// --- 2. მონაცემების წამოღება და დამუშავება ---
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

// --- 3. Checkout & Bottom Sheet მართვა ---
function openCheckoutFlow() {
    const overlay = document.getElementById('checkout-sheet-overlay');
    const sheet = document.getElementById('checkout-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        sheet.classList.remove('translate-y-full');
    }, 10);
}

function closeCheckoutSheet() {
    const overlay = document.getElementById('checkout-sheet-overlay');
    const sheet = document.getElementById('checkout-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('opacity-100');
    sheet.classList.add('translate-y-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

function handleMethodSelection(method) {
    currentOrderMethod = method;
    closeCheckoutSheet();
    const addrSection = document.getElementById('address-section');
    if (addrSection) {
        method === 'takeaway' ? addrSection.classList.add('hidden') : addrSection.classList.remove('hidden');
    }
    showView('checkout-full');
    updateFinalCheckoutPrice();
}

// --- 4. პრომო კოდი და დინამიური ფასები ---
function togglePromoField() {
    const container = document.getElementById('promo-collapsible');
    const icon = document.getElementById('promo-plus-icon');
    if (!container) return;
    if (container.style.maxHeight) {
        container.style.maxHeight = null;
        if(icon) icon.textContent = '⊕';
    } else {
        container.style.maxHeight = container.scrollHeight + "px";
        if(icon) icon.textContent = '⊖';
    }
}

function applyPromoCode() {
    const input = document.getElementById('promo-input');
    const errorMsg = document.getElementById('promo-error-msg');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    
    if (code === 'WELCOME') {
        currentDiscount = 5;
        input.classList.remove('border-red-500');
        input.classList.add('border-green-500', 'bg-green-50');
        if(errorMsg) errorMsg.classList.add('hidden');
        const okBtn = input.nextElementSibling;
        if(okBtn) {
            okBtn.disabled = true;
            okBtn.classList.replace('bg-[#1D6FE8]', 'bg-green-500');
            okBtn.textContent = '✓';
        }
    } else {
        currentDiscount = 0;
        input.classList.add('border-red-500', 'animate-bounce');
        if(errorMsg) errorMsg.classList.remove('hidden');
        setTimeout(() => input.classList.remove('animate-bounce'), 500);
    }
    updateFinalCheckoutPrice();
}

function updateFinalCheckoutPrice() {
    let subtotal = Object.values(cart).reduce((s, i) => s + (i.price * i.qty), 0);
    let deliveryFee = (currentOrderMethod === 'delivery') ? 2.50 : 0;
    let serviceFee = subtotal > 0 ? 1.00 : 0;
    let totalBefore = subtotal + deliveryFee + serviceFee;
    const priceStack = document.getElementById('price-stack');
    if (!priceStack) return;

    if (currentDiscount > 0) {
        let finalTotal = Math.max(0, totalBefore - currentDiscount);
        priceStack.innerHTML = `
            <span class="text-[11px] text-[#888] line-through font-bold">₾${totalBefore.toFixed(2)}</span>
            <div class="flex items-center text-green-600 font-bold text-[11px] -mt-1"><span>-₾${currentDiscount.toFixed(2)}</span></div>
            <div class="border-t border-[#0D0D0D] mt-0.5 pt-0.5 w-fit">
                <span id="final-total-price" class="text-xl font-black text-[#1D6FE8]">₾${finalTotal.toFixed(2)}</span>
            </div>`;
    } else {
        priceStack.innerHTML = `<span id="final-total-price" class="text-xl font-black text-[#0D0D0D]">₾${totalBefore.toFixed(2)}</span>`;
    }
}

// --- 5. პროდუქტის დეტალები და დანამატები ---
function openProductDetail(id) {
    var item = getItem(id);
    if (!item) return;
    window.currentDetailId = id; 
    selectedOptions = { label: '', extra: 0 };
    selectedExtras = {}; 
    detailQty = 1; 

    const qtyEl = document.querySelector('#view-item-detail .fixed span.w-8');
    if (qtyEl) qtyEl.textContent = detailQty;
    
    document.getElementById('detail-ka').textContent = item.ka;
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').innerHTML = getMediaHtml(item.emoji, ''); 

    // Sizes
    const optionsCont = document.getElementById('size-options-container');
    if (optionsCont) {
        optionsCont.innerHTML = '';
        if (item.options && item.options.includes(':')) {
            document.getElementById('size-selection').classList.remove('hidden');
            item.options.split(',').forEach((opt, index) => {
                const [label, priceAdd] = opt.split(':');
                const btn = document.createElement('div');
                btn.className = `size-pill ${index === 0 ? 'active' : ''}`;
                btn.innerHTML = `<div class="size-info-block"><span class="size-name">${label.trim()}</span><span class="size-price">+₾${parseFloat(priceAdd).toFixed(2)}</span></div>`;
                if(index === 0) selectedOptions = { label: label.trim(), extra: parseFloat(priceAdd) };
                btn.onclick = () => {
                    optionsCont.querySelectorAll('.size-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedOptions = { label: label.trim(), extra: parseFloat(priceAdd) };
                    updateDetailPrice(item.price);
                };
                optionsCont.appendChild(btn);
            });
        } else { document.getElementById('size-selection').classList.add('hidden'); }
    }

    // Extras
    const extrasCont = document.getElementById('extras-options-container');
    if (extrasCont) {
        extrasCont.innerHTML = '';
        if (item.extras && item.extras.trim() !== "") {
            document.getElementById('extras-selection').classList.remove('hidden');
            item.extras.split(',').forEach(ex => {
                const [name, price] = ex.split(':').map(s => s.trim());
                const safeName = name.replace(/\s+/g, '');
                selectedExtras[name] = 0; 
                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm mb-2 border border-[#EEE]";
                div.innerHTML = `
                    <div class="flex flex-col"><span class="text-sm font-semibold">${name}</span><span class="text-[11px] text-[#1D6FE8] font-bold">+₾${parseFloat(price).toFixed(2)}</span></div>
                    <div class="flex items-center bg-[#F5F3EF] rounded-xl p-1 gap-2 border border-[#EEE]">
                        <button onclick="updateExtraQty('${name}', -1, ${price}, ${item.price})" class="extra-minus-${safeName} w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#888] opacity-50 cursor-not-allowed">−</button>
                        <span id="qty-${safeName}" class="w-5 text-center text-xs font-bold">0</span>
                        <button onclick="updateExtraQty('${name}', 1, ${price}, ${item.price})" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#1D6FE8]">+</button>
                    </div>`;
                extrasCont.appendChild(div);
            });
        } else { document.getElementById('extras-selection').classList.add('hidden'); }
    }
    updateDetailPrice(item.price);
    showView('item-detail');
}

function updateExtraQty(name, delta, price, basePrice) {
    const safeName = name.replace(/\s+/g, '');
    const newQty = (selectedExtras[name] || 0) + delta;
    if (newQty >= 0) {
        selectedExtras[name] = newQty;
        document.getElementById(`qty-${safeName}`).innerText = newQty;
        const minusBtn = document.querySelector(`.extra-minus-${safeName}`);
        if (minusBtn) {
            newQty > 0 ? minusBtn.classList.remove('opacity-50', 'cursor-not-allowed') : minusBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        updateDetailPrice(basePrice);
    }
}

function updateDetailPrice(basePrice) {
    let extraToppingsPrice = 0;
    const item = getItem(window.currentDetailId);
    for (const [name, qty] of Object.entries(selectedExtras)) {
        const extraData = item.extras.split(',').find(ex => ex.split(':')[0].trim() === name);
        if (extraData) extraToppingsPrice += (parseFloat(extraData.split(':')[1]) * qty);
    }
    const unitPrice = basePrice + selectedOptions.extra + extraToppingsPrice;
    document.getElementById('detail-price').textContent = '₾' + unitPrice.toFixed(2);
    document.getElementById('detail-btn-price').textContent = '₾' + (unitPrice * detailQty).toFixed(2);
}

// --- 6. კალათის და შეკვეთის ლოგიკა ---
function addToCart(id, options, extras) {
    var it = getItem(id);
    var extrasKey = extras.map(e => e.label + 'x' + e.qty).sort().join('|');
    var cartId = id + '-' + (options.label || 'std') + '-' + extrasKey;
    var extrasPrice = extras.reduce((sum, e) => sum + (e.price * e.qty), 0);
    var finalPrice = it.price + options.extra + extrasPrice;
    var displayName = it.ka + (options.label ? ` (${options.label})` : '');
    if (extras.length > 0) displayName += ' + ' + extras.map(e => `${e.label}(${e.qty})`).join(', ');

    if (cart[cartId]) cart[cartId].qty++;
    else cart[cartId] = { id: it.id, cartId, name: displayName, price: finalPrice, emoji: it.emoji, qty: 1 };
    badge();
}

function submitFinalOrder(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="flex items-center justify-center gap-2"><svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>მუშავდება...</div>`;

    setTimeout(() => {
        clearCart();
        showView('orders');
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (tg.showAlert) tg.showAlert("შეკვეთა წარმატებით გაფორმდა!");
    }, 2500);
}

function clearCart() { cart = {}; badge(); renderCart(); }
function removeFromCart(cartId) { if(cart[cartId].qty > 1) cart[cartId].qty--; else delete cart[cartId]; badge(); renderCart(); }

// --- 7. რენდერი და ნავიგაცია ---
function showView(n) {
    prevView = curView; curView = n;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const t = document.getElementById('view-' + n);
    if (t) { t.classList.remove('hidden'); t.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active-nav', b.dataset.nav === n));
    if (n === 'cart') renderCart();
}

function renderCart() {
    const c = document.getElementById('cart-items');
    const items = Object.values(cart);
    if (!items.length) {
        c.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-4">🛒</div><p class="text-[#888]">კალათა ცარიელია</p></div>`;
        setSummary(0); return;
    }
    c.innerHTML = items.map(i => `
        <div class="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">${getMediaHtml(i.emoji, 'w-full h-full object-cover')}</div>
            <div class="flex-1 min-w-0"><h4 class="font-bold text-sm truncate">${i.name}</h4><p class="text-[#1D6FE8] font-bold text-sm">₾${i.price.toFixed(2)}</p></div>
            <div class="flex items-center bg-[#F5F3EF] rounded-xl p-1">
                <button class="w-7 h-7 font-bold" onclick="removeFromCart('${i.cartId}')">−</button>
                <span class="w-6 text-center text-xs font-bold">${i.qty}</span>
                <button class="w-7 h-7 font-bold" onclick="cart['${i.cartId}'].qty++; badge(); renderCart();">+</button>
            </div>
        </div>`).join('');
    setSummary(items.reduce((s, i) => s + i.price * i.qty, 0));
}

function setSummary(sub) {
    const del = sub > 0 ? 2.50 : 0, ser = sub > 0 ? 1.00 : 0;
    const ids = ['summary-subtotal', 'summary-total', 'checkout-total'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = '₾' + (id==='summary-subtotal'?sub:(sub+del+ser)).toFixed(2); });
}

function badge() {
    const t = Object.values(cart).reduce((s, i) => s + i.qty, 0);
    ['nav-cart-badge', 'menu-cart-badge'].forEach(id => {
        const el = document.getElementById(id); if (el) { el.textContent = t; t > 0 ? el.classList.remove('hidden') : el.classList.add('hidden'); }
    });
}

function buildCategoryFilters() {
    const container = document.querySelector('.cat-pills-container');
    if (!container) return;
    const cats = [...new Set(menu.map(i => i.cat))].filter(c => c);
    container.innerHTML = cats.map((c, i) => `<div class="cat-pill ${i===0?'active-cat':''}" onclick="renderMenu('${c}', this)">${c}</div>`).join('');
}

function renderHome(f) {
    const grid = document.getElementById('dishes-grid');
    const list = (f === 'all') ? dishes : dishes.filter(d => d.cat === f);
    grid.innerHTML = list.map(d => `
        <div class="dish-card bg-white rounded-3xl p-3 shadow-sm flex flex-col h-full cursor-pointer" onclick="openProductDetail(${d.id})">
            <div class="h-32 mb-2 rounded-2xl overflow-hidden">${getMediaHtml(d.emoji, 'w-full h-full object-cover')}</div>
            <h4 class="font-bold text-sm truncate">${d.ka}</h4>
            <div class="flex justify-between items-center mt-auto">
                <span class="text-[#1D6FE8] font-bold text-sm">₾${d.price.toFixed(2)}</span>
                <div class="w-7 h-7 bg-[#1D6FE8] text-white rounded-lg flex items-center justify-center">+</div>
            </div>
        </div>`).join('');
}

function renderMenu(cat, el) {
    if (el) { document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active-cat')); el.classList.add('active-cat'); }
    const items = menu.filter(i => i.cat === cat);
    document.getElementById('menu-list').innerHTML = items.map(i => `
        <div class="bg-white rounded-2xl p-3 flex gap-3 shadow-sm cursor-pointer" onclick="openProductDetail(${i.id})">
            <div class="w-20 h-20 rounded-xl overflow-hidden">${getMediaHtml(i.emoji, 'w-full h-full object-cover')}</div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-sm truncate">${i.ka}</h4>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[#1D6FE8] font-bold text-sm">₾${i.price.toFixed(2)}</span>
                    <div class="w-6 h-6 bg-[#F5F3EF] rounded-lg flex items-center justify-center font-bold">+</div>
                </div>
            </div>
        </div>`).join('');
}

// --- 8. Utility & Splash ---
function getItem(id) { return menu.find(d => d.id === parseInt(id)); }
function getMediaHtml(val, cls) { 
    return (val && val.startsWith('http')) ? `<img src="${val}" class="${cls}" style="width:100%; height:100%; object-fit:cover;">` : `<div class="${cls} flex items-center justify-center text-3xl bg-gray-50">${val}</div>`; 
}

(function () {
    let p = 0;
    const bar = document.getElementById('splash-bar'), pct = document.getElementById('splash-pct');
    const iv = setInterval(() => {
        p += dataLoaded ? 10 : Math.random() * 5;
        if (bar) bar.style.width = Math.min(p, 100) + '%';
        if (pct) pct.textContent = Math.min(Math.round(p), 100) + '%';
        if (p >= 100) {
            clearInterval(iv);
            const s = document.getElementById('splash');
            if (s) { s.style.opacity = '0'; setTimeout(() => { s.style.display = 'none'; document.getElementById('app').classList.remove('hidden'); }, 500); }
        }
    }, 80);
    fetchMenuData();
})();
