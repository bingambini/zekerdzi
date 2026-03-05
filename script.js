// Telegram WebApp-ის ინიციალიზაცია
const tg = window.Telegram.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpLBRYhfukBU0vU2RNwE0PpLlyGjPVVQkc3AHp5vAdXQOSU9TAmmWWZPdHieue0fhm/exec';

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

// --- შეკვეთების მართვის ლოგიკა ---
let myOrders = []; 

function renderOrders() {
    const container = document.querySelector('#view-orders .mx-5.mt-5');
    if (!container) return;

    if (myOrders.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-[#AAA]">შეკვეთები არ არის</div>';
        return;
    }

    let currentHTML = '<p class="text-[10px] uppercase tracking-widest text-[#AAA] mb-3 font-bold">მიმდინარე</p>';
    let pastHTML = '<p class="text-[10px] uppercase tracking-widest text-[#AAA] mb-3 mt-6 font-bold">წარსული</p>';
    
    let hasCurrent = false;
    let hasPast = false;

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
                        სტატუსი: ${isDelivered ? 'ჩაბარებულია' : 'მზადდება'}
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
            </div>
        `;
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
    overlay.className = 'fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 backdrop-blur-sm';
    
    const itemsHtml = order.items.map(item => `
        <div class="flex justify-between mb-1">
            <span class="flex-1">${item.qty} x ${item.name}</span>
            <span class="ml-2">₾${(item.price * item.qty).toFixed(2)}</span>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="bg-white w-full max-w-[340px] p-8 shadow-2xl relative" style="font-family: monospace; border-radius: 2px;">
            <div class="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <h2 class="font-black text-xl italic uppercase">RECEIPT / ჩეკი</h2>
                <p class="text-[10px] mt-2">ID: #${order.id} | ${order.timestamp}</p>
            </div>
            <div class="text-[11px] mb-4">
                <p class="font-bold underline">მისამართი:</p>
                <p>${order.address || 'მისამართი არ არის'}</p>
            </div>
            <div class="text-[12px] mb-4">${itemsHtml}</div>
            <div class="border-b-2 border-dashed border-gray-300 mb-4"></div>
            <div class="flex justify-between font-black text-lg mb-6">
                <span>ჯამი:</span><span>${order.total}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full bg-[#0D0D0D] text-white py-3 text-[10px] font-bold uppercase">დახურვა</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// --- მონაცემების წამოღება ---
async function fetchMenuData() {
    const cache = localStorage.getItem('menu_cache');
    if (cache) processMenuData(JSON.parse(cache));

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
            unit = (cat.includes('სასმელი') || cat.includes('drink')) ? "მლ" : "გრ";
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
            time: time, weight: rawWeight, unit: unit
        };
    }).filter(item => item.id);

    dishes = formattedData.filter(item => item.bs === true);
    menu = formattedData;

    buildCategoryFilters();
    renderHome('all');
}

// --- Checkout და გაგზავნის ლოგიკა ---

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
        if (method === 'takeaway') addrSection.classList.add('hidden');
        else addrSection.classList.remove('hidden');
    }
    showView('checkout-full');
    updateFinalCheckoutPrice();
}

