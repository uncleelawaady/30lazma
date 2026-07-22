// Smooth scroll behavior for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
    let scrollTop = window.scrollY || document.documentElement.scrollTop;

    if (scrollTop > 100) {
        navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

// Language Toggle
let currentLanguage = 'ar';

function toggleLanguage() {
    const langBtn = document.getElementById('langBtn');
    const html = document.documentElement;

    if (currentLanguage === 'ar') {
        currentLanguage = 'en';
        html.lang = 'en';
        html.dir = 'ltr';
        langBtn.textContent = 'العربية';

        // Translate content
        document.querySelector('.logo h1').textContent = 'EXD';
        document.querySelector('.logo p').textContent = 'Elawaady XDigital';

        // Navigation
        const navLinks = document.querySelectorAll('.nav-links a');
        const navLabels = ['Home', 'About', 'Services', 'Projects', 'Domains', 'Contact'];
        navLinks.forEach((link, index) => {
            link.textContent = navLabels[index];
        });

        // Hero Section
        document.querySelector('.hero-title').textContent = 'Ahmed Elawaady';
        document.querySelector('.hero-subtitle').textContent = 'Founder of EXD | Elawaady XDigital';
        document.querySelector('.hero-description').textContent = 'Specialized in Digital Services, Marketing & Artificial Intelligence';

        const heroButtons = document.querySelectorAll('.hero-buttons .btn');
        heroButtons[0].textContent = 'Contact Me';
        heroButtons[1].textContent = 'My Services';

        // Section Titles
        const sectionTitles = document.querySelectorAll('.section-title');
        const titleLabels = ['About Me', 'Main Services', 'Main Projects', 'Premium Domains', 'Skills & Expertise', 'Contact Me'];
        sectionTitles.forEach((title, index) => {
            title.textContent = titleLabels[index];
        });

        // About Section
        const aboutTexts = document.querySelectorAll('.about-text p');
        aboutTexts[0].innerHTML = 'I\'m Ahmed Elawaady, founder and owner of <strong>EXD | Elawaady XDigital</strong>, a specialized platform and store for digital services, digital marketing and artificial intelligence.';
        aboutTexts[1].innerHTML = 'I have been working in the field of digital services for years and focus on building a strong Arabic brand with global expansion through the <strong>NewlyNow.com</strong> project.';
        aboutTexts[2].innerHTML = 'My goal is to build the largest Arabic platform for digital services based on professionalism, safe brokerage and strong brand identity, with expansion to global markets.';

        const stats = document.querySelectorAll('.stat p');
        stats[0].textContent = 'Years of Experience';
        stats[1].textContent = 'Successful Projects';
        stats[2].textContent = 'Investment Domains';

    } else {
        currentLanguage = 'ar';
        html.lang = 'ar';
        html.dir = 'rtl';
        langBtn.textContent = 'English';

        // Reset to Arabic
        location.reload();
    }

    // Save preference
    localStorage.setItem('language', currentLanguage);
}

// Load saved language preference
window.addEventListener('load', () => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && savedLanguage !== currentLanguage) {
        toggleLanguage();
    }
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe service cards
document.querySelectorAll('.service-card, .project-card, .skill-group').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Smooth counter animation for stats
function animateCounter(element, finalValue, duration = 2000) {
    let startValue = 0;
    const increment = finalValue / (duration / 50);
    const counter = setInterval(() => {
        startValue += increment;
        if (startValue >= finalValue) {
            element.textContent = finalValue + '+';
            clearInterval(counter);
        } else {
            element.textContent = Math.floor(startValue) + '+';
        }
    }, 50);
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            document.querySelectorAll('.stat h3').forEach((stat, index) => {
                const value = parseInt(stat.textContent);
                animateCounter(stat, value);
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const aboutSection = document.querySelector('.about');
if (aboutSection) {
    statsObserver.observe(aboutSection);
}

// Active navigation link
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.style.color = '#fbbf24';
        } else {
            link.style.color = 'white';
        }
    });
});

// Add ripple effect to buttons
document.querySelectorAll('.btn, .project-link').forEach(button => {
    button.addEventListener('click', function (e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    .btn, .project-link {
        position: relative;
        overflow: hidden;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Mobile menu toggle
function setupMobileMenu() {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelector('.nav-links');

    if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
    }
}

window.addEventListener('resize', setupMobileMenu);
setupMobileMenu();

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrollPosition = window.scrollY;
        hero.style.backgroundPosition = `center ${scrollPosition * 0.5}px`;
    }
});

// Add animation to floating boxes
const boxes = document.querySelectorAll('.floating-box');
boxes.forEach((box, index) => {
    box.style.animationDelay = `${index * 2}s`;
});

console.log('Ahmed Elawaady Portfolio loaded successfully! 🚀');
