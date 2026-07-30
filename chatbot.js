// ===== Elwaset — store chatbot (knowledge-base assistant) =====
// A floating assistant that answers from a keyword-matched knowledge base.
// The knowledge base + bot name/welcome come from Firestore (config/chatbot,
// editable in the dashboard) with a localStorage cache and this built-in seed
// as the offline fallback so the bot always works.
(function () {
  if (window.__elwasetBot) return; window.__elwasetBot = true;

  // ---------- built-in seed knowledge base (editable later from the dashboard) ----------
  const SEED = {
    botName: 'مساعد الوسيط',
    welcome: 'أهلًا! 👋 أنا مساعد الوسيط. أقدر أجاوبك عن خدماتنا، الطلبات، الدفع، الوساطة وقوانينها، والمزيد.\nاختر فئة من الأزرار تحت أو اكتب سؤالك مباشرة:',
    faqs: [
      { q: 'مين إنتوا؟ / من نحن؟', cat: 'عام', kw: 'من نحن,مين انتو,من انتم,العوضي,elawaady,exd,تعريف,المتجر,المنصة',
        a: 'إحنا EXD | Elawaady XDigital — منصة ومتجر متخصص في الخدمات الرقمية، السوشيال ميديا، بيع وشراء ونقل ملكية الحسابات والقنوات والصفحات، التوثيق، الإعلانات، الاشتراكات، الذكاء الاصطناعي والأتمتة، والوساطة الآمنة. هدفنا تنظيم السوق الرقمي وحفظ حقوق كل الأطراف.' },
      { q: 'إيه الخدمات المتاحة؟', cat: 'الخدمات', kw: 'خدمات,الخدمات المتاحة,بتقدموا ايه,services,عندكم ايه',
        a: 'خدماتنا تشمل:\n• خدمات السوشيال ميديا\n• بيع وشراء الحسابات والصفحات والقنوات\n• اشتراكات وأدوات AI\n• الذكاء الاصطناعي والأتمتة\n• المواقع والأنظمة والبوتات\n• تحقيق شروط الربح\n• توثيق الحسابات\n• إدارة الحملات الإعلانية\n• الوساطة الرقمية الآمنة\n• الدومينات الاستثمارية' },
      { q: 'خدمات السوشيال ميديا', cat: 'الخدمات', kw: 'سوشيال,متابعين,لايكات,مشاهدات,تعليقات,شير,ريتش,تفاعل,tiktok,facebook,instagram,snapchat,youtube,تيك توك,فيسبوك,انستجرام',
        a: 'خدمات متكاملة لإدارة وتنمية حسابات السوشيال ميديا: زيادة متابعين، لايكات، مشاهدات، تعليقات، ريتش، شير، رياكت، وإدارة صفحات وحسابات باحتراف على TikTok وFacebook وInstagram وSnapchat وYouTube وX وTelegram وLinkedIn.' },
      { q: 'بيع وشراء الحسابات', cat: 'الخدمات', kw: 'بيع,شراء,حسابات,صفحات,قنوات,نقل ملكية,مفعل ربح,موثق,اشتري,ابيع',
        a: 'بيع وشراء حسابات وصفحات وقنوات رقمية بشكل منظم وآمن (TikTok/Facebook/Instagram/Snapchat/X/YouTube/Telegram/LinkedIn)، مفعّلة ربح أو غير مفعّلة، موثّقة أو عادية، مع توضيح المتابعين والجمهور وحالة الربح والسعر وطريقة نقل الملكية. كل العمليات الحساسة تتم عبر نظام وساطة رسمي.' },
      { q: 'اشتراكات AI', cat: 'الخدمات', kw: 'اشتراكات,ai,chatgpt,claude,gemini,midjourney,canva,ذكاء اصطناعي,اداة',
        a: 'اشتراكات وأدوات ذكاء اصطناعي مثل ChatGPT Plus وClaude وGemini وMidjourney وCanva Pro وAdobe AI وElevenLabs وPerplexity وغيرها — مناسبة لصناع المحتوى والمصممين والمسوقين وأصحاب المتاجر ورواد الأعمال.' },
      { q: 'الذكاء الاصطناعي والأتمتة', cat: 'الخدمات', kw: 'اتمتة,automation,workflow,ai agent,بوت,ربط,n8n,اوتوميشن',
        a: 'حلول AI وAutomation وWorkflow لتشغيل أعمالك: أتمتة الردود، تنظيم الطلبات، ربط المنصات، إدارة العملاء، تلخيص البيانات، إنشاء محتوى تلقائي، وبوتات ذكية — لتقليل العمل اليدوي وزيادة الإنتاجية.' },
      { q: 'المواقع والأنظمة', cat: 'الخدمات', kw: 'مواقع,متاجر,انظمة,موقع,متجر,api,لوحة تحكم,بوتات,برمجة',
        a: 'إنشاء مواقع ومتاجر إلكترونية وأنظمة مخصصة: تصميم الواجهة، تجهيز الأقسام، ربط الدومين والاستضافة ولوحات التحكم، أنظمة طلبات، بوتات Telegram وWhatsApp، ربط API، وأنظمة إدارة عملاء.' },
      { q: 'تحقيق شروط الربح', cat: 'الخدمات', kw: 'شروط الربح,ربح,مونيتايزيشن,ادسنس,مخالفات,يوتيوب,تيك توك,فيسبوك',
        a: 'دعم صناع المحتوى وأصحاب الصفحات والقنوات لتحقيق شروط الربح على Facebook وTikTok وYouTube: مراجعة الحساب، تحديد أسباب الرفض، حل المخالفات، تحسين المحتوى، وخطة مناسبة للوصول لشروط الربح.' },
      { q: 'توثيق الحسابات', cat: 'الخدمات', kw: 'توثيق,علامة زرقاء,verify,verified,توثيق حساب',
        a: 'خدمات توثيق الحسابات الشخصية والتجارية على Facebook وInstagram وTikTok وSnapchat وX وLinkedIn وWhatsApp Business، بعد فحص حالة الحساب وتحديد إمكانية التوثيق والخطوات المطلوبة.' },
      { q: 'إدارة الحملات الإعلانية', cat: 'الخدمات', kw: 'اعلانات,ممول,ads,meta,google ads,tiktok ads,حملة,ميديا باينج',
        a: 'إدارة احترافية لحملات Meta Ads وGoogle Ads وTikTok Ads وSnapchat Ads وYouTube Ads: تحديد الهدف ودراسة الجمهور وتجهيز الخطة ومتابعة الأداء وتحسين النتائج — نتائج قابلة للقياس بدل الصرف العشوائي.' },
      { q: 'الدومينات الاستثمارية', cat: 'الخدمات', kw: 'دومين,دومينات,نطاق,domain,domaining,استثمار',
        a: 'استثمار وبيع أسماء نطاقات مميزة قصيرة وقابلة للتذكر لبناء براندات ومشاريع تقنية وتجارية قوية في مجالات AI والأتمتة وSaaS والتسويق والفيديو والخدمات التقنية.' },
      { q: 'ما هي الوساطة الرقمية؟', cat: 'الوساطة', kw: 'وساطة,وسيط,ضمان,حماية,امان,mediation,نصب',
        a: 'الوساطة نظام رسمي يتم عن طريق أحمد العوضي (صاحب المنصة) لتنظيم البيع والشراء وحماية حقوق البائع والمشتري. بعد تأكيد الصفقة يتم فتح جروب وساطة بين العوضي والبائع والمشتري لتأكيد السعر والبيانات والإثباتات ووقت التسليم، والمبلغ يبقى مع الوسيط لحين إتمام التسليم ونقل الملكية.' },
      { q: 'إزاي الوساطة بتشتغل؟ (الخطوات)', cat: 'الوساطة', kw: 'خطوات الوساطة,ازاي الوساطة,كيف الوساطة,مراحل,اجراءات',
        a: 'الخطوات:\n1) تطلب الوساطة وتتحدد نوع المعاملة والمبلغ.\n2) يتفتح جروب وساطة يضم العوضي + البائع + المشتري.\n3) يتم توثيق الاتفاق: السعر النهائي، عمولة الوسيط، الإثباتات، وقت التسليم، وطريقة نقل الملكية.\n4) المبلغ يتحوّل للوسيط.\n5) يبدأ التنفيذ ونقل الملكية.\n6) بعد تأكيد الاستلام تتحوّل مستحقات البائع. أي نزاع = تجميد المبلغ لحين المراجعة.' },
      { q: 'قوانين الوساطة', cat: 'الوساطة', kw: 'قوانين,شروط الوساطة,قواعد,رولز,rules',
        a: 'قوانين الوساطة:\n1) الاتفاق على السعر بين البائع والمشتري.\n2) المبلغ والعمولة يُرسلان للوسيط.\n3) لا دفع مباشر للبائع إلا بمسؤولية المشتري.\n4) التسليم داخل جروب الوساطة فقط.\n5) نقل الملكية تحت إشراف أحمد العوضي.\n6) لا تحويل لمستحقات البائع إلا بعد تأكيد الاستلام.\n7) عند النزاع يُجمّد المبلغ لحين الحل.\n8) أي اتفاق خارج الجروب لا تتحمله المنصة.\n9) قنوات YouTube لها مدة أمان 7 أيام.\n10) قرار الوسيط بناءً على الإثباتات والاتفاق المكتوب.' },
      { q: 'مدة أمان يوتيوب', cat: 'الوساطة', kw: 'يوتيوب,youtube,7 ايام,مدة امان,نقل قناة',
        a: 'قنوات YouTube لها مدة أمان 7 أيام بعد التسليم بسبب قواعد نقل الملكية في يوتيوب، لضمان استقرار نقل القناة قبل إنهاء الوساطة.' },
      { q: 'إزاي أدفع؟ / طرق الدفع', cat: 'الدفع', kw: 'دفع,ادفع,فلوس,فودافون كاش,انستاباي,فيزا,محفظة,payment,pay',
        a: 'الدفع في خدمات المنصة يتم من خلال المنصة أو الوسيط (العوضي) لضمان حقك — مش مباشرة للتاجر. بندعم وسائل دفع متعددة (محافظ إلكترونية وتحويلات)، وبنأكدلك الطريقة المناسبة وقت الطلب. تواصل معنا لتحديد أنسب وسيلة.' },
      { q: 'إزاي أطلب خدمة؟', cat: 'الطلب', kw: 'اطلب,طلب,ازاي اشتري,كيف اطلب,order,اوردر,شراء خدمة',
        a: 'افتح صفحة الخدمة، جهّز التفاصيل (الكمية/الرابط لو مطلوب) واضغط «اطلب الآن» أو «أضف للسلة». بعد تأكيد الطلب بيتحوّل لواتساب المسؤول بتفاصيل الأوردر لاستكمال التنفيذ أو فتح وساطة لو الصفقة تحتاج ذلك.' },
      { q: 'هل يوجد استرداد للمبلغ؟', cat: 'الاسترداد', kw: 'استرداد,استرجاع,رفند,refund,فلوسي,الغاء',
        a: 'لو لم تُنفّذ الخدمة يمكن استرداد المبلغ حسب حالة الطلب. في معاملات الوساطة المبلغ يبقى مجمّدًا مع الوسيط لحين التسليم، وعند أي نزاع يُجمّد لحين مراجعة الإثباتات واتخاذ القرار المناسب.' },
      { q: 'عايز أبقى تاجر / مقدّم خدمة', cat: 'التاجر', kw: 'تاجر,مورد,مسوق,مقدم خدمة,انضم,اضيف خدمة,merchant,بائع',
        a: 'بنستقبل بيانات مقدّمي الخدمات لإضافتهم بعد المراجعة والتأكد من الجدية وجودة العرض (حسابات، صفحات، قنوات، توثيق، إعلانات، تصميم، مونتاج، بوتات، Automation...). كل مقدّم خدمة يتم تقييمه، ولا تُنشر أي خدمة إلا بعد موافقة الإدارة. سجّل «حساب بائع/تاجر» وتواصل معنا.' },
      { q: 'الجروب الرسمي', cat: 'عام', kw: 'جروب,قروب,مجتمع,تيليجرام,واتساب,قناة,group',
        a: 'عندنا شبكة مجتمعات رسمية على Facebook وWhatsApp وTelegram للبيع والشراء والخدمات والإعلانات. اطلب رابط الجروب الرسمي من الدعم عبر واتساب وهنبعتهولك.' },
      { q: 'إزاي أتواصل مع الدعم؟', cat: 'تواصل', kw: 'تواصل,دعم,support,واتساب,اتصال,مسؤول,خدمة عملاء,contact',
        a: 'الدعم متاح على مدار الساعة عبر واتساب. اضغط زر التواصل (💬) في الموقع أو راسلنا مباشرة وهنكون معاك فورًا لتحديد الخدمة المناسبة أو بدء وساطة آمنة.' }
    ]
  };

  // categories shown as quick chips (order matters)
  const CHIP_ORDER = ['الخدمات', 'الوساطة', 'الدفع', 'الطلب', 'الاسترداد', 'التاجر', 'تواصل', 'عام'];

  // ---------- Arabic-friendly normalization + matcher ----------
  function norm(s) {
    return String(s || '')
      .replace(/[ً-ْٰ]/g, '')     // diacritics
      .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^؀-ۿ\w\s]/g, ' ')      // punctuation
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function scoreFaq(qn, faq) {
    let s = 0;
    const kws = String(faq.kw || '').split(',').map(k => norm(k)).filter(Boolean);
    kws.forEach(k => { if (k && qn.indexOf(k) > -1) s += 3; });
    const qWords = norm(faq.q).split(' ').filter(w => w.length > 2);
    const inWords = qn.split(' ').filter(w => w.length > 2);
    qWords.forEach(w => { if (inWords.indexOf(w) > -1) s += 1; });
    inWords.forEach(w => { if (norm(faq.a).indexOf(w) > -1) s += 0.4; });
    return s;
  }
  function findAnswer(text, faqs) {
    const qn = norm(text);
    if (!qn) return null;
    let best = null, bestScore = 0;
    faqs.forEach(f => { if (f.active === false) return; const sc = scoreFaq(qn, f); if (sc > bestScore) { bestScore = sc; best = f; } });
    return bestScore >= 2 ? best : null;
  }

  // ---------- knowledge base loader (Firestore config/chatbot, cache, seed) ----------
  let KB = null;
  try { const c = JSON.parse(localStorage.getItem('elwasetChatbot') || 'null'); if (c && c.faqs && c.faqs.length) KB = c; } catch (e) {}
  if (!KB) KB = SEED;

  async function loadKB() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) return;
    try {
      const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const app = getApps().some(a => a.name === 'cfgApp') ? getApp('cfgApp') : initializeApp(cfg, 'botApp');
      onSnapshot(doc(getFirestore(app), 'config', 'chatbot'), snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d && Array.isArray(d.faqs) && d.faqs.length) {
            KB = { botName: d.botName || SEED.botName, welcome: d.welcome || SEED.welcome, faqs: d.faqs };
            localStorage.setItem('elwasetChatbot', JSON.stringify(KB));
            refreshStatic();
          }
        }
      });
    } catch (e) { /* keep seed/cache */ }
  }

  // ---------- UI ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  let root, panel, msgs, chipsBox;

  function build() {
    root = document.createElement('div');
    root.className = 'elbot';
    root.innerHTML =
      '<button class="elbot-fab" aria-label="المساعد"><i class="fas fa-robot elbot-i-open"></i><i class="fas fa-xmark elbot-i-close"></i></button>' +
      '<div class="elbot-panel" role="dialog" aria-label="المساعد">' +
        '<div class="elbot-head"><span class="elbot-av"><i class="fas fa-robot"></i></span>' +
          '<div class="elbot-h-tx"><strong class="elbot-name"></strong><small>اسألني عن خدماتنا</small></div>' +
          '<button class="elbot-x" aria-label="إغلاق"><i class="fas fa-xmark"></i></button></div>' +
        '<div class="elbot-msgs"></div>' +
        '<div class="elbot-chips"></div>' +
        '<form class="elbot-input"><input type="text" placeholder="اكتب سؤالك هنا…" aria-label="سؤالك"><button type="submit" aria-label="إرسال"><i class="fas fa-paper-plane"></i></button></form>' +
      '</div>';
    document.body.appendChild(root);
    panel = root.querySelector('.elbot-panel');
    msgs = root.querySelector('.elbot-msgs');
    chipsBox = root.querySelector('.elbot-chips');

    root.querySelector('.elbot-fab').addEventListener('click', toggle);
    root.querySelector('.elbot-x').addEventListener('click', () => setOpen(false));
    root.querySelector('.elbot-input').addEventListener('submit', e => {
      e.preventDefault();
      const inp = root.querySelector('.elbot-input input');
      const v = inp.value.trim(); if (!v) return;
      inp.value = ''; ask(v);
    });
    refreshStatic();
    greet();
  }

  function refreshStatic() {
    if (!root) return;
    root.querySelector('.elbot-name').textContent = KB.botName || 'المساعد';
    // category chips
    const cats = CHIP_ORDER.filter(c => KB.faqs.some(f => f.cat === c && f.active !== false));
    // include any extra categories not in the default order
    KB.faqs.forEach(f => { if (f.cat && f.active !== false && cats.indexOf(f.cat) === -1) cats.push(f.cat); });
    chipsBox.innerHTML = cats.map(c => '<button type="button" class="elbot-chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
    chipsBox.querySelectorAll('.elbot-chip').forEach(b => b.addEventListener('click', () => showCategory(b.dataset.cat)));
  }

  function addMsg(html, who) {
    const d = document.createElement('div');
    d.className = 'elbot-msg ' + (who === 'me' ? 'me' : 'bot');
    d.innerHTML = who === 'me' ? '<div class="elbot-b">' + html + '</div>'
      : '<span class="elbot-av sm"><i class="fas fa-robot"></i></span><div class="elbot-b">' + html + '</div>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  let greeted = false;
  function greet() {
    if (greeted) return; greeted = true;
    addMsg(nl(KB.welcome || SEED.welcome), 'bot');
  }
  function showCategory(cat) {
    addMsg(esc(cat), 'me');
    const list = KB.faqs.filter(f => f.cat === cat && f.active !== false);
    if (!list.length) { addMsg('مفيش أسئلة في القسم ده حاليًا.', 'bot'); return; }
    const b = addMsg('اختر سؤالك من «' + esc(cat) + '»:', 'bot');
    const wrap = document.createElement('div'); wrap.className = 'elbot-sugg';
    list.slice(0, 8).forEach(f => {
      const s = document.createElement('button'); s.type = 'button'; s.className = 'elbot-sg'; s.textContent = f.q;
      s.addEventListener('click', () => { addMsg(esc(f.q), 'me'); setTimeout(() => addMsg(nl(f.a), 'bot'), 180); });
      wrap.appendChild(s);
    });
    b.querySelector('.elbot-b').appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function ask(text) {
    addMsg(esc(text), 'me');
    const hit = findAnswer(text, KB.faqs);
    setTimeout(() => {
      if (hit) { addMsg(nl(hit.a), 'bot'); }
      else {
        const wa = (window.ElwasetContact && window.ElwasetContact.cfg && window.ElwasetContact.cfg.wa) || '201055578777';
        addMsg('معلش، مش متأكد من الإجابة على ده بالظبط 🤔 جرّب تختار فئة من الأزرار، أو تواصل مع الدعم مباشرة:<br>' +
          '<a class="elbot-wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> تواصل مع الدعم</a>', 'bot');
      }
    }, 200);
  }

  function setOpen(v) { root.classList.toggle('open', v); if (v) { greet(); setTimeout(() => { const i = root.querySelector('.elbot-input input'); i && i.focus(); }, 250); } }
  function toggle() { setOpen(!root.classList.contains('open')); }

  function init() { build(); loadKB(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
