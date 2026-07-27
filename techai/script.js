/* =========================================================
   TechAI News — منطق الموقع
   ========================================================= */

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || "";

const fmtDate = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/* ---------- بطاقة خبر ---------- */
function newsCardHTML(item) {
  return `
  <article class="news-card reveal" data-cat="${item.cat}">
    <a href="article.html?id=${item.id}" class="card-cover cover-${item.cover}">
      <span class="card-tag ${item.tag ? "hot" : ""}">${item.tag || catLabel(item.cat)}</span>
      <i class="fa-solid ${item.icon}"></i>
    </a>
    <div class="card-body">
      <h3><a href="article.html?id=${item.id}">${item.title}</a></h3>
      <p>${item.excerpt}</p>
      <div class="card-meta">
        <span class="who"><i class="fa-solid fa-circle-user"></i> ${item.author}</span>
        <span class="when">
          <span><i class="fa-regular fa-calendar"></i>${fmtDate(item.date)}</span>
          <span><i class="fa-regular fa-clock"></i>${item.readMins} د</span>
        </span>
      </div>
    </div>
  </article>`;
}

/* ---------- بطاقة مقال ---------- */
function articleCardHTML(item) {
  return `
  <article class="article-card reveal" data-cat="${item.cat}">
    <a href="article.html?id=${item.id}" class="article-icon cover-${item.cover}">
      <i class="fa-solid ${item.icon}"></i>
    </a>
    <div class="article-info">
      <span class="a-tag"><i class="fa-solid fa-bolt"></i> ${item.tag || catLabel(item.cat)}</span>
      <h3><a href="article.html?id=${item.id}">${item.title}</a></h3>
      <p>${item.excerpt}</p>
      <div class="card-meta">
        <span class="who"><i class="fa-solid fa-circle-user"></i> ${item.author}</span>
        <span class="when"><i class="fa-regular fa-clock"></i>${item.readMins} دقائق قراءة</span>
      </div>
    </div>
  </article>`;
}

/* ---------- بطاقة فيديو ---------- */
function videoCardHTML(v) {
  return `
  <article class="video-card reveal">
    <div class="video-frame" data-youtube="${v.youtube}" data-title="${v.title}">
      <img loading="lazy" src="https://img.youtube.com/vi/${v.youtube}/hqdefault.jpg" alt="${v.title}">
      <button class="play-btn" aria-label="تشغيل الفيديو"><i class="fa-solid fa-play"></i></button>
      <span class="duration"><i class="fa-regular fa-clock"></i> ${v.duration}</span>
    </div>
    <div class="video-body">
      <span class="v-tag">${v.tag}</span>
      <h3>${v.title}</h3>
      <p>${v.excerpt}</p>
    </div>
  </article>`;
}

/* =========================================================
   الصفحة الرئيسية
   ========================================================= */
function initHome() {
  const featured = NEWS.find((n) => n.featured) || NEWS[0];

  /* البطاقة المميزة */
  const featureBox = $("#hero-feature");
  if (featureBox) {
    featureBox.innerHTML = `
      <a href="article.html?id=${featured.id}">
        <div class="feature-cover cover-${featured.cover}">
          <span class="feature-badge"><i class="fa-solid fa-fire"></i> ${featured.tag || "الأبرز"}</span>
          <i class="fa-solid ${featured.icon}"></i>
        </div>
        <h3>${featured.title}</h3>
        <p>${featured.excerpt}</p>
        <div class="card-meta">
          <span class="who"><i class="fa-solid fa-circle-user"></i> ${featured.author}</span>
          <span class="when"><i class="fa-regular fa-calendar"></i>${fmtDate(featured.date)}</span>
        </div>
      </a>`;
  }

  /* شريط عاجل */
  const tickerBox = $("#ticker-move");
  if (tickerBox) {
    const items = [...TICKER, ...TICKER].map((t) => `<span>${t}</span>`).join("");
    tickerBox.innerHTML = items;
  }

  /* فلاتر التصنيفات */
  const filtersBox = $("#cat-filters");
  if (filtersBox) {
    filtersBox.innerHTML = CATEGORIES.map(
      (c, i) => `
      <button class="cat-chip ${i === 0 ? "active" : ""}" data-cat="${c.id}">
        <i class="fa-solid ${c.icon}"></i> ${c.label}
      </button>`
    ).join("");
  }

  renderNews("all", "");
  renderArticles();
  renderVideos();

  /* أحداث الفلاتر */
  filtersBox?.addEventListener("click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    $$(".cat-chip", filtersBox).forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    renderNews(chip.dataset.cat, $("#search-input")?.value.trim() || "");
  });

  /* بحث */
  $("#search-input")?.addEventListener("input", (e) => {
    const activeCat = $(".cat-chip.active")?.dataset.cat || "all";
    renderNews(activeCat, e.target.value.trim());
  });

  /* نشرة بريدية */
  $("#newsletter-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = $("#newsletter-note");
    note.textContent = "تم تسجيل بريدك بنجاح ✓ — أهلاً بك في مجتمع تك آي نيوز";
    note.classList.add("ok");
    e.target.reset();
  });
}

function renderNews(cat, query) {
  const grid = $("#news-grid");
  if (!grid) return;
  const q = (query || "").toLowerCase();
  const list = NEWS.filter((n) => {
    const okCat = cat === "all" || n.cat === cat;
    const okQ = !q || (n.title + n.excerpt).toLowerCase().includes(q);
    return okCat && okQ;
  });
  grid.innerHTML = list.length
    ? list.map(newsCardHTML).join("")
    : `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i>لا توجد نتائج مطابقة — جرّب كلمة أو تصنيفاً آخر</div>`;
  observeReveals(grid);
}

