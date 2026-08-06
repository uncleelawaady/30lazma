/* ===== Ahmed Elawaady — Portfolio (elawaady.com) =====
   All editable content lives in the DATA block below.
   Every entry has an Arabic (ar) and English (en) version.
*/

const WHATSAPP = '201055578777';

const DATA = {
  /* Words that rotate in the hero headline */
  typed: {
    ar: ['مؤسس EXD', 'خبير خدمات رقمية', 'وسيط موثوق', 'مطوّر منصات', 'مستثمر دومينات'],
    en: ['Founder of EXD', 'Digital Services Expert', 'Trusted Escrow Agent', 'Platform Builder', 'Domain Investor']
  },

  /* Scrolling strip under the hero */
  marquee: {
    ar: ['وساطة آمنة', 'تسويق سوشيال ميديا', 'توثيق حسابات', 'متاجر إلكترونية', 'بوتات تليجرام', 'هوية بصرية', 'ذكاء اصطناعي', 'دومينات مميزة'],
    en: ['Secure escrow', 'Social media marketing', 'Account verification', 'E-commerce stores', 'Telegram bots', 'Brand identity', 'AI solutions', 'Premium domains']
  },

  services: [
    { icon:'i-swap',      ar:['وساطة آمنة','وسيط موثوق بين البائع والمشتري — الفلوس محفوظة لحد ما الطرفين ياخدوا حقهم بالكامل.'], en:['Secure escrow','A trusted middleman between buyer and seller — funds stay protected until both sides are fully satisfied.'] },
    { icon:'i-megaphone',       ar:['تسويق ونمو','حملات سوشيال ميديا وإدارة صفحات وزيادة حقيقية في الوصول والمبيعات.'], en:['Marketing & growth','Social campaigns, page management and real growth in reach and sales.'] },
    { icon:'i-cart',  ar:['متاجر ومنصات','بناء متجر أو منصة كاملة بلوحة تحكم — جاهزة تستقبل طلبات من أول يوم.'], en:['Stores & platforms','A complete store or platform with an admin dashboard — ready to take orders on day one.'] },
    { icon:'i-palette',        ar:['هوية بصرية وتصميم','لوجو، ألوان، وهوية متكاملة تخلي براندك متميز وسط المنافسين.'], en:['Branding & design','Logo, colors and a full identity that sets your brand apart.'] },
    { icon:'i-robot',          ar:['بوتات وأتمتة','بوتات تليجرام وواتساب وأنظمة أتمتة توفر عليك وقت وشغل يدوي.'], en:['Bots & automation','Telegram and WhatsApp bots plus automation that saves you hours of manual work.'] },
    { icon:'i-sparkles',          ar:['حلول ذكاء اصطناعي','دمج الـ AI في شغلك: محتوى، دعم عملاء، وتحليل بيانات.'], en:['AI solutions','AI woven into your workflow: content, customer support and data analysis.'] },
    { icon:'i-badge',   ar:['توثيق حسابات','توثيق رسمي للحسابات والصفحات بخطوات واضحة وآمنة.'], en:['Account verification','Official verification for accounts and pages, done safely and transparently.'] },
    { icon:'i-globe',          ar:['دومينات واستثمار','شراء وبيع وتقييم الدومينات المميزة — واستشارات استثمار رقمي.'], en:['Domains & investing','Buying, selling and valuing premium domains — plus digital investment advice.'] }
  ],

  work: [
    {
      icon:'i-store', url:'https://elwaset.net',
      ar:['Elwaset.net','المؤسس والمطور','منصة عربية متكاملة للخدمات الرقمية والوساطة الآمنة: متجر، لوحة تحكم، حسابات عملاء، وإثبات تعاملات موثق.'],
      en:['Elwaset.net','Founder & Developer','A full Arabic platform for digital services and secure escrow: storefront, admin dashboard, client accounts and documented proof of deals.'],
      tags:['Platform','Firebase','E-commerce','Escrow']
    },
    {
      icon:'i-layers', url:'',
      ar:['EXD | Elawaady XDigital','المؤسس','الشركة الأم لكل مشاريعي الرقمية — خدمات تسويق وبرمجة وتصميم وإدارة حضور رقمي للعلامات التجارية.'],
      en:['EXD | Elawaady XDigital','Founder','The parent brand behind all my digital work — marketing, development, design and digital presence management for brands.'],
      tags:['Agency','Branding','Growth']
    },
    {
      icon:'i-users', url:'https://t.me/elawaadyofficial',
      ar:['مجتمعات رقمية','المدير والمشرف','قنوات ومجموعات بآلاف الأعضاء في مجالات الربح والخدمات الرقمية والتجارة الإلكترونية.'],
      en:['Digital communities','Manager & Admin','Channels and groups with thousands of members around online income, digital services and e-commerce.'],
      tags:['Telegram','Community','Content']
    },
    {
      icon:'i-globe', url:'',
      ar:['محفظة الدومينات','المستثمر','محفظة أسماء نطاقات مميزة عربية وإنجليزية، مبنية على بحث في السوق والطلب الحقيقي.'],
      en:['Domain portfolio','Investor','A portfolio of premium Arabic and English domain names, built on real market research and demand.'],
      tags:['Domains','Investment']
    },
    {
      icon:'i-robot', url:'',
      ar:['بوتات وأنظمة أتمتة','المطور','بوتات تليجرام لإدارة الطلبات والدفع والدعم، متوصلة مباشرة بلوحات التحكم.'],
      en:['Bots & automation systems','Developer','Telegram bots for order management, payments and support, wired straight into admin dashboards.'],
      tags:['Bots','Automation','APIs']
    },
    {
      icon:'i-chart', url:'',
      ar:['استشارات نمو','المستشار','خطط نمو عملية لأصحاب المشاريع: تسعير، عروض، قنوات تسويق، وتحسين التحويل.'],
      en:['Growth consulting','Consultant','Practical growth plans for business owners: pricing, offers, marketing channels and conversion.'],
      tags:['Strategy','Consulting']
    }
  ],

  domains: [
    { icon:'i-crown',        ar:['دومينات مميزة','أسماء قصيرة وسهلة الحفظ'],       en:['Premium names','Short and memorable'] },
    { icon:'i-globe',     ar:['دومينات عربية','كلمات عربية عالية الطلب'],       en:['Arabic domains','High-demand Arabic keywords'] },
    { icon:'i-cart',ar:['تجارة إلكترونية','مناسبة للمتاجر والمنصات'],     en:['E-commerce','Built for stores and platforms'] },
    { icon:'i-briefcase',    ar:['خدمات وأعمال','لشركات الخدمات والوكالات'],       en:['Services & business','For agencies and service brands'] },
    { icon:'i-chip',    ar:['تقنية وذكاء اصطناعي','لمشاريع التكنولوجيا'],     en:['Tech & AI','For technology ventures'] },
    { icon:'i-coins',        ar:['مالية واستثمار','لمشاريع المال والاستثمار'],     en:['Finance & investing','For fintech and investment projects'] }
  ],

  skills: [
    { ar:'التسويق الرقمي وإدارة الحملات', en:'Digital marketing & campaigns', level:95 },
    { ar:'إدارة المنصات والمتاجر',        en:'Platform & store management',   level:92 },
    { ar:'الوساطة وإدارة الصفقات',        en:'Escrow & deal management',      level:98 },
    { ar:'تطوير الويب والأتمتة',          en:'Web development & automation',  level:85 },
    { ar:'الهوية البصرية والتصميم',       en:'Branding & design',             level:88 },
    { ar:'التفاوض وخدمة العملاء',         en:'Negotiation & client service',  level:96 }
  ],

  tags: ['HTML','CSS','JavaScript','Firebase','Telegram Bots','SEO','Meta Ads','TikTok Ads','Canva','Photoshop','Google Analytics','WordPress','Shopify','n8n','ChatGPT','Midjourney','Notion','Domains'],

  steps: [
    { ar:['نتكلم','نفهم مشروعك وهدفك والميزانية، ونحدد إيه اللي محتاجه فعلاً.'], en:['We talk','We map out your project, goal and budget, and define what you actually need.'] },
    { ar:['خطة وعرض','عرض واضح بالسعر والمدة والمخرجات — من غير مفاجآت.'],       en:['Plan & quote','A clear quote with price, timeline and deliverables — no surprises.'] },
    { ar:['تنفيذ','نبدأ الشغل مع تحديثات مستمرة لحد ما توافق على كل تفصيلة.'],   en:['Execution','We build with continuous updates until you sign off on every detail.'] },
    { ar:['تسليم ومتابعة','تستلم شغلك جاهز، ومعاك دعم ومتابعة بعد التسليم.'],    en:['Delivery & support','You get the finished work, plus support and follow-up after delivery.'] }
  ]
};

