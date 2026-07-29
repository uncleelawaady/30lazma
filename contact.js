// ===== Elwaset — unified contact (WhatsApp + Messenger + Call) =====
(function () {
  const CFG = {
    wa: '201055578777',
    messenger: 'official.elawaady',
    tel: '201008002333',
    defaultMsg: 'أهلًا، عايز أتواصل معنا بخصوص خدمة / وساطة.'
  };
  // apply dashboard contact overrides if present
  try {
    const c = JSON.parse(localStorage.getItem('elwasetConfig') || 'null');
    if (c && c.contact) {
      if (c.contact.wa) CFG.wa = c.contact.wa;
      if (c.contact.messenger) CFG.messenger = c.contact.messenger;
      if (c.contact.tel) CFG.tel = c.contact.tel;
    }
  } catch (e) {}
  const enc = encodeURIComponent;
  const waLink = msg => 'https://wa.me/' + CFG.wa + '?text=' + enc(msg || CFG.defaultMsg);
  const mmLink = () => 'https://m.me/' + CFG.messenger + '?ref=elwaset_site';
  const telLink = () => 'tel:+' + CFG.tel;

  // Extract a prefilled message from a wa.me href
  function msgFromWa(href) {
    try { const u = new URL(href); return u.searchParams.get('text') || ''; }
    catch (e) { return ''; }
  }

  // ===== choice popup =====
  let pop;
  function buildPop() {
    pop = document.createElement('div');
    pop.className = 'contact-pop';
    pop.innerHTML =
      '<div class="cp-card" role="dialog" aria-label="اختر طريقة التواصل">' +
      '<button class="cp-x" aria-label="إغلاق"><i class="fas fa-xmark"></i></button>' +
      '<h3 class="cp-title">اختر طريقة التواصل</h3>' +
      '<p class="cp-sub">اختار اللي يناسبك، وهنكون معاك فورًا.</p>' +
      '<div class="cp-opts">' +
      '<a class="cp-opt cp-wa" data-k="wa" target="_blank" rel="noopener"><span class="cp-ic"><i class="fab fa-whatsapp"></i></span><span class="cp-tx"><strong>واتساب</strong><small>رسالتك جاهزة — ابعت فورًا</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '<a class="cp-opt cp-mm" data-k="mm" target="_blank" rel="noopener"><span class="cp-ic"><i class="fab fa-facebook-messenger"></i></span><span class="cp-tx"><strong>ماسنجر</strong><small>تواصل عبر Messenger</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '<a class="cp-opt cp-tel" data-k="tel"><span class="cp-ic"><i class="fas fa-phone"></i></span><span class="cp-tx"><strong>اتصال هاتفي</strong><small>للطوارئ القصوى فقط</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '</div></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', e => { if (e.target === pop) closePop(); });
    pop.querySelector('.cp-x').addEventListener('click', closePop);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  }
  function openContact(msg) {
    if (!pop) buildPop();
    pop.querySelector('.cp-wa').href = waLink(msg);
    pop.querySelector('.cp-mm').href = mmLink();
    pop.querySelector('.cp-tel').href = telLink();
    pop.classList.add('open');
    document.body.classList.add('lb-open');
  }
  function closePop() { if (pop) { pop.classList.remove('open'); document.body.classList.remove('lb-open'); } }

  // ===== intercept every wa.me link → open the 3-way chooser (keeps prefilled text) =====
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;
    e.preventDefault();
    openContact(msgFromWa(a.href));
  }, true);

  // ===== floating contact cluster (all pages) =====
  function buildFabs() {
    // hide any old single whatsapp fab
    document.querySelectorAll('.fab-wa').forEach(el => el.style.display = 'none');

    const wrap = document.createElement('div');
    wrap.className = 'contact-fabs';
    wrap.innerHTML =
      '<div class="cf-menu">' +
      '<a class="cf-btn cf-wa" href="' + waLink(CFG.defaultMsg) + '" target="_blank" rel="noopener" aria-label="واتساب"><i class="fab fa-whatsapp"></i><span>واتساب</span></a>' +
      '<a class="cf-btn cf-mm" href="' + mmLink() + '" target="_blank" rel="noopener" aria-label="ماسنجر"><i class="fab fa-facebook-messenger"></i><span>ماسنجر</span></a>' +
      '<a class="cf-btn cf-tel" href="' + telLink() + '" aria-label="اtصال"><i class="fas fa-phone"></i><span>اتصال</span></a>' +
      '</div>' +
      '<button class="cf-toggle" aria-label="تواصل معنا"><i class="fas fa-comments cf-i-open"></i><i class="fas fa-xmark cf-i-close"></i></button>';
    document.body.appendChild(wrap);
    const tog = wrap.querySelector('.cf-toggle');
    tog.addEventListener('click', () => wrap.classList.toggle('open'));
    // the wa link inside cluster still routes through the chooser via the global interceptor
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });
  }

  window.ElwasetContact = { open: openContact, cfg: CFG };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildFabs);
  else buildFabs();
})();
