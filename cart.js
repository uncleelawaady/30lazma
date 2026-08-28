// ===== Elwaset.net — shopping cart (localStorage, static-safe) =====
(function () {
  const KEY = 'elwaset_cart';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = (a) => { localStorage.setItem(KEY, JSON.stringify(a)); render(); };
  const count = () => read().reduce((s, x) => s + (x.qty || 1), 0);
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function add(item) {
    if (!item || !item.name) return;
    const a = read();
    const id = item.id || item.name;
    const ex = a.find(x => x.id === id);
    const extra = {
      category: item.category || '', link: item.link || '', notes: item.notes || '',
      coupon: item.coupon || '', price: item.price || '', code: item.code || '',
      // Frozen at add-to-cart time: name, unit price, package, duration and
      // warranty as they were when the customer chose them. Checkout stores this
      // on the order so a later edit to the service cannot rewrite history.
      snapshot: item.snapshot || null
    };
    if (ex) { ex.qty = (ex.qty || 1) + (item.qty || 1); Object.assign(ex, extra); }
    else a.push(Object.assign({ id, name: item.name, qty: item.qty || 1 }, extra));
    write(a);
    toast('تم إضافة «' + item.name + '» للسلة');
    openDrawer();
  }
  function setQty(id, q) { const a = read(); const it = a.find(x => x.id === id); if (it) it.qty = Math.max(1, q); write(a); }
  function remove(id) { write(read().filter(x => x.id !== id)); }
  function clear() { write([]); }

  // ===== DOM =====
  let fab, badge, drawer, backdrop, listEl, toastEl;
  function build() {
    // floating cart button
    fab = document.createElement('button');
    fab.className = 'cart-fab';
    fab.setAttribute('aria-label', 'السلة');
    fab.innerHTML = '<i class="fas fa-cart-shopping"></i><span class="cart-badge" id="cartBadge">0</span>';
    fab.addEventListener('click', openDrawer);
    document.body.appendChild(fab);
    badge = fab.querySelector('#cartBadge');

    // backdrop + drawer
    backdrop = document.createElement('div');
    backdrop.className = 'cart-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);

    drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.innerHTML =
      '<div class="cart-head"><h3><i class="fas fa-cart-shopping"></i> سلة الطلب</h3>' +
      '<button class="cart-x" aria-label="إغلاق"><i class="fas fa-xmark"></i></button></div>' +
      '<div class="cart-list" id="cartList"></div>' +
      '<div class="cart-foot">' +
      '<div class="cart-count-row"><span>عدد الخدمات</span><strong id="cartCountTxt">0</strong></div>' +
      '<p class="cart-note">السعر النهائي يتحدد عند تأكيد الطلب حسب المواصفات.</p>' +
      '<a href="checkout.html" class="btn btn-grad btn-lg cart-checkout"><i class="fas fa-bolt"></i> إتمام الطلب</a>' +
      '<button class="cart-clear" id="cartClear"><i class="fas fa-trash-can"></i> تفريغ السلة</button>' +
      '</div>';
    document.body.appendChild(drawer);
    listEl = drawer.querySelector('#cartList');
    drawer.querySelector('.cart-x').addEventListener('click', closeDrawer);
    drawer.querySelector('#cartClear').addEventListener('click', clear);

    toastEl = document.createElement('div');
    toastEl.className = 'cart-toast';
    document.body.appendChild(toastEl);
  }

  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  function openDrawer() { if (drawer) { drawer.classList.add('open'); backdrop.classList.add('show'); document.body.classList.add('lb-open'); } }
  function closeDrawer() { if (drawer) { drawer.classList.remove('open'); backdrop.classList.remove('show'); document.body.classList.remove('lb-open'); } }

  function render() {
    const a = read();
    const c = count();
    if (badge) { badge.textContent = c; badge.style.display = c ? 'grid' : 'none'; }
    if (fab) fab.classList.toggle('has', c > 0);
    const ct = drawer && drawer.querySelector('#cartCountTxt');
    if (ct) ct.textContent = c;
    if (!listEl) return;
    if (!a.length) {
      listEl.innerHTML = '<div class="cart-empty"><i class="fas fa-cart-shopping"></i><p>السلة فاضية</p><span>أضف الخدمات اللي عايزها وابدأ طلبك.</span></div>';
      return;
    }
    listEl.innerHTML = a.map(it =>
      '<div class="cart-item" data-id="' + esc(it.id) + '">' +
      '<div class="ci-info"><strong>' + esc(it.name) + '</strong>' +
      (it.category ? '<small>' + esc(it.category) + '</small>' : '') +
      (it.link ? '<small class="ci-link"><i class="fas fa-link"></i> ' + esc(it.link) + '</small>' : '') + '</div>' +
      '<div class="ci-qty"><button class="qm" aria-label="نقص">−</button><span>' + (it.qty || 1) + '</span><button class="qp" aria-label="زيادة">+</button></div>' +
      '<button class="ci-del" aria-label="حذف"><i class="fas fa-xmark"></i></button>' +
      '</div>'
    ).join('');
    listEl.querySelectorAll('.cart-item').forEach(row => {
      const id = row.dataset.id;
      const it = read().find(x => String(x.id) === id);
      row.querySelector('.qm').addEventListener('click', () => setQty(id, (it.qty || 1) - 1));
      row.querySelector('.qp').addEventListener('click', () => setQty(id, (it.qty || 1) + 1));
      row.querySelector('.ci-del').addEventListener('click', () => remove(id));
    });
  }

  // public API
  window.Cart = { add, remove, setQty, clear, read, count, open: openDrawer, close: closeDrawer };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); render(); });
  else { build(); render(); }
})();
