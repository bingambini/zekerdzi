/**
 * Script.js - Version 3.0
 * Updated: 2026-03-05
 * Features: Order History, Promo Codes, Receipt UI, Google Sheets Integration
 */

// --- 1. ინიციალიზაცია და კონფიგურაცია ---
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
var selectedExtras = {}; 
var detailQty = 1; 
let currentOrderMethod = 'delivery'; 
let currentDiscount = 0; 

// შეკვეთების ისტორია
let myOrders = []; 

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

// --- 3. ნავიგაცია და ხედების მართვა ---
function showView(n) {
    prevView = curView; curView = n;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); v.classList.remove('active'); });
    var t = document.getElementById('view-' + n);
    if (t) { t.classList.remove('hidden'); t.classList.add('active'); t.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.toggle('active-nav', b.dataset.nav === n); });
    
    if (n === 'cart') renderCart();
    if (n === 'orders') renderOrders();
}

function goBack() { showView(prevView || 'home'); }

// --- 4. პროდუქტის დეტალური გვერდი ---
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
    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-desc').textContent = item.desc;
    document.getElementById('detail-img').innerHTML = getMediaHtml(item.emoji, ''); 

    // ბეიჯების რენდერი
    const badgeContainer = document.querySelector('#view-item-detail .flex.gap-2.mb-6');
    if (badgeContainer) {
        let badgesHtml = '<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⭐ 4.9</div>';
        if (item.time) badgesHtml += `<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⏱️ ${item.time} MIN</div>`;
        if (item.weight) badgesHtml += `<div class="bg-white px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-[#0D0D0D]">⚖️ ${item.weight}${item.unit || 'G'}</div>`;
        badgeContainer.innerHTML = badgesHtml;
    }

    // ზომების რენდერი
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

    // დამატებების (Extras) რენდერი
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
                selectedExtras[name] = 0; 

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

