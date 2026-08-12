// ===== NewlyNow — unified contact layer =====
(function () {
  'use strict';
  if(window.__NEWLYNOW_CONTACT__) return;
  window.__NEWLYNOW_CONTACT__=true;
  const CFG = {
    wa: '201055578777',
    messenger: 'official.elawaady',
    tel: '201008002333',
    defaultMsg: 'مرحبًا NewlyNow، أريد الاستفسار عن خدمة.'
  };
  try {
    const c = JSON.parse(localStorage.getItem('newlynowConfig') || localStorage.getItem('elwasetConfig') || 'null');
    if (c && c.contact) {
      if (c.contact.wa) CFG.wa = String(c.contact.wa).replace(/\D/g,'').slice(0,18);
      if (c.contact.messenger) CFG.messenger = String(c.contact.messenger).trim().slice(0,120);
      if (c.contact.tel) CFG.tel = String(c.contact.tel).replace(/\D/g,'').slice(0,18);
    }
  } catch (_) {}
  const enc = encodeURIComponent;
  const waLink = msg => 'https://wa.me/' + CFG.wa + '?text=' + enc(msg || CFG.defaultMsg);
  const mmLink = () => 'https://m.me/' + encodeURIComponent(CFG.messenger) + '?ref=newlynow_site';
  const telLink = () => 'tel:+' + CFG.tel;

  function msgFromWa(href) {
    try { const u = new URL(href, location.href); return u.searchParams.get('text') || ''; }
    catch (_) { return ''; }
  }

  let pop;
  function buildPop() {
    pop = document.createElement('div');
    pop.className = 'contact-pop';
    pop.innerHTML =
      '<div class="cp-card" role="dialog" aria-modal="true" aria-label="اختر طريقة التواصل">' +
      '<button type="button" class="cp-x" aria-label="إغلاق"><i class="fas fa-xmark" aria-hidden="true"></i></button>' +
      '<h3 class="cp-title">اختر طريقة التواصل</h3>' +
      '<p class="cp-sub">اختر الطريقة المناسبة، وفريق NewlyNow هيساعدك.</p>' +
      '<div class="cp-opts">' +
      '<a class="cp-opt cp-wa" data-k="wa" target="_blank" rel="noopener noreferrer"><span class="cp-ic"><i class="fab fa-whatsapp"></i></span><span class="cp-tx"><strong>واتساب</strong><small>الطريقة الأساسية للطلبات والدفع</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '<a class="cp-opt cp-mm" data-k="mm" target="_blank" rel="noopener noreferrer"><span class="cp-ic"><i class="fab fa-facebook-messenger"></i></span><span class="cp-tx"><strong>ماسنجر</strong><small>للاستفسارات العامة</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '<a class="cp-opt cp-tel" data-k="tel"><span class="cp-ic"><i class="fas fa-phone"></i></span><span class="cp-tx"><strong>اتصال هاتفي</strong><small>للحالات التي تحتاج مكالمة</small></span><i class="fas fa-chevron-left cp-go"></i></a>' +
      '</div></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', e => { if (e.target === pop) closePop(); });
    pop.querySelector('.cp-x').addEventListener('click', closePop);
  }
  function openContact(msg) {
    if (!pop) buildPop();
    pop.querySelector('.cp-wa').href = waLink(msg);
    pop.querySelector('.cp-mm').href = mmLink();
    pop.querySelector('.cp-tel').href = telLink();
    pop.classList.add('open');
    document.body.classList.add('lb-open');
    pop.querySelector('.cp-x')?.focus();
  }
  function closePop() { if (pop) { pop.classList.remove('open'); document.body.classList.remove('lb-open'); } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a || a.closest('.cp-card')) return;
    e.preventDefault();
    openContact(msgFromWa(a.href));
  }, true);

  function buildFabs() {
    if(document.querySelector('.contact-fabs')) return;
    document.querySelectorAll('.fab-wa').forEach(el => el.style.display = 'none');
    const wrap = document.createElement('div');
    wrap.className = 'contact-fabs';
    wrap.innerHTML =
      '<div class="cf-menu">' +
      '<a class="cf-btn cf-wa" href="' + waLink(CFG.defaultMsg) + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب"><i class="fab fa-whatsapp"></i><span>واتساب</span></a>' +
      '<a class="cf-btn cf-mm" href="' + mmLink() + '" target="_blank" rel="noopener noreferrer" aria-label="ماسنجر"><i class="fab fa-facebook-messenger"></i><span>ماسنجر</span></a>' +
      '<a class="cf-btn cf-tel" href="' + telLink() + '" aria-label="اتصال"><i class="fas fa-phone"></i><span>اتصال</span></a>' +
      '</div>' +
      '<button type="button" class="cf-toggle" aria-label="تواصل معنا" aria-expanded="false"><i class="fas fa-comments cf-i-open"></i><i class="fas fa-xmark cf-i-close"></i></button>';
    document.body.appendChild(wrap);
    const tog = wrap.querySelector('.cf-toggle');
    tog.addEventListener('click', () => { const open=wrap.classList.toggle('open');tog.setAttribute('aria-expanded',String(open)); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) { wrap.classList.remove('open');tog.setAttribute('aria-expanded','false'); } });
  }

  window.NewlyNowContact = { open: openContact, cfg: CFG };
  window.ElwasetContact = window.NewlyNowContact; // temporary compatibility alias for old templates
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildFabs, {once:true});
  else buildFabs();
})();
