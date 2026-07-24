// EXD | Elawaady XDigital — Portfolio Interactions

// ===== Service details data =====
const WHATSAPP = 'https://wa.me/201055578777';

const SERVICES = {
    'social': {
        icon: 'fa-hashtag',
        title: 'خدمات السوشيال ميديا',
        body: `<p>نقدم داخل EXD | Elawaady XDigital مجموعة واسعة من خدمات السوشيال ميديا للأفراد والشركات وصناع المحتوى، تشمل <strong>زيادة المتابعين، اللايكات، المشاهدات، التعليقات، الريتش، الشير، الريأكت</strong>، وإدارة الصفحات والحسابات بشكل احترافي.</p>
        <p>نساعدك على بناء حضور رقمي قوي على TikTok وFacebook وInstagram وSnapchat وYouTube وX وTelegram وLinkedIn، مع التركيز على تحسين الشكل العام للحساب، رفع التفاعل، دعم النمو، وتحقيق نتائج واضحة حسب هدف كل عميل.</p>`
    },
    'accounts': {
        icon: 'fa-right-left',
        title: 'بيع وشراء الحسابات',
        body: `<p>نوفر خدمة بيع وشراء الحسابات والصفحات والقنوات الرقمية بشكل منظم وآمن، وتشمل حسابات <strong>TikTok وFacebook وInstagram وSnapchat وX وYouTube وTelegram وLinkedIn</strong>.</p>
        <p>يتم التعامل مع الحسابات حسب حالتها، سواء كانت مفعلة ربح أو غير مفعلة، موثقة أو عادية، مع توضيح عدد المتابعين، نوع الجمهور، حالة الربح، السعر، وطريقة نقل الملكية.</p>
        <p><strong>جميع العمليات الحساسة تتم من خلال نظام وساطة رسمي</strong> لضمان حقوق البائع والمشتري، ولا يتم اعتماد أي صفقة إلا بعد مراجعة البيانات والإثباتات.</p>`
    },
    'ai-subs': {
        icon: 'fa-key',
        title: 'اشتراكات AI',
        body: `<p>نوفر مجموعة من اشتراكات وأدوات الذكاء الاصطناعي التي تساعد الأفراد والشركات على إنجاز أعمالهم بشكل أسرع وأكثر احترافية، مثل <strong>ChatGPT Plus وClaude وGemini وMidjourney وCanva Pro وAdobe AI وElevenLabs وPerplexity</strong> وغيرها من الأدوات الرقمية.</p>
        <p>الخدمة مناسبة لصناع المحتوى، المصممين، المسوقين، أصحاب المتاجر، فرق العمل، ورواد الأعمال الذين يحتاجون إلى أدوات إنتاج محتوى، تصميم، كتابة، تحليل، صوت، فيديو، وأتمتة.</p>`
    },
    'automation': {
        icon: 'fa-robot',
        title: 'الذكاء الاصطناعي والأتمتة',
        body: `<p>نساعدك على استخدام الذكاء الاصطناعي والأتمتة في إدارة أعمالك اليومية من خلال بناء <strong>Workflow، أنظمة Automation، وAI Agents</strong> مخصصة حسب احتياجك.</p>
        <p>تشمل الخدمات أتمتة الردود، تنظيم الطلبات، ربط المنصات، إدارة العملاء، تلخيص البيانات، إنشاء محتوى تلقائي، تشغيل بوتات ذكية، وربط الأدوات المختلفة لتقليل العمل اليدوي وزيادة الإنتاجية.</p>
        <p>هدفنا تحويل العمليات المتكررة إلى نظام ذكي يعمل بشكل منظم ويوفر الوقت والمجهود.</p>`
    },
    'web': {
        icon: 'fa-code',
        title: 'المواقع والأنظمة',
        body: `<p>نقدم خدمات إنشاء المواقع الإلكترونية والمتاجر الرقمية والأنظمة المخصصة للشركات والأفراد، بداية من تصميم الواجهة وتجهيز الأقسام وحتى <strong>ربط الدومين والاستضافة ولوحات التحكم</strong>.</p>
        <p>تشمل الخدمات إنشاء متاجر خدمات رقمية، مواقع تعريفية، أنظمة طلبات، بوتات Telegram وWhatsApp، ربط API، أنظمة إدارة العملاء، وأنظمة تشغيل داخلية تساعد على تنظيم الشغل والطلبات.</p>
        <p>كل مشروع يتم تنفيذه حسب طبيعة النشاط والهدف التجاري للعميل.</p>`
    },
    'monetization': {
        icon: 'fa-sack-dollar',
        title: 'تحقيق شروط الربح',
        body: `<p>نقدم خدمات دعم لصناع المحتوى وأصحاب الصفحات والقنوات لتحقيق شروط الربح على منصات <strong>Facebook وTikTok وYouTube</strong>، مع تقديم نصائح لتحسين المحتوى ورفع الأداء.</p>
        <p>تشمل الخدمة مراجعة الحساب أو الصفحة، تحديد أسباب عدم قبول الربح، حل مشاكل المخالفات، تحسين المحتوى، متابعة التحديثات، وتقديم خطة مناسبة للوصول إلى شروط الربح المطلوبة.</p>
        <p>الخدمة مناسبة لصناع المحتوى الجدد وأصحاب الصفحات التي تحتاج إلى تنظيم وتطوير قبل التقديم على الربح.</p>`
    },
    'verification': {
        icon: 'fa-circle-check',
        title: 'توثيق الحسابات',
        body: `<p>نوفر خدمات توثيق الحسابات على المنصات المختلفة مثل <strong>Facebook وInstagram وTikTok وSnapchat وX وLinkedIn وWhatsApp Business</strong>، مع فحص حالة الحساب وتحديد إمكانية التوثيق والخطوات المطلوبة.</p>
        <p>الخدمة تشمل الحسابات الشخصية والتجارية، ودعم تجهيز الهوية الرقمية، تحسين شكل الحساب، مراجعة البيانات، وربط الحساب بالبراند أو النشاط التجاري عند الحاجة.</p>
        <p>يتم تحديد التفاصيل بعد فحص الحساب والمنصة ونوع التوثيق المطلوب.</p>`
    },
    'ads': {
        icon: 'fa-bullhorn',
        title: 'إدارة الحملات الإعلانية',
        body: `<p>نقدم خدمات إدارة الحملات الإعلانية الممولة على مختلف المنصات، بما يشمل <strong>Meta Ads وGoogle Ads وTikTok Ads وSnapchat Ads وYouTube Ads</strong>.</p>
        <p>نبدأ بفهم النشاط التجاري، تحديد الهدف الإعلاني، دراسة الجمهور، تجهيز الخطة، متابعة الأداء، وتحسين النتائج بشكل مستمر.</p>
        <p>الخدمة مناسبة للمتاجر، الصفحات، مقدمي الخدمات، صناع المحتوى، الشركات، وأصحاب المشاريع الذين يريدون <strong>نتائج قابلة للقياس</strong> بدل صرف عشوائي على الإعلانات.</p>`
    },
    'mediation-card': {
        icon: 'fa-handshake',
        title: 'الوساطة الرقمية',
        body: `<p>نظام الوساطة داخل EXD | Elawaady XDigital يتم عن طريق <strong>أحمد العوضي بصفته وسيطًا رسميًا وصاحب المنصة</strong>، ويهدف إلى تنظيم عمليات البيع والشراء وحماية حقوق البائع والمشتري.</p>
        <p>تشمل الوساطة بيع وشراء حسابات Facebook وInstagram وTikTok وSnapchat وX، وقنوات YouTube وTelegram، وصفحات Facebook وLinkedIn وغيرها من الأصول الرقمية.</p>
        <p>بعد تأكيد الخدمة يتم فتح <strong>جروب وساطة</strong> بين العوضي والمشتري والبائع، ويتم تأكيد السعر والبيانات والإثباتات ووقت التسليم، ثم إرسال المبلغ والعمولة للوسيط، وبعد إتمام التسليم ونقل الملكية يتم تحويل مستحقات البائع حسب قوانين الاتفاق.</p>
        <p><a href="#mediation" style="color:var(--gold-light);font-weight:800;">اطلع على خطوات وقوانين الوساطة كاملة ↓</a></p>`
    },
    'domains': {
        icon: 'fa-globe',
        title: 'الدومينات الاستثمارية',
        body: `<p>أعمل أيضًا في مجال الاستثمار في الدومينات المميزة <strong>Domaining</strong>، من خلال امتلاك وتطوير أسماء نطاقات قابلة لبناء مشاريع تقنية وتجارية قوية.</p>
        <p>تشمل الدومينات مجالات الذكاء الاصطناعي، الأتمتة، SaaS، الصحة، البراندات الرقمية، التسويق، الفيديو، والخدمات التقنية.</p>
        <p>الهدف هو اختيار أسماء قصيرة، قابلة للتذكر، مناسبة للتوسع العالمي، ويمكن استخدامها في بناء شركات أو منتجات رقمية أو منصات مستقبلية.</p>`
    }
};