function renderArticles() {
  const grid = $("#articles-grid");
  if (!grid) return;
  grid.innerHTML = ARTICLES.map(articleCardHTML).join("");
  observeReveals(grid);
}

function renderVideos() {
  const grid = $("#videos-grid");
  if (!grid) return;
  grid.innerHTML = VIDEOS.map(videoCardHTML).join("");
  observeReveals(grid);

  grid.addEventListener("click", (e) => {
    const frame = e.target.closest(".video-frame");
    if (frame) openVideoModal(frame.dataset.youtube, frame.dataset.title);
  });
}

/* ---------- نافذة الفيديو ---------- */
function openVideoModal(youtubeId, title) {
  const modal = $("#video-modal");
  const wrap = $("#video-modal-frame");
  if (!modal || !wrap) return;
  wrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeVideoModal() {
  const modal = $("#video-modal");
  const wrap = $("#video-modal-frame");
  if (!modal) return;
  modal.classList.remove("open");
  if (wrap) wrap.innerHTML = "";
  document.body.style.overflow = "";
}

/* =========================================================
   صفحة المقال
   ========================================================= */
function initArticle() {
  const shell = $("#article-shell");
  if (!shell) return;

  const id = new URLSearchParams(location.search).get("id");
  const all = [...NEWS, ...ARTICLES];
  const item = all.find((n) => n.id === id) || all[0];

  document.title = `${item.title} | ${SITE.nameAr}`;

  shell.innerHTML = `
    <nav class="breadcrumb">
      <a href="index.html"><i class="fa-solid fa-house"></i> الرئيسية</a>
      <i class="fa-solid fa-angle-left"></i>
      <a href="index.html#news">${catLabel(item.cat)}</a>
      <i class="fa-solid fa-angle-left"></i>
      <span>${item.title.slice(0, 40)}…</span>
    </nav>

    <div class="article-hero-cover cover-${item.cover}">
      <i class="fa-solid ${item.icon}"></i>
    </div>

    <h1 class="article-title">${item.title}</h1>

    <div class="article-meta-row">
      <span class="pill">${item.tag || catLabel(item.cat)}</span>
      <span><i class="fa-solid fa-circle-user"></i>${item.author}</span>
      <span><i class="fa-regular fa-calendar"></i>${fmtDate(item.date)}</span>
      <span><i class="fa-regular fa-clock"></i>${item.readMins} دقائق قراءة</span>
    </div>

    <div class="article-content">
      ${item.body
        .map((p, i) => `<p class="${i === 0 ? "intro" : ""}">${p}</p>`)
        .join("")}
    </div>

    <div class="share-row">
      <b><i class="fa-solid fa-share-nodes"></i> شارك الموضوع:</b>
      <button class="btn btn-ghost" onclick="shareLink('x')"><i class="fa-brands fa-x-twitter"></i></button>
      <button class="btn btn-ghost" onclick="shareLink('fb')"><i class="fa-brands fa-facebook-f"></i></button>
      <button class="btn btn-ghost" onclick="shareLink('wa')"><i class="fa-brands fa-whatsapp"></i></button>
      <button class="btn btn-ghost" onclick="shareLink('copy')"><i class="fa-solid fa-link"></i> نسخ الرابط</button>
    </div>`;

  /* مواضيع ذات صلة */
  const relatedGrid = $("#related-grid");
  if (relatedGrid) {
    const related = all.filter((n) => n.id !== item.id && n.cat === item.cat).slice(0, 3);
    const fill = related.length ? related : all.filter((n) => n.id !== item.id).slice(0, 3);
    relatedGrid.innerHTML = fill.map(newsCardHTML).join("");
    observeReveals(relatedGrid);
  }

  /* شريط تقدم القراءة */
  const bar = $("#read-progress");
  if (bar) {
    addEventListener("scroll", () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      bar.style.width = pct + "%";
    });
  }
}

function shareLink(net) {
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title);
  const links = {
    x: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
    fb: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    wa: `https://wa.me/?text=${title}%20${url}`,
  };
  if (net === "copy") {
    navigator.clipboard?.writeText(location.href);
    return;
  }
  window.open(links[net], "_blank", "noopener,width=650,height=500");
}

/* =========================================================
   مشترك: حركات الظهور، القائمة، زر الأعلى، النافذة
   ========================================================= */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("visible");
        revealObserver.unobserve(en.target);
      }
    });
  },
  { threshold: 0.12 }
);

function observeReveals(scope = document) {
  $$(".reveal", scope).forEach((el) => revealObserver.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  /* سنة الفوتر + البريد */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-site-email]").forEach((el) => {
    el.textContent = SITE.email;
    if (el.tagName === "A") el.href = `mailto:${SITE.email}`;
  });

  /* قائمة الموبايل */
  $("#nav-toggle")?.addEventListener("click", () => $("#main-nav")?.classList.toggle("open"));

  /* نافذة الفيديو */
  $("#video-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "video-modal" || e.target.closest(".close-modal")) closeVideoModal();
  });
  addEventListener("keydown", (e) => e.key === "Escape" && closeVideoModal());

  /* زر العودة للأعلى */
  const toTop = $("#to-top");
  if (toTop) {
    addEventListener("scroll", () => toTop.classList.toggle("show", scrollY > 500));
    toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  }

  initHome();
  initArticle();
  observeReveals();
});
