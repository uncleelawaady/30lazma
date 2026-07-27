// Elwaset.net — interactions

// Proofs lightbox
(function () {
    const items = [...document.querySelectorAll('.proof-item')];
    const lb = document.getElementById('lightbox');
    if (!items.length || !lb) return;
    const lbImg = document.getElementById('lbImg');
    const srcs = items.map(b => b.dataset.src);
    let idx = 0;
    const show = i => { idx = (i + srcs.length) % srcs.length; lbImg.src = srcs[idx]; };
    const open = i => { show(i); lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); document.body.classList.add('lb-open'); };
    const close = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lb-open'); };
    items.forEach((b, i) => b.addEventListener('click', () => open(i)));
    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbNext').addEventListener('click', () => show(idx + 1));
    document.getElementById('lbPrev').addEventListener('click', () => show(idx - 1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(idx + 1);
        if (e.key === 'ArrowRight') show(idx - 1);
    });
})();

// Mobile nav
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
        const t = document.querySelector(this.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
});

// Nav shadow on scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 20 ? '0 10px 40px rgba(0,0,0,.5)' : 'none';
});

// Reveal on scroll (3D pop-in)
const targets = document.querySelectorAll('.cat, .svc, .port, .rev, .stat, .head, .partners-row span, .cta-box');
targets.forEach(el => el.classList.add('reveal'));
// stagger cards inside their grids so they fly in one after another
document.querySelectorAll('.cat-grid, .svc-grid, .port-grid, .stats-grid').forEach(grid => {
    [...grid.children].forEach((c, i) => {
        if (c.classList.contains('reveal')) c.style.transitionDelay = (Math.min(i, 9) * 65) + 'ms';
    });
});
const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('show'); io.unobserve(en.target); } });
}, { threshold: 0.1 });
targets.forEach(el => io.observe(el));

// Counters
function animate(el, end, dur) {
    const start = performance.now();
    function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(end * eased).toLocaleString('en');
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}
const counters = document.querySelectorAll('[data-count]');
const cio = new IntersectionObserver(entries => {
    entries.forEach(en => {
        if (en.isIntersecting) { animate(en.target, parseInt(en.target.dataset.count, 10), 1500); cio.unobserve(en.target); }
    });
}, { threshold: 0.5 });
counters.forEach(el => cio.observe(el));

// Search -> filter categories (scroll + highlight), fallback to WhatsApp
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
function runSearch() {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) { document.getElementById('categories').scrollIntoView({ behavior: 'smooth' }); return; }
    const cats = document.querySelectorAll('.cat');
    let firstMatch = null;
    cats.forEach(c => {
        const txt = c.textContent.toLowerCase();
        const hit = txt.includes(q);
        c.style.opacity = hit ? '1' : '0.25';
        c.style.filter = hit ? 'none' : 'grayscale(0.6)';
        if (hit && !firstMatch) firstMatch = c;
    });
    if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else window.open('https://wa.me/201055578777?text=' + encodeURIComponent('عايز أستفسر عن: ' + searchInput.value), '_blank');
}
if (searchBtn) searchBtn.addEventListener('click', runSearch);
if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
// reset filter when cleared
if (searchInput) searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) document.querySelectorAll('.cat').forEach(c => { c.style.opacity = '1'; c.style.filter = 'none'; });
});

// Active nav link
const sections = document.querySelectorAll('section[id], header[id]');
const anchors = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
    let cur = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 130) cur = s.getAttribute('id'); });
    anchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
});

