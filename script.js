// Elwaset.net — interactions

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

// Reveal on scroll
const targets = document.querySelectorAll('.cat, .svc, .port, .rev, .stat, .head, .partners-row span, .cta-box');
targets.forEach(el => el.classList.add('reveal'));
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