/* ===================== Language ===================== */
let lang = localStorage.getItem('elawaadyLang') || 'ar';

function applyLang(l) {
  lang = l;
  localStorage.setItem('elawaadyLang', l);

  const html = document.documentElement;
  html.lang = l;
  html.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('langBtn').textContent = l === 'ar' ? 'EN' : 'ع';

  document.querySelectorAll('[data-ar][data-en]').forEach(el => {
    const val = el.getAttribute('data-' + l);
    if (val != null) el.textContent = val;
  });

  buildSections();
  startTyping();
}

/* ===================== Section builders ===================== */
const t = (item) => item[lang];

function buildSections() {
  // Marquee (duplicated so the loop is seamless)
  const items = DATA.marquee[lang];
  document.getElementById('marqueeTrack').innerHTML = [...items, ...items]
    .map(s => `<span><svg class="ic"><use href="#i-star"/></svg>${s}</span>`).join('');

  // Services
  document.getElementById('servicesGrid').innerHTML = DATA.services.map(s => {
    const [title, desc] = t(s);
    return `<article class="card reveal">
      <div class="card-icon"><svg class="ic"><use href="#${s.icon}"/></svg></div>
      <h3>${title}</h3><p>${desc}</p>
    </article>`;
  }).join('');

  // Work
  document.getElementById('workGrid').innerHTML = DATA.work.map(w => {
    const [title, role, desc] = t(w);
    const link = w.url
      ? `<a class="work-link" href="${w.url}" target="_blank" rel="noopener">
           ${lang === 'ar' ? 'زيارة المشروع' : 'Visit project'} <svg class="ic"><use href="#i-external"/></svg>
         </a>` : '';
    return `<article class="work-card reveal">
      <div class="work-top">
        <div class="work-badge"><svg class="ic"><use href="#${w.icon}"/></svg></div>
        <div><h3>${title}</h3><span class="role">${role}</span></div>
      </div>
      <p>${desc}</p>
      <div class="tags">${w.tags.map(x => `<span>${x}</span>`).join('')}</div>
      ${link}
    </article>`;
  }).join('');

  // Domains
  document.getElementById('domainsGrid').innerHTML = DATA.domains.map(d => {
    const [title, desc] = t(d);
    return `<article class="domain-card reveal">
      <svg class="ic"><use href="#${d.icon}"/></svg><h4>${title}</h4><p>${desc}</p>
    </article>`;
  }).join('');

  // Skills
  document.getElementById('skillsBars').innerHTML = DATA.skills.map(s => `
    <div class="skill">
      <div class="skill-top"><span>${s[lang]}</span><span>${s.level}%</span></div>
      <div class="skill-bar"><i data-level="${s.level}"></i></div>
    </div>`).join('');

  document.getElementById('skillsTags').innerHTML =
    DATA.tags.map(x => `<span>${x}</span>`).join('');

  // Process
  document.getElementById('stepsGrid').innerHTML = DATA.steps.map((s, i) => {
    const [title, desc] = t(s);
    return `<article class="step reveal">
      <div class="step-num">0${i + 1}</div><h3>${title}</h3><p>${desc}</p>
    </article>`;
  }).join('');

  observeReveals();
}