async function submitFinalOrder(event) {
    if (event) event.preventDefault();
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "იგზავნება...";

    try {
        const name = document.getElementById('checkout-name').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const street = document.getElementById('checkout-street').value.trim();
        const totalText = document.getElementById('final-total-price')?.textContent || '0';
        const total = totalText.replace('₾', '').trim();

        if (!name || !phone || (currentOrderMethod === 'delivery' && !street)) {
            alert("გთხოვთ შეავსოთ აუცილებელი ველები!");
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        const itemsList = Object.values(cart).map(i => `${i.name} (x${i.qty})`).join(', ');

        const orderData = {
            customerName: name,
            phone: phone,
            city: document.getElementById('checkout-city').value,
            street: street,
            items: itemsList,
            total: total,
            method: document.querySelector('input[name="payment-method"]:checked')?.value || 'cash'
        };

        // გაგზავნა Google Sheets-ში
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        // ✅ მონაცემების შენახვა ლოკალურად Orders ტაბისთვის
        const newOrder = {
            id: Math.floor(Math.random() * 10000),
            timestamp: new Date().toLocaleTimeString(),
            items: Object.values(cart),
            total: total + ' ₾',
            address: currentOrderMethod === 'delivery' ? street : 'Self-pickup',
            status: 'pending'
        };
        myOrders.unshift(newOrder);

        alert("მადლობა! შეკვეთა წარმატებით გაიგზავნა.");
        clearCart();
        showView('orders'); // ავტომატურად გადადის შეკვეთებზე

    } catch (error) {
        console.error("Error:", error);
        alert("შეცდომა გაგზავნისას.");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- კალათის ფუნქციები ---

function addToCart(id, options = { label: '', extra: 0 }, extras = []) {
    var it = getItem(id); if (!it) return;
    var extrasKey = extras.map(e => e.label + 'x' + e.qty).sort().join('|');
    var cartId = id + '-' + (options.label || 'std') + '-' + extrasKey;
    var extrasPrice = extras.reduce((sum, e) => sum + (e.price * e.qty), 0);
    var finalPrice = it.price + options.extra + extrasPrice;
    var displayName = it.ka + (options.label ? ` (${options.label})` : '');

    if (cart[cartId]) {
        cart[cartId].qty++;
    } else {
        cart[cartId] = { id: it.id, cartId: cartId, name: displayName, price: finalPrice, emoji: it.emoji, qty: 1 };
    }
    badge();
}

function removeFromCart(cartId) {
    if (!cart[cartId]) return;
    cart[cartId].qty--;
    if (cart[cartId].qty <= 0) delete cart[cartId];
    badge(); renderCart();
}

function clearCart() {
    cart = {};
    badge();
    renderCart();
}

function renderCart() {
    var c = document.getElementById('cart-items');
    if (!c) return;
    var items = Object.values(cart);
    if (!items.length) {
        c.innerHTML = `<div class="text-center py-20">🛒<p>კალათა ცარიელია</p></div>`;
        setSummary(0); return;
    }
    c.innerHTML = items.map(i => `
        <div class="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div class="w-16 h-16 rounded-xl overflow-hidden">${getMediaHtml(i.emoji, 'w-full h-full object-cover')}</div>
            <div class="flex-1">
                <h4 class="font-bold text-sm">${i.name}</h4>
                <p class="text-[#1D6FE8] font-bold">₾${i.price.toFixed(2)}</p>
            </div>
            <div class="flex items-center bg-[#F5F3EF] rounded-xl p-1">
                <button onclick="removeFromCart('${i.cartId}')">−</button>
                <span class="w-6 text-center text-xs font-bold">${i.qty}</span>
                <button onclick="cart['${i.cartId}'].qty++; badge(); renderCart();">+</button>
            </div>
        </div>`).join('');
    setSummary(items.reduce((s, i) => s + i.price * i.qty, 0));
}

// --- დამხმარე ვიზუალური ფუნქციები ---

function showView(n) {
    prevView = curView; curView = n;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    var t = document.getElementById('view-' + n);
    if (t) { t.classList.remove('hidden'); t.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active-nav', b.dataset.nav === n));
    if (n === 'cart') renderCart();
    if (n === 'orders') renderOrders();
}

function badge() {
    var t = Object.values(cart).reduce((s, i) => s + i.qty, 0);
    ['nav-cart-badge', 'menu-cart-badge'].forEach(id => {
        var el = document.getElementById(id); if (!el) return;
        if (t > 0) { el.textContent = t; el.classList.remove('hidden'); } else el.classList.add('hidden');
    });
}

function setSummary(sub) {
    var delivery = (sub > 0 && currentOrderMethod === 'delivery') ? 2.50 : 0;
    var service = sub > 0 ? 1.00 : 0;
    var tot = sub + delivery + service;
    if (document.getElementById('summary-subtotal')) document.getElementById('summary-subtotal').textContent = '₾' + sub.toFixed(2);
    if (document.getElementById('summary-total')) document.getElementById('summary-total').textContent = '₾' + tot.toFixed(2);
    if (document.getElementById('checkout-total')) document.getElementById('checkout-total').textContent = '₾' + tot.toFixed(2);
}

function getItem(id) { return menu.find(d => d.id === parseInt(id)); }

function getMediaHtml(val, cls) {
    if (val && val.startsWith('http')) return `<img src="${val}" class="${cls}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
    return `<div class="${cls} flex items-center justify-center text-2xl">${val}</div>`;
}

// --- ინიციალიზაცია ---
(function () {
    fetchMenuData();
    // Splash screen-ის ლოგიკა...
    setTimeout(() => {
        const s = document.getElementById('splash');
        if (s) { s.style.display = 'none'; document.getElementById('app').classList.remove('hidden'); }
    }, 2000);
})();