// ===== Modal logic =====
const modalOverlay = document.getElementById('serviceModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalOrder = document.getElementById('modalOrder');
const modalEscrow = document.getElementById('modalEscrow');
const modalClose = document.getElementById('modalClose');

function openService(key) {
    const s = SERVICES[key];
    if (!s) return;
    modalIcon.innerHTML = `<i class="fas ${s.icon}"></i>`;
    modalTitle.textContent = s.title;
    modalBody.innerHTML = s.body;
    modalOrder.href = WHATSAPP + '?text=' + encodeURIComponent('أهلًا، عاوز أطلب خدمة: ' + s.title);
    modalEscrow.href = WHATSAPP + '?text=' + encodeURIComponent('أهلًا، عاوز أبدأ وساطة آمنة بخصوص: ' + s.title);
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

document.querySelectorAll('.service-card[data-service]').forEach(card => {
    card.addEventListener('click', () => openService(card.dataset.service));
});

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});
// Close modal when internal anchor (e.g. mediation link) is clicked
modalBody.addEventListener('click', e => {
    if (e.target.closest('a[href^="#"]')) closeModal();
});

// ===== Mobile nav toggle =====
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

// ===== Smooth scroll for anchor links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===== Navbar shadow on scroll =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
        navbar.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// ===== Reveal-on-scroll animation =====
const revealTargets = document.querySelectorAll(
    '.card, .flow-step, .mf, .stat, .about-text, .about-card, .section-head, .group-btn, .rules-list li'
);
revealTargets.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

revealTargets.forEach(el => revealObserver.observe(el));

// ===== Animated counters =====
function animateValue(el, end, duration) {
    const startTime = performance.now();
    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(end * eased);
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

// ===== Active nav link highlighting =====
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