function updateDetailPrice(basePrice) {
    let extraToppingsPrice = 0;
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

function changeDetailQty(amount) {
    detailQty += amount;
    if (detailQty < 1) detailQty = 1;
    const qtyEl = document.querySelector('#view-item-detail .fixed span.w-8');
    if (qtyEl) qtyEl.textContent = detailQty;
    const item = getItem(window.currentDetailId);
    if (item) updateDetailPrice(item.price);
}

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

// --- 5. კალათა და შეკვეთის ფორმირება ---
function addToCart(id, options = { label: '', extra: 0 }, extras = []) {
    var it = getItem(id); if (!it) return;
    var extrasKey = extras.map(e => e.label + 'x' + e.qty).sort().join('|');
    var cartId = id + '-' + (options.label || 'std') + '-' + extrasKey;
    var extrasPrice = extras.reduce((sum, e) => sum + (e.price * e.qty), 0);
    var finalPrice = it.price + options.extra + extrasPrice;
    var displayName = it.ka;
    if (options.label) displayName += ' (' + options.label + ')';
    if (extras.length > 0) displayName += ' + ' + extras.map(e => `${e.label}(${e.qty})`).join(', ');

    if (cart[cartId]) {
        cart[cartId].qty++;
    } else {
        cart[cartId] = {
            id: it.id, cartId: cartId, name: displayName, price: finalPrice, emoji: it.emoji, qty: 1
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

function badge() {
    var t = Object.values(cart).reduce(function (s, i) { return s + i.qty; }, 0);
    ['nav-cart-badge', 'menu-cart-badge'].forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        if (t > 0) { el.textContent = t; el.classList.remove('hidden'); } else el.classList.add('hidden');
    });
}

function clearCart() {
    cart = {}; badge(); renderCart();
}

// --- 6. შეკვეთების ისტორია და სტატუსები ---
function renderOrders() {
    const container = document.querySelector('#view-orders .mx-5.mt-5');
    if (!container) return;
    if (myOrders.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-[#AAA]">შეკვეთები არ არის</div>';
        return;
    }

    let currentHTML = '<p class="text-[10px] uppercase tracking-widest text-[#AAA] mb-3 font-bold">მიმდინარე</p>';
    let pastHTML = '<p class="text-[10px] uppercase tracking-widest text-[#AAA] mb-3 mt-6 font-bold">წარსული</p>';
    let hasCurrent = false, hasPast = false;

    myOrders.forEach(order => {
        const isDelivered = order.status === 'delivered';
        const card = `
            <div class="bg-white rounded-[24px] p-5 shadow-sm border border-[#F0F0F0] mb-4 transition-all duration-500">
                <div class="flex items-center gap-2 mb-3">
                    <span class="relative flex h-2 w-2">
                        ${isDelivered ? '' : '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1D6FE8] opacity-75"></span>'}
                        <span class="relative inline-flex rounded-full h-2 w-2 ${isDelivered ? 'bg-gray-400' : 'bg-[#1D6FE8]'}"></span>
                    </span>
                    <span class="text-[11px] font-bold ${isDelivered ? 'text-gray-500' : 'text-[#1D6FE8]'} uppercase tracking-tighter">
                        თქვენი შეკვეთის სტატუსი: ${isDelivered ? 'ჩაბარებულია' : 'მზადდება'}
                    </span>
                </div>
                <div class="flex justify-between items-center mb-5">
                    <h4 class="text-lg font-black text-[#0D0D0D]">Order #${order.id}</h4>
                    <span class="text-lg font-black text-[#1D6FE8]">${order.total}</span>
                </div>
                <div class="flex justify-start">
                    <button onclick="showReceipt(${order.id})" 
                            class="bg-[#0D0D0D] text-white px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] active:scale-95 transition-all shadow-lg shadow-black/10">
                        დეტალურად
                    </button>
                </div>
            </div>`;
        if (isDelivered) { pastHTML += card; hasPast = true; } 
        else { currentHTML += card; hasCurrent = true; }
    });
    container.innerHTML = (hasCurrent ? currentHTML : '') + (hasPast ? pastHTML : '');
}

function showReceipt(orderId) {
    const order = myOrders.find(o => o.id === orderId);
    if (!order) return;
    const overlay = document.createElement('div');
    overlay.id = 'receipt-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 backdrop-blur-sm transition-opacity duration-300';
    
    const itemsHtml = order.items.map(item => `
        <div class="flex justify-between mb-1">
            <span class="flex-1">${item.qty} x ${item.name}</span>
            <span class="ml-2">₾${(item.price * item.qty).toFixed(2)}</span>
        </div>`).join('');

    overlay.innerHTML = `
        <div class="bg-white w-full max-w-[340px] p-8 shadow-2xl relative" style="font-family: 'Courier New', Courier, monospace; border-radius: 2px; color: #1a1a1a;">
            <div class="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <h2 class="font-black text-xl italic uppercase tracking-tighter">RECEIPT / ჩეკი</h2>
                <p class="text-[10px] mt-2">ID: #${order.id}</p>
                <p class="text-[10px] uppercase">${order.timestamp} | ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="text-[11px] mb-4 space-y-1">
                <p class="font-bold uppercase underline">მიწოდების მისამართი:</p>
                <p class="leading-tight">${order.address || 'მისამართი არ არის'}</p>
            </div>
            <div class="border-b border-dashed border-gray-300 mb-4"></div>
            <div class="text-[12px] mb-4">${itemsHtml}</div>
            <div class="border-b-2 border-dashed border-gray-300 mb-4"></div>
            <div class="flex justify-between font-black text-lg mb-6 uppercase">
                <span>TOTAL / ჯამი:</span>
                <span>${order.total}</span>
            </div>
            <button onclick="document.getElementById('receipt-modal').remove()" class="w-full bg-[#0D0D0D] text-white py-3 text-[10px] font-bold uppercase tracking-widest">დახურვა</button>
            <div class="absolute -bottom-2 left-0 right-0 h-2 flex overflow-hidden">
                ${Array(12).fill('<div class="min-w-[30px] h-4 bg-white rotate-45 -mt-2 shadow-sm border border-gray-100"></div>').join('')}
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// --- 7. Checkout და Google Sheets ინტეგრაცია ---
async function submitFinalOrder(event) {
    if (event) event.preventDefault();
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "იგზავნება...";

    try {
        const name = document.getElementById('checkout-name').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const city = document.getElementById('checkout-city').value;
        const street = document.getElementById('checkout-street').value.trim();
        const total = document.getElementById('final-total-price')?.textContent.replace('₾', '').trim() || '0';

        if (!name || !phone || !street) {
            alert("გთხოვთ შეავსოთ სახელი, ტელეფონი და ქუჩა!");
            btn.disabled = false; btn.textContent = originalText; return;
        }

        const itemsList = Object.values(cart).map(item => `${item.name} (x${item.qty})`).join(', ');
        const orderData = {
            customerName: name, phone: phone, city: city, street: street, items: itemsList, total: total,
            method: document.querySelector('input[name="payment-method"]:checked')?.value || 'cash'
        };

        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const newOrder = {
            id: Math.floor(Math.random() * 10000), timestamp: new Date().toLocaleTimeString(),
            items: Object.values(cart), total: total + ' ₾', address: street, status: 'pending'
        };
        myOrders.unshift(newOrder); renderOrders();
        alert("მადლობა! შეკვეთა წარმატებით გაიგზავნა.");
        clearCart(); showView('home');
    } catch (error) {
        console.error("Error submitting order:", error); alert("დაფიქსირდა შეცდომა.");
    } finally {
        btn.disabled = false; btn.textContent = originalText;
    }
}

// --- 8. დამხმარე UI ფუნქციები ---
function openCheckoutFlow() {
    const overlay = document.getElementById('checkout-sheet-overlay');
    const sheet = document.getElementById('checkout-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('hidden');
    setTimeout(() => { overlay.classList.add('opacity-100'); sheet.classList.remove('translate-y-full'); }, 10);
}

function closeCheckoutSheet() {
    const overlay = document.getElementById('checkout-sheet-overlay');
    const sheet = document.getElementById('checkout-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('opacity-100'); sheet.classList.add('translate-y-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

function handleMethodSelection(method) {
    currentOrderMethod = method; closeCheckoutSheet();
    const addrSection = document.getElementById('address-section');
    if (addrSection) {
        if (method === 'takeaway') addrSection.classList.add('hidden');
        else addrSection.classList.remove('hidden');
    }
    showView('checkout-full'); updateFinalCheckoutPrice();
}

function applyPromoCode() {
    const input = document.getElementById('promo-input');
    const errorMsg = document.getElementById('promo-error-msg');
    const code = input.value.trim().toUpperCase();
    if (code === 'WELCOME') {
        currentDiscount = 5; input.classList.add('border-green-500', 'bg-green-50');
        if(errorMsg) errorMsg.classList.add('hidden');
    } else {
        currentDiscount = 0; input.classList.add('border-red-500', 'animate-bounce');
        if(errorMsg) errorMsg.classList.remove('hidden');
        setTimeout(() => input.classList.remove('animate-bounce'), 500);
    }
    updateFinalCheckoutPrice();
}

function updateFinalCheckoutPrice() {
    let subtotal = Object.values(cart).reduce((s, i) => s + (i.price * i.qty), 0);
    let deliveryFee = (currentOrderMethod === 'delivery') ? 2.50 : 0;
    let serviceFee = subtotal > 0 ? 1.00 : 0;
    let totalBeforeDiscount = subtotal + deliveryFee + serviceFee;
    const priceStack = document.getElementById('price-stack');
    if (!priceStack) return;

    if (currentDiscount > 0) {
        let finalTotal = Math.max(0, totalBeforeDiscount - currentDiscount);
        priceStack.innerHTML = `<span class="text-[11px] text-[#888] line-through">₾${totalBeforeDiscount.toFixed(2)}</span>
            <div class="text-green-600 font-bold text-[11px]">-₾${currentDiscount.toFixed(2)}</div>
            <div class="border-t border-[#0D0D0D] mt-0.5 pt-0.5"><span id="final-total-price" class="text-xl font-black text-[#1D6FE8]">₾${finalTotal.toFixed(2)}</span></div>`;
    } else {
        priceStack.innerHTML = `<span id="final-total-price" class="text-xl font-black text-[#0D0D0D]">₾${totalBeforeDiscount.toFixed(2)}</span>`;
    }
}

// --- 9. რენდერის ფუნქციები (Home & Menu) ---
function renderHome(f) {
    var list = (f === 'all' || !f) ? dishes : dishes.filter(d => d.cat === f);
    var grid = document.getElementById('dishes-grid');
    if (!grid) return;
    grid.innerHTML = list.map(d => `
        <div class="dish-card bg-white rounded-3xl overflow-hidden shadow-sm flex flex-col h-full cursor-pointer" onclick="openProductDetail(${d.id})">
          <div class="relative h-32 overflow-hidden">${getMediaHtml(d.emoji, 'w-full h-full object-cover')}
            ${d.bs ? '<span class="absolute top-2 left-2 bg-[#C9A84C] text-[#0D0D0D] text-[8px] font-bold px-2 py-1 rounded-full uppercase">Best Seller</span>' : ''}
          </div>
          <div class="p-3 flex flex-col flex-1">
            <h4 class="font-bold text-sm text-[#0D0D0D] line-clamp-1">${d.ka}</h4>
            <div class="mt-auto pt-2 flex items-center justify-between">
                <span class="text-[#1D6FE8] font-bold text-sm">₾${d.price.toFixed(2)}</span>
                <button class="w-7 h-7 bg-[#1D6FE8] text-white rounded-lg flex items-center justify-center">+</button>
            </div>
          </div>
        </div>`).join('');
}

function renderMenu(cat, element) {
    if (element) {
        document.querySelectorAll('.cat-pill').forEach(el => el.classList.remove('active-cat'));
        element.classList.add('active-cat');
    }
    const items = menu.filter(i => i.cat === (cat || (document.querySelector('.cat-pill.active-cat')?.dataset.cat)));
    const el = document.getElementById('menu-list');
    if (!el) return;
    el.innerHTML = items.map(i => `
        <div class="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm cursor-pointer" onclick="openProductDetail(${i.id})">
          <div class="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">${getMediaHtml(i.emoji, 'w-full h-full object-cover')}</div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-[#0D0D0D] text-sm truncate">${i.ka}</h4>
            <p class="text-[10px] text-[#888] line-clamp-1 mt-0.5">${i.desc || ''}</p>
            <div class="flex items-center justify-between mt-2">
                <span class="text-[#1D6FE8] font-bold text-sm">₾${i.price.toFixed(2)}</span>
                <button class="w-6 h-6 bg-[#F5F3EF] text-[#0D0D0D] rounded-lg flex items-center justify-center font-bold">+</button>
            </div>
          </div>
        </div>`).join('');
}

function buildCategoryFilters() {
    const container = document.querySelector('.cat-pills-container');
    if (!container) return;
    const categories = [...new Set(menu.map(item => item.cat))].filter(c => c);
    container.innerHTML = categories.map((cat, index) => 
        `<div class="cat-pill ${index === 0 ? 'active-cat' : ''}" data-cat="${cat}" onclick="renderMenu('${cat}', this)">${cat}</div>`
    ).join('');
}

function getItem(id) { return menu.find(d => d.id === parseInt(id)); }

function getMediaHtml(val, cls) {
    if (val && val.startsWith('http')) return `<img src="${val}" class="${cls}" alt="dish" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
    return `<div class="${cls}">${val}</div>`;
}

// --- 10. Splash Screen & Start ---
(function () {
    var bar = document.getElementById('splash-bar'), pct = document.getElementById('splash-pct'), p = 0;
    var iv = setInterval(function () {
        if (p < 85) p += Math.random() * 5;
        else if (dataLoaded && p < 100) p += 5;
        var currentP = Math.min(Math.round(p), 100);
        if (bar) bar.style.width = currentP + '%';
        if (pct) pct.textContent = currentP + '%';
        if (currentP >= 100) {
            clearInterval(iv);
            var s = document.getElementById('splash');
            if (s) {
                s.style.opacity = '0';
                setTimeout(() => { s.style.display = 'none'; document.getElementById('app').classList.remove('hidden'); }, 500);
            }
        }
    }, 80);
    fetchMenuData();
})();