/* ===================== Typing effect ===================== */
let typeTimer;
function startTyping() {
  clearTimeout(typeTimer);
  const el = document.getElementById('typed');
  const words = DATA.typed[lang];
  let w = 0, i = 0, deleting = false;

  (function tick() {
    const word = words[w];
    el.textContent = word.slice(0, i);

    if (!deleting && i < word.length) { i++; typeTimer = setTimeout(tick, 90); }
    else if (!deleting) { deleting = true; typeTimer = setTimeout(tick, 1600); }
    else if (i > 0) { i--; typeTimer = setTimeout(tick, 45); }
    else { deleting = false; w = (w + 1) % words.length; typeTimer = setTimeout(tick, 250); }
  })();
}

/* ===================== Reveal on scroll ===================== */
let revealObserver;
function observeReveals() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        e.target.querySelectorAll('.skill-bar i').forEach(bar => {
          bar.style.width = bar.dataset.level + '%';
        });
        revealObserver.unobserve(e.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -60px 0px' });
  }
  document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}

/* ===================== Counters ===================== */
function runCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    const start = performance.now();
    const dur = 1800;
    (function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(step);
    })(start);
  });
}

/* ===================== Nav, scroll, form ===================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  applyLang(lang);
  runCounters();

  // Language toggle
  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang(lang === 'ar' ? 'en' : 'ar');
  });

  // Mobile menu
  const navLinks = document.getElementById('navLinks');
  document.getElementById('navToggle').addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.addEventListener('click', e => { if (e.target.tagName === 'A') navLinks.classList.remove('open'); });

  // Scroll: navbar state, progress bar, active link
  const nav = document.getElementById('nav');
  const progress = document.getElementById('scrollProgress');
  const sections = [...document.querySelectorAll('section[id], header[id]')];

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    const current = sections.filter(s => s.offsetTop - 120 <= y).pop();
    if (current) {
      document.querySelectorAll('.nav-links a').forEach(a =>
        a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Contact form -> WhatsApp
  document.getElementById('contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const required = ['name', 'contact', 'message'];
    let ok = true;

    required.forEach(n => {
      const input = f.elements[n];
      const empty = !input.value.trim();
      input.classList.toggle('err', empty);
      if (empty) ok = false;
    });
    if (!ok) return;

    const L = lang === 'ar'
      ? { head: 'رسالة من موقع elawaady.com', name: 'الاسم', contact: 'التواصل', service: 'الخدمة', msg: 'التفاصيل' }
      : { head: 'Message from elawaady.com', name: 'Name', contact: 'Contact', service: 'Service', msg: 'Details' };

    const text =
      `*${L.head}*\n\n` +
      `${L.name}: ${f.elements.name.value.trim()}\n` +
      `${L.contact}: ${f.elements.contact.value.trim()}\n` +
      `${L.service}: ${f.elements.service.value}\n` +
      `${L.msg}: ${f.elements.message.value.trim()}`;

    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });
});