// ===== Testimonials: two marquee rows, 80% positive / 20% neutral =====
(function () {
    const top = document.getElementById('revRowTop');
    const bot = document.getElementById('revRowBot');
    if (!top || !bot) return;

    const names = ['أحمد محمد','محمود إبراهيم','كريم عادل','مصطفى سعيد','عمرو خالد','يوسف حسن','إسلام طارق','محمد فؤاد','عبدالله ناصر','حسام الدين','طارق منير','وليد شعبان','رامي صبحي','شريف جمال','هاني مختار','باسم رفعت','عمر السيد','زياد أنور','تامر عبدالله','خالد فتحي','سيف الدين','مازن يحيى','أدهم رضا','نادر سمير','فادي بشير','سارة أحمد','منى كمال','دينا وحيد','ريهام فاروق','نورهان عماد'];
    const positive = [
        'تعامل محترم وسرعة في إنهاء الصفقة، وسيط يستحق الثقة.',
        'تمت الوساطة بكل احترافية وكل شيء كان واضح من البداية.',
        'أنصح بالتعامل مع العوضي، التزام ومصداقية.',
        'أول مرة أتعامل وكانت تجربة ممتازة.',
        'استلمت الخدمة زي ما اتفقنا من غير أي مشاكل.',
        'وسيط أمين ويتابع الصفقة لحد ما تخلص.',
        'شكراً على حسن التعامل وسرعة التنفيذ.',
        'كل خطوة كانت موثقة وواضحة.',
        'خدمة راقية وتعامل محترم.',
        'وسيط يعتمد عليه في الصفقات الكبيرة.',
        'تم استلام الحساب بنجاح وكل حاجة كانت ممتازة.',
        'من أفضل الوسطاء اللي تعاملت معاهم.',
        'تجربة ناجحة وهتعامل معاه تاني.',
        'حوّلت المبلغ واستلمت الخدمة بأمان.',
        'واضح إنه صاحب خبرة كبيرة.',
        'شكراً على الأمانة والالتزام.',
        'وسيط ممتاز ويستحق كل التقدير.',
        'مصداقية عالية جدًا في التعامل.',
        'شعرت بالأمان طول الصفقة.',
        'التزام بالمواعيد وتنفيذ سريع.',
        'راجل بيطمّنك أثناء الصفقة.',
        'أفضل وسيط تعاملت معاه لحد دلوقتي.',
        'كله تم بطريقة احترافية ومنظمة.',
        'أنصح أي حد بيدور على وسيط موثوق يتعامل معاه.'
    ];
    const neutral = [
        'العوضي مضمون وأمين، بس بيتأخر شوية في الرد.',
        'راجل محترم وموثوق، إنما بعتّله من فترة وماردّش بسرعة.',
        'الوساطة مضمونة، بس محتاج يسرّع في الرد شوية.',
        'وسيط أمين، لكن طلبت منه خدمة واتأخرت عليّ.',
        'مضمون في الصفقات، إنما مرة طلبت خدمة وماجابهاش في الوقت.',
        'كويس وأمين، بس الرد أحيانًا بيتأخر.'
    ];
    const badges = ['مضمون', 'ضمان'];

    // build review objects: every 5th is neutral (~20%)
    const reviews = [];
    let np = 0, nn = 0;
    for (let i = 0; i < 30; i++) {
        const isNeu = (i % 5 === 4); // 20%
        reviews.push({
            name: names[i % names.length],
            text: isNeu ? neutral[nn++ % neutral.length] : positive[np++ % positive.length],
            rating: isNeu ? 3 : 5,
            neutral: isNeu,
            badge: badges[i % 2]
        });
    }

    function card(r) {
        let stars = '';
        for (let s = 0; s < 5; s++) stars += '<i class="fas fa-star' + (s < r.rating ? '' : ' off') + '"></i>';
        const bcls = r.neutral ? 'tbadge tbadge-warn' : 'tbadge';
        return '<div class="tcard' + (r.neutral ? ' tcard-neu' : '') + '">' +
            '<div class="tcard-top"><span class="stars">' + stars + '</span>' +
            '<span class="' + bcls + '"><i class="fas fa-shield-halved"></i> ' + r.badge + '</span></div>' +
            '<p>' + r.text + '</p>' +
            '<div class="tby"><span class="av">' + r.name.charAt(0) + '</span>' +
            '<div><strong>' + r.name + '</strong><small><i class="fas fa-circle-check"></i> عميل موثّق</small></div></div>' +
            '</div>';
    }

    // split into two rows, duplicate each row for seamless marquee
    const half = Math.ceil(reviews.length / 2);
    const rowA = reviews.slice(0, half).map(card).join('');
    const rowB = reviews.slice(half).map(card).join('');
    top.innerHTML = rowA + rowA;
    bot.innerHTML = rowB + rowB;
})();
