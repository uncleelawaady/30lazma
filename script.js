// EXD | Elawaady XDigital — Portfolio Interactions

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Navbar shadow on scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
        navbar.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// Reveal-on-scroll animation
const revealTargets = document.querySelectorAll(
    '.card, .flow-step, .mf, .stat, .about-text, .about-card, .section-head'
);
revealTargets.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

revealTargets.forEach(el => revealObserver.observe(el));

// Animated counters in stats
function animateValue(el, end, duration) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (end - start) * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const counters = document.querySelectorAll('.stat-num[data-count]');
const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            animateValue(el, parseInt(el.dataset.count, 10), 1400);
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

counters.forEach(el => counterObserver.observe(el));

// Active nav link highlighting
const sections = document.querySelectorAll('section[id], header[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 120) {
            current = section.getAttribute('id');
        }
    });
    navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
});
