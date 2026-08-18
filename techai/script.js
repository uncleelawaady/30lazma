/* =========================================================
   TechAI News — محرك الموقع
   (واجهة كاملة تعمل محلياً — جاهزة للربط بباك إند لاحقاً)
   ========================================================= */

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------- تخزين محلي ---------- */
const LS = {
  get(k, def) { try { const v = localStorage.getItem("tan_" + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) {
    try { localStorage.setItem("tan_" + k, JSON.stringify(v)); return true; }
    catch (e) {
      /* امتلاء مساحة التخزين — نبلّغ المستخدم بدل الفشل الصامت */
      if (e && (e.name === "QuotaExceededError" || e.code === 22))
        toast("مساحة التخزين في متصفحك ممتلئة — احذف بعض المحفوظات", "fa-triangle-exclamation");
      return false;
    }
  },
};

/* =========================================================
   طبقة الحماية — تهريب المخرجات وحدود الإدخال
   ملاحظة صريحة: هذا موقع static بلا خادم، فكل تحقق هنا
   يحمي المستخدم من المحتوى الخبيث، ولا يمنع مالك الجهاز
   من تعديل بياناته المحلية. الأمان الحقيقي يحتاج باك إند.
   ========================================================= */

/* تهريب النصوص قبل الحقن في HTML */
const esc = (s) => String(s ?? "").replace(/[&<>"'`]/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[m]));

/* تهريب قيم السمات (data-* و href و title) */
const escAttr = (s) => esc(s).replace(/\r?\n/g, " ");

/* قائمة بيضاء لأسماء الأصناف والأيقونات — تمنع الهروب من السمة */
const safeToken = (s, fallback = "") =>
  /^[A-Za-z0-9_-]{1,40}$/.test(String(s ?? "")) ? String(s) : fallback;

/* قراءة آمنة من كائن ثابت — تمنع prototype pollution عبر ?page=__proto__ */
const safePick = (obj, key, fallbackKey) =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : obj[fallbackKey];

/* حدود أطوال الإدخال — تمنع إغراق التخزين وتشويه الواجهة */
const LIMITS = {
  comment: 1000, reply: 500, name: 60, email: 120, password: 128,
  title: 200, excerpt: 300, body: 20000, tags: 200, search: 100,
};
const clamp = (s, max) => String(s ?? "").slice(0, max).trim();

/* تجزئة SHA-256 عبر Web Crypto — بلا مكتبات خارجية */
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const randomSalt = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ---------- أدوات ---------- */
const catOf = (id) => CATEGORIES.find((c) => c.id === id);
const catLabel = (id) => (catOf(id) || {}).label || "عام";
const authorOf = (id) => AUTHORS.find((a) => a.id === id) || AUTHORS[0];
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + " ألف" : String(n);
const param = (k) => new URLSearchParams(location.search).get(k);
const iconCls = (item) => `${safeToken(item.iconStyle, "fa-solid")} ${safeToken(item.icon, "fa-newspaper")}`;
const coverCls = (item) => `cover-${safeToken(item.cover, "g1")}`;

/* المحتوى الموحد: أخبار + مقالات + مراجعات (+ أخبار المدير المحلية) */
function adminNews() { return LS.get("adminNews", []).filter((n) => n.status === "منشور"); }
function allNews() { return [...adminNews(), ...NEWS]; }
function allContent() { return [...adminNews(), ...NEWS, ...ARTICLES, ...REVIEWS]; }
function viewsOf(item) { return (item.views || 0) + (LS.get("views", {})[item.id] || 0); }

/* ---------- توست ---------- */
function toast(msg, icon = "fa-circle-check") {
  let wrap = $(".toast-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${esc(msg)}`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* =========================================================
   نظام المستخدمين والنقاط
   ========================================================= */
/* مدة صلاحية جلسة القارئ */
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; /* أسبوع */

/* كلمات مرور شائعة تُرفض مباشرة */
const WEAK_PASSWORDS = ["12345678", "password", "123456789", "qwerty123", "11111111",
  "abc12345", "password1", "1234567890", "iloveyou", "admin123"];

function passwordIssue(pass) {
  if (pass.length < 8) return "كلمة المرور يجب ألا تقل عن 8 محارف";
  if (WEAK_PASSWORDS.includes(pass.toLowerCase())) return "كلمة المرور شائعة جداً — اختر واحدة أقوى";
  if (!/[A-Za-z؀-ۿ]/.test(pass) || !/[0-9]/.test(pass))
    return "امزج بين الحروف والأرقام لكلمة مرور أقوى";
  return null;
}

const Auth = {
  user() {
    const s = LS.get("session", null);
    if (!s) return null;
    if (s.exp && Date.now() > s.exp) { LS.set("session", null); return null; }
    return s;
  },
  users() { return LS.get("users", []); },

  async register(name, email, pass) {
    name = clamp(name, LIMITS.name);
    email = clamp(email, LIMITS.email).toLowerCase();
    pass = clamp(pass, LIMITS.password);
    if (name.length < 3) return { err: "الاسم قصير جداً" };
    const weak = passwordIssue(pass);
    if (weak) return { err: weak };

    const users = this.users();
    if (users.some((u) => u.email === email)) return { err: "هذا البريد مسجل من قبل — سجّل دخولك" };

    /* لا تُخزَّن كلمة المرور نصاً صريحاً — فقط بصمة مملّحة */
    const salt = randomSalt();
    const hash = await sha256(salt + pass);
    users.push({ name, email, salt, hash, joined: new Date().toISOString().slice(0, 10) });
    LS.set("users", users);
    this.start({ name, email });
    Points.add(POINTS_RULES.register, "مكافأة إنشاء الحساب");
    return { ok: true };
  },

  async login(email, pass) {
    email = clamp(email, LIMITS.email).toLowerCase();
    pass = clamp(pass, LIMITS.password);

    /* تأخير تصاعدي بعد المحاولات الفاشلة */
    const fails = LS.get("loginFails", 0);
    if (fails >= 5) {
      const wait = Math.min(30, 2 ** (fails - 4));
      await new Promise((r) => setTimeout(r, wait * 1000));
    }

    const users = this.users();
    const u = users.find((x) => x.email === email);
    let ok = false;

    if (u && u.salt && u.hash) {
      ok = (await sha256(u.salt + pass)) === u.hash;
    } else if (u && u.pass !== undefined) {
      /* ترحيل الحسابات القديمة المخزَّنة نصاً صريحاً */
      ok = u.pass === pass;
      if (ok) {
        u.salt = randomSalt();
        u.hash = await sha256(u.salt + pass);
        delete u.pass;
        LS.set("users", users);
      }
    }

    if (!ok) {
      LS.set("loginFails", fails + 1);
      return { err: "بيانات الدخول غير صحيحة" };
    }
    LS.set("loginFails", 0);
    this.start(u);
    return { ok: true };
  },

  social(provider) {
    const email = provider.toLowerCase() + "@demo.techai";
    const users = this.users();
    if (!users.some((x) => x.email === email)) {
      users.push({ name: "مستخدم " + provider, email, salt: "", hash: "", social: provider,
        joined: new Date().toISOString().slice(0, 10) });
      LS.set("users", users);
    }
    this.start({ name: "مستخدم " + provider, email });
    toast(`تم الدخول عبر ${provider} (وضع تجريبي — بلا OAuth حقيقي)`, "fa-right-to-bracket");
  },

  start(u) {
    LS.set("session", { name: u.name, email: u.email, exp: Date.now() + SESSION_TTL });
    const today = new Date().toISOString().slice(0, 10);
    if (LS.get("lastLogin", "") !== today) {
      LS.set("lastLogin", today);
      Points.add(POINTS_RULES.dailyLogin, "مكافأة الدخول اليومي");
    }
  },
  logout() { LS.set("session", null); location.reload(); },
};

/* النقاط موقّعة ببصمة — رادع للتلاعب العابر من الـ Console، لا حماية مطلقة */
const Points = {
  _sig(n) { let h = 2166136261; const s = "tan:" + n; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  total() {
    const raw = LS.get("points", 0);
    const sig = LS.get("pointsSig", null);
    if (sig !== null && sig !== this._sig(raw)) {
      /* القيمة عُدّلت خارج الموقع — نرجع لآخر قيمة موثوقة */
      const safe = LS.get("pointsSafe", 0);
      LS.set("points", safe); LS.set("pointsSig", this._sig(safe));
      return safe;
    }
    return raw;
  },
  _write(n) {
    LS.set("points", n); LS.set("pointsSig", this._sig(n)); LS.set("pointsSafe", n);
  },
  add(n, why) {
    this._write(this.total() + n);
    Notify.push(`+${n} نقطة — ${why}`, "fa-star");
    toast(`+${n} نقطة — ${why}`, "fa-star");
  },
  badge() {
    const p = this.total();
    return [...BADGES].reverse().find((b) => p >= b.min) || BADGES[0];
  },
};

const Notify = {
  list() { return LS.get("notifs", []); },
  push(text, icon = "fa-bell") {
    const l = this.list();
    l.unshift({ text: clamp(text, 200), icon: safeToken(icon, "fa-bell"), at: Date.now(), read: false });
    LS.set("notifs", l.slice(0, 30));
    const b = $("#notif-bubble");
    if (b) { const n = this.unread(); b.textContent = n; b.style.display = n ? "grid" : "none"; }
  },
  unread() { return this.list().filter((n) => !n.read).length; },
  readAll() { LS.set("notifs", this.list().map((n) => ({ ...n, read: true }))); },
};

/* =========================================================
   لوحة التحكم: قفل + أدوار + سجل عمليات
   تحذير معماري: هذا قفل واجهة على موقع static. من يملك
   الجهاز يستطيع تجاوزه من أدوات المطوّر. الغرض منه منع
   العبث العابر وتوثيق العمليات، لا الحماية من مهاجم جاد.
   ========================================================= */
const ROLES = {
  admin:  { label: "مدير",  icon: "fa-user-shield",  can: ["dash", "news", "cats", "comments", "quizzes", "newsletter", "ads", "seo", "users", "logs"] },
  editor: { label: "محرر",  icon: "fa-user-pen",     can: ["dash", "news", "cats", "quizzes", "logs"] },
  mod:    { label: "مراجع", icon: "fa-user-check",   can: ["dash", "comments", "logs"] },
};

const ADMIN_TTL = 30 * 60 * 1000; /* 30 دقيقة خمول */

const Admin = {
  isSetUp() { return !!LS.get("adminHash", null); },
  session() {
    const s = LS.get("adminSession", null);
    if (!s) return null;
    if (Date.now() > s.exp) { LS.set("adminSession", null); return null; }
    return s;
  },
  touch() {
    const s = this.session();
    if (s) LS.set("adminSession", { ...s, exp: Date.now() + ADMIN_TTL });
  },
  role() { return (this.session() || {}).role || null; },
  can(view) {
    const r = this.role();
    return !!r && (ROLES[r]?.can || []).includes(view);
  },

  async setup(pass, role = "admin") {
    const weak = passwordIssue(clamp(pass, LIMITS.password));
    if (weak) return { err: weak };
    const salt = randomSalt();
    LS.set("adminSalt", salt);
    LS.set("adminHash", await sha256(salt + clamp(pass, LIMITS.password)));
    LS.set("adminRole", role);
    this.open(role);
    this.log("ضبط كلمة مرور لوحة التحكم لأول مرة", "fa-key");
    return { ok: true };
  },

  async unlock(pass) {
    const fails = LS.get("adminFails", 0);
    if (fails >= 5) await new Promise((r) => setTimeout(r, Math.min(30, 2 ** (fails - 4)) * 1000));

    const ok = (await sha256(LS.get("adminSalt", "") + clamp(pass, LIMITS.password))) === LS.get("adminHash", null);
    if (!ok) {
      LS.set("adminFails", fails + 1);
      this.log("محاولة دخول فاشلة للوحة التحكم", "fa-triangle-exclamation");
      return { err: `كلمة المرور غير صحيحة (محاولة ${fails + 1})` };
    }
    LS.set("adminFails", 0);
    this.open(LS.get("adminRole", "admin"));
    this.log("دخول ناجح للوحة التحكم", "fa-right-to-bracket");
    return { ok: true };
  },

  open(role) { LS.set("adminSession", { role, at: Date.now(), exp: Date.now() + ADMIN_TTL }); },
  lock() { LS.set("adminSession", null); location.reload(); },

  /* سجل العمليات — يوثّق كل تغيير في المحتوى */
  log(action, icon = "fa-clock-rotate-left") {
    const l = LS.get("auditLog", []);
    l.unshift({ action: clamp(action, 160), icon: safeToken(icon, "fa-clock-rotate-left"),
      role: this.role() || "—", at: Date.now() });
    LS.set("auditLog", l.slice(0, 200));
  },
  logs() { return LS.get("auditLog", []); },
};

/* =========================================================
   الهيكل المشترك: هيدر + فوتر + نوافذ
   ========================================================= */
function buildShell() {
  const here = document.body.dataset.page;
  const user = Auth.user();
  const navCats = CATEGORIES.map((c) => `
    <div class="nav-item">
      <a href="category.html?cat=${c.id}"><i class="fa-solid ${c.icon}"></i> ${c.label} <i class="fa-solid fa-angle-down"></i></a>
      <div class="dropdown">
        <a href="category.html?cat=${c.id}"><i class="fa-solid fa-layer-group"></i> كل أخبار ${c.label}</a>
        <div class="dd-subs">${c.subs.map((s) => `<a href="category.html?cat=${encodeURIComponent(c.id)}&sub=${encodeURIComponent(s)}">${esc(s)}</a>`).join("")}</div>
      </div>
    </div>`).join("");

  $("#app-header").innerHTML = `
  <header class="site-header">
    <div class="container header-inner">
      <a href="index.html" class="brand">
        <span class="brand-mark"><i class="fa-solid fa-bolt"></i></span>
        <span><span class="brand-name">تك <span>آي</span> نيوز</span><br><span class="brand-sub">TECHAI.NEWS</span></span>
      </a>
      <nav class="main-nav" id="main-nav">
        <a href="index.html" class="${here === "home" ? "active" : ""}"><i class="fa-solid fa-house"></i> الرئيسية</a>
        <div class="nav-item">
          <a href="special.html?view=latest">الأقسام <i class="fa-solid fa-angle-down"></i></a>
          <div class="dropdown">${CATEGORIES.map((c) => `<a href="category.html?cat=${c.id}"><i class="fa-solid ${c.icon}"></i> ${c.label}</a>`).join("")}</div>
        </div>
        <a href="index.html#videos">فيديو</a>
        <a href="special.html?view=reviews" class="${here === "special" ? "" : ""}">مراجعات</a>
        <a href="quiz.html" class="${here === "quiz" ? "active" : ""}">المسابقات</a>
        <a href="special.html?view=trending">الرائج</a>
      </nav>
      <div class="header-actions">
        <label class="search-box"><i class="fa-solid fa-magnifying-glass"></i>
          <input type="search" id="global-search" placeholder="ابحث… (Enter)"></label>
        <button class="icon-btn" id="theme-toggle" aria-label="الوضع الليلي/الفاتح" title="تبديل المظهر"><i class="fa-solid fa-sun"></i></button>
        <div style="position:relative">
          <button class="icon-btn" id="notif-btn" aria-label="الإشعارات"><i class="fa-solid fa-bell"></i>
            <span class="bubble" id="notif-bubble" style="display:${Notify.unread() ? "grid" : "none"}">${Notify.unread()}</span></button>
          <div class="notif-panel" id="notif-panel"></div>
        </div>
        <a class="icon-btn" href="account.html" title="${user ? esc(user.name) : "حسابي"}" aria-label="حسابي">
          <i class="fa-solid ${user ? "fa-user-check" : "fa-user"}"></i></a>
        <button class="nav-toggle" id="nav-toggle" aria-label="القائمة"><i class="fa-solid fa-bars"></i></button>
      </div>
    </div>
  </header>
  <div class="subnav"><div class="container subnav-inner">${
    CATEGORIES.map((c) => `<a href="category.html?cat=${c.id}"><i class="fa-solid ${c.icon}"></i> ${c.label}</a>`).join("")
  }</div></div>
  ${here === "home" ? `
  <div class="ticker">
    <span class="ticker-label"><i class="fa-solid fa-tower-broadcast"></i> عاجل</span>
    <div class="ticker-track"><div class="ticker-move">${[...TICKER, ...TICKER].map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>
  </div>` : ""}`;

  $("#app-footer").innerHTML = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="index.html" class="brand" style="margin-bottom:14px">
            <span class="brand-mark"><i class="fa-solid fa-bolt"></i></span>
            <span><span class="brand-name">تك <span>آي</span> نيوز</span><br><span class="brand-sub">TECHAI.NEWS</span></span>
          </a>
          <p>بوابتك العربية لأخبار التقنية والذكاء الاصطناعي — نغربل الضجيج ونوصل لك ما يستحق القراءة فعلاً.</p>
          <div class="socials">
            <a href="#" aria-label="X"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="#" aria-label="فيسبوك"><i class="fa-brands fa-facebook-f"></i></a>
            <a href="#" aria-label="إنستغرام"><i class="fa-brands fa-instagram"></i></a>
            <a href="#" aria-label="يوتيوب"><i class="fa-brands fa-youtube"></i></a>
            <a href="#" aria-label="تيليجرام"><i class="fa-brands fa-telegram"></i></a>
            <a href="rss.xml" aria-label="RSS"><i class="fa-solid fa-rss"></i></a>
          </div>
          <div class="app-badges">
            <a class="app-badge" href="#"><i class="fa-brands fa-google-play"></i><span>قريباً على<b>Google Play</b></span></a>
            <a class="app-badge" href="#"><i class="fa-brands fa-apple"></i><span>قريباً على<b>App Store</b></span></a>
          </div>
        </div>
        <div>
          <h4><i class="fa-solid fa-layer-group"></i> الأقسام</h4>
          <ul>${CATEGORIES.slice(0, 6).map((c) => `<li><a href="category.html?cat=${c.id}"><i class="fa-solid fa-angle-left"></i> ${c.label}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4><i class="fa-solid fa-link"></i> صفحات خاصة</h4>
          <ul>
            <li><a href="special.html?view=breaking"><i class="fa-solid fa-angle-left"></i> الأخبار العاجلة</a></li>
            <li><a href="special.html?view=trending"><i class="fa-solid fa-angle-left"></i> الأخبار الرائجة</a></li>
            <li><a href="special.html?view=most-read"><i class="fa-solid fa-angle-left"></i> الأكثر قراءة</a></li>
            <li><a href="special.html?view=opinions"><i class="fa-solid fa-angle-left"></i> مقالات الرأي</a></li>
            <li><a href="special.html?view=reviews"><i class="fa-solid fa-angle-left"></i> المراجعات والمقارنات</a></li>
            <li><a href="quiz.html"><i class="fa-solid fa-angle-left"></i> المسابقات والجوائز</a></li>
          </ul>
        </div>
        <div>
          <h4><i class="fa-solid fa-circle-info"></i> عن الموقع</h4>
          <ul>
            <li><a href="static.html?page=about"><i class="fa-solid fa-angle-left"></i> من نحن</a></li>
            <li><a href="static.html?page=team"><i class="fa-solid fa-angle-left"></i> فريق العمل</a></li>
            <li><a href="static.html?page=contact"><i class="fa-solid fa-angle-left"></i> اتصل بنا</a></li>
            <li><a href="static.html?page=advertise"><i class="fa-solid fa-angle-left"></i> أعلن معنا</a></li>
            <li><a href="static.html?page=privacy"><i class="fa-solid fa-angle-left"></i> سياسة الخصوصية</a></li>
            <li><a href="static.html?page=terms"><i class="fa-solid fa-angle-left"></i> الشروط والأحكام</a></li>
            <li><a href="static.html?page=cookies"><i class="fa-solid fa-angle-left"></i> سياسة الكوكيز</a></li>
            <li><a href="admin.html"><i class="fa-solid fa-angle-left"></i> لوحة التحكم</a></li>
          </ul>
          <ul class="footer-contact" style="margin-top:14px">
            <li><i class="fa-solid fa-envelope"></i> <a data-site-email href="#"></a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-year></span> تك آي نيوز — TechAI News. جميع الحقوق محفوظة.</span>
        <span>صُنع بشغف <i class="fa-solid fa-bolt love"></i> للقارئ العربي</span>
      </div>
    </div>
  </footer>
  <div class="video-modal" id="video-modal">
    <div class="video-modal-box">
      <button class="close-modal" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>
      <div class="frame-wrap" id="video-modal-frame"></div>
    </div>
  </div>
  <button class="to-top" id="to-top" aria-label="العودة للأعلى"><i class="fa-solid fa-arrow-up"></i></button>`;

  /* أحداث الهيكل */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-site-email]").forEach((el) => { el.textContent = SITE.email; if (el.tagName === "A") el.href = `mailto:${SITE.email}`; });
  $("#nav-toggle")?.addEventListener("click", () => $("#main-nav")?.classList.toggle("open"));

  /* الوضع الليلي/الفاتح */
  const applyTheme = () => {
    const light = LS.get("theme", "dark") === "light";
    document.documentElement.classList.toggle("light", light);
    const ic = $("#theme-toggle i");
    if (ic) ic.className = light ? "fa-solid fa-moon" : "fa-solid fa-sun";
  };
  applyTheme();
  $("#theme-toggle")?.addEventListener("click", () => {
    LS.set("theme", LS.get("theme", "dark") === "light" ? "dark" : "light");
    applyTheme();
  });

  /* بحث عام */
  $("#global-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim())
      location.href = "search.html?q=" + encodeURIComponent(e.target.value.trim());
  });

  /* الإشعارات */
  $("#notif-btn")?.addEventListener("click", () => {
    const panel = $("#notif-panel");
    const list = Notify.list();
    panel.innerHTML = `<h5><i class="fa-solid fa-bell"></i> الإشعارات</h5>` +
      (list.length
        ? list.slice(0, 8).map((n) => `<div class="notif-item"><i class="fa-solid ${n.icon}"></i><span>${esc(n.text)}</span></div>`).join("")
        : `<div class="notif-item"><i class="fa-solid fa-bell-slash"></i><span>لا إشعارات بعد — تصفح الأخبار واجمع النقاط!</span></div>`);
    panel.classList.toggle("open");
    Notify.readAll();
    const b = $("#notif-bubble"); if (b) b.style.display = "none";
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notif-btn") && !e.target.closest("#notif-panel")) $("#notif-panel")?.classList.remove("open");
  });

  /* نافذة الفيديو + زر الأعلى */
  $("#video-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "video-modal" || e.target.closest(".close-modal")) closeVideoModal();
  });
  addEventListener("keydown", (e) => e.key === "Escape" && closeVideoModal());
  const toTop = $("#to-top");
  addEventListener("scroll", () => toTop?.classList.toggle("show", scrollY > 500));
  toTop?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  /* تسجيل Service Worker (PWA) */
  if ("serviceWorker" in navigator && location.protocol === "https:")
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* =========================================================
   بطاقات العرض
   ========================================================= */
function newsCardHTML(item) {
  const a = authorOf(item.author);
  const score = item.score ? `<span class="review-score">${esc(item.score)}</span>` : "";
  return `
  <article class="news-card reveal">
    <a href="article.html?id=${encodeURIComponent(item.id)}" class="card-cover ${coverCls(item)}">
      <span class="card-tag ${item.tag ? "hot" : ""}">${esc(item.tag || catLabel(item.cat))}</span>${score}
      <i class="${iconCls(item)}"></i>
    </a>
    <div class="card-body">
      <h3><a href="article.html?id=${encodeURIComponent(item.id)}">${esc(item.title)}</a></h3>
      <p>${esc(item.excerpt)}</p>
      <div class="card-meta">
        <a class="who" href="author.html?id=${encodeURIComponent(a.id)}"><i class="fa-solid fa-circle-user"></i> ${esc(a.name)}</a>
        <span class="when">
          <span><i class="fa-regular fa-eye"></i>${fmtNum(viewsOf(item))}</span>
          <span><i class="fa-regular fa-clock"></i>${item.readMins} د</span>
        </span>
      </div>
    </div>
  </article>`;
}

function articleCardHTML(item) {
  const a = authorOf(item.author);
  return `
  <article class="article-card reveal">
    <a href="article.html?id=${encodeURIComponent(item.id)}" class="article-icon ${coverCls(item)}"><i class="${iconCls(item)}"></i></a>
    <div class="article-info">
      <span class="a-tag"><i class="fa-solid fa-bolt"></i> ${esc(item.tag || catLabel(item.cat))}</span>
      <h3><a href="article.html?id=${encodeURIComponent(item.id)}">${esc(item.title)}</a></h3>
      <p>${esc(item.excerpt)}</p>
      <div class="card-meta">
        <a class="who" href="author.html?id=${encodeURIComponent(a.id)}"><i class="fa-solid fa-circle-user"></i> ${esc(a.name)}</a>
        <span class="when"><i class="fa-regular fa-clock"></i>${item.readMins} دقائق</span>
      </div>
    </div>
  </article>`;
}

function videoCardHTML(v) {
  return `
  <article class="video-card reveal">
    <div class="video-frame" data-youtube="${escAttr(safeToken(v.youtube))}" data-title="${esc(v.title)}">
      <img loading="lazy" src="https://img.youtube.com/vi/${v.youtube}/hqdefault.jpg" alt="${esc(v.title)}">
      <button class="play-btn" aria-label="تشغيل"><i class="fa-solid fa-play"></i></button>
      <span class="duration"><i class="fa-regular fa-clock"></i> ${v.duration}</span>
    </div>
    <div class="video-body">
      <span class="v-tag">${esc(v.tag)}</span>
      <h3>${esc(v.title)}</h3>
      <p>${esc(v.excerpt)}</p>
    </div>
  </article>`;
}

function trendItemHTML(item, i) {
  return `
  <div class="trend-item reveal">
    <span class="trend-rank">${i + 1}</span>
    <h4><a href="article.html?id=${encodeURIComponent(item.id)}">${esc(item.title)}</a></h4>
    <span class="views"><i class="fa-regular fa-eye"></i>${fmtNum(viewsOf(item))}</span>
  </div>`;
}

function bindVideoGrid(grid) {
  grid?.addEventListener("click", (e) => {
    const frame = e.target.closest(".video-frame");
    if (frame) openVideoModal(frame.dataset.youtube, frame.dataset.title);
  });
}
function openVideoModal(id, title) {
  const wrap = $("#video-modal-frame");
  /* معرّف يوتيوب يمر بقائمة بيضاء — لا يُحقن أي شيء آخر في src */
  const vid = safeToken(id);
  if (!vid) return toast("معرّف الفيديو غير صالح", "fa-triangle-exclamation");
  wrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0" title="${escAttr(title)}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  $("#video-modal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeVideoModal() {
  $("#video-modal")?.classList.remove("open");
  const wrap = $("#video-modal-frame"); if (wrap) wrap.innerHTML = "";
  document.body.style.overflow = "";
}

/* =========================================================
   الصفحة الرئيسية
   ========================================================= */
function initHome() {
  const news = allNews();
  const featured = news.find((n) => n.featured) || news[0];

  $("#hero-feature").innerHTML = `
    <a href="article.html?id=${featured.id}">
      <div class="feature-cover ${coverCls(featured)}">
        <span class="feature-badge"><i class="fa-solid fa-fire"></i> ${esc(featured.tag || "الأبرز")}</span>
        <i class="${iconCls(featured)}"></i>
      </div>
      <h3>${esc(featured.title)}</h3>
      <p>${esc(featured.excerpt)}</p>
      <div class="card-meta">
        <span class="who"><i class="fa-solid fa-circle-user"></i> ${esc(authorOf(featured.author).name)}</span>
        <span class="when"><i class="fa-regular fa-calendar"></i>${fmtDate(featured.date)}</span>
      </div>
    </a>`;

  /* آخر الأخبار */
  $("#latest-grid").innerHTML = [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(newsCardHTML).join("");

  /* الأكثر قراءة */
  $("#trending-list").innerHTML = [...allContent()].sort((a, b) => viewsOf(b) - viewsOf(a)).slice(0, 5).map(trendItemHTML).join("");

  /* سؤال اليوم */
  const dqDone = LS.get("dailyQ", "") === new Date().toISOString().slice(0, 10);
  $("#daily-q-box").innerHTML = `
    <div class="daily-q">
      <span class="dq-ico"><i class="fa-solid fa-circle-question"></i></span>
      <div>
        <span class="hero-kicker" style="margin-bottom:8px"><i class="fa-solid fa-fire"></i> سؤال اليوم — ${DAILY_QUESTION.points} نقطة</span>
        <h3>${esc(DAILY_QUESTION.q)}</h3>
        <div class="dq-opts">${dqDone
          ? `<span class="tag-chip active"><i class="fa-solid fa-check"></i> أجبت على سؤال اليوم — عُد غداً!</span>`
          : DAILY_QUESTION.options.map((o, i) => `<button class="act-btn dq-opt" data-i="${i}">${esc(o)}</button>`).join("")}
        </div>
      </div>
    </div>`;
  $$(".dq-opt").forEach((b) => b.addEventListener("click", () => {
    LS.set("dailyQ", new Date().toISOString().slice(0, 10));
    if (+b.dataset.i === DAILY_QUESTION.answer) Points.add(DAILY_QUESTION.points, "إجابة صحيحة على سؤال اليوم");
    else toast("إجابة غير صحيحة — حظاً أوفر غداً!", "fa-face-smile");
    initHome();
  }));

  /* أخبار حسب التصنيف */
  $("#cat-blocks").innerHTML = CATEGORIES.map((c) => {
    const items = news.filter((n) => n.cat === c.id).slice(0, 3);
    if (!items.length) return "";
    return `
    <div class="cat-block reveal">
      <div class="cat-block-head">
        <span class="cat-ico"><i class="fa-solid ${safeToken(c.icon, "fa-newspaper")}"></i></span>
        <h3>${c.label}</h3>
        <a class="more" href="category.html?cat=${c.id}">عرض الكل <i class="fa-solid fa-angle-left"></i></a>
      </div>
      <div class="cards-grid">${items.map(newsCardHTML).join("")}</div>
    </div>`;
  }).join("");

  /* فيديو */
  const vg = $("#videos-grid");
  vg.innerHTML = VIDEOS.map(videoCardHTML).join("");
  bindVideoGrid(vg);

  /* مراجعات */
  $("#reviews-grid").innerHTML = REVIEWS.map(newsCardHTML).join("");

  /* مقالات الرأي */
  $("#opinions-grid").innerHTML = ARTICLES.map(articleCardHTML).join("");

  /* الوسوم */
  const tagCount = {};
  allContent().forEach((n) => (n.tags || []).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
  $("#tags-cloud").innerHTML = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([t, c]) => `<a class="tag-chip" href="search.html?tag=${encodeURIComponent(t)}"><i class="fa-solid fa-hashtag"></i>${esc(t)} <span style="opacity:.6">(${c})</span></a>`).join("");

  /* نشرة بريدية */
  $("#newsletter-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = e.target.querySelector("input").value;
    const subs = LS.get("newsletter", []);
    if (!subs.includes(email)) { subs.push(email); LS.set("newsletter", subs); }
    const note = $("#newsletter-note");
    note.textContent = "تم تسجيل بريدك بنجاح ✓ — أهلاً بك في مجتمع تك آي نيوز";
    note.classList.add("ok");
    e.target.reset();
  });
}

/* =========================================================
   صفحة الخبر / المقال / المراجعة
   ========================================================= */
function initArticle() {
  const all = allContent();
  const item = all.find((n) => n.id === param("id")) || all[0];
  const a = authorOf(item.author);
  const user = Auth.user();

  /* عدّاد مشاهدات + نقاط قراءة */
  const v = LS.get("views", {});
  v[item.id] = (v[item.id] || 0) + 1; LS.set("views", v);
  const readSet = LS.get("readIds", []);
  if (!readSet.includes(item.id)) { readSet.push(item.id); LS.set("readIds", readSet); Points.add(POINTS_RULES.readArticle, "قراءة موضوع جديد"); }

  document.title = `${item.title} | ${SITE.nameAr}`;
  $('meta[name="description"]')?.setAttribute("content", item.excerpt);

  /* Schema.org */
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: item.title, description: item.excerpt, datePublished: item.date,
    author: { "@type": "Person", name: a.name },
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: `${SITE.domain}/article.html?id=${item.id}`,
  });
  document.head.appendChild(ld);

  const saved = LS.get("saved", []).includes(item.id);
  const followed = LS.get("follows", []).includes(a.id);

  /* المراجعات: صندوق التقييم */
  const reviewBlock = item.kind === "review" && item.score ? `
    <div class="score-banner">
      <div><span class="big">${esc(item.score)}</span><span class="of"> / 10</span></div>
      <p><b>خلاصة المراجعة:</b> ${esc(item.verdict)}</p>
    </div>` : "";
  const prosCons = item.pros ? `
    <div class="verdict-box">
      <div class="v-col pros"><h4><i class="fa-solid fa-thumbs-up"></i> المميزات</h4>
        <ul>${item.pros.map((p) => `<li><i class="fa-solid fa-plus"></i>${esc(p)}</li>`).join("")}</ul></div>
      <div class="v-col cons"><h4><i class="fa-solid fa-thumbs-down"></i> العيوب</h4>
        <ul>${item.cons.map((c) => `<li><i class="fa-solid fa-minus"></i>${esc(c)}</li>`).join("")}</ul></div>
    </div>` : "";

  $("#article-shell").innerHTML = `
    <nav class="breadcrumb">
      <a href="index.html"><i class="fa-solid fa-house"></i> الرئيسية</a>
      <i class="fa-solid fa-angle-left"></i>
      <a href="category.html?cat=${encodeURIComponent(item.cat)}">${catLabel(item.cat)}</a>
      <i class="fa-solid fa-angle-left"></i><span>${esc(item.title.slice(0, 40))}…</span>
    </nav>
    <div class="article-hero-cover ${coverCls(item)}"><i class="${iconCls(item)}"></i></div>
    <h1 class="article-title">${esc(item.title)}</h1>
    <div class="article-meta-row">
      <span class="pill">${esc(item.tag || catLabel(item.cat))}</span>
      <a href="author.html?id=${encodeURIComponent(a.id)}"><i class="fa-solid fa-circle-user"></i>${esc(a.name)}</a>
      <span><i class="fa-regular fa-calendar"></i>${fmtDate(item.date)}</span>
      <span><i class="fa-regular fa-clock"></i>${item.readMins} دقائق قراءة</span>
      <span><i class="fa-regular fa-eye"></i>${fmtNum(viewsOf(item))} مشاهدة</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px">
      <button class="act-btn ${saved ? "on" : ""}" id="save-btn"><i class="fa-${saved ? "solid" : "regular"} fa-bookmark"></i> ${saved ? "محفوظ" : "حفظ الخبر"}</button>
      <button class="act-btn ${followed ? "on" : ""}" id="follow-btn"><i class="fa-solid fa-user-plus"></i> ${followed ? "تتابع الكاتب" : "متابعة الكاتب"}</button>
    </div>
    ${reviewBlock}
    <div class="article-content">
      ${item.body.map((p, i) => `<p class="${i === 0 ? "intro" : ""}">${esc(p)}</p>`).join("")}
    </div>
    ${prosCons}
    ${item.tags?.length ? `<div class="tags-row" style="margin-top:26px">${item.tags.map((t) => `<a class="tag-chip" href="search.html?tag=${encodeURIComponent(t)}"><i class="fa-solid fa-hashtag"></i>${esc(t)}</a>`).join("")}</div>` : ""}
    ${item.sources?.length ? `<div class="sources-box"><h4><i class="fa-solid fa-link"></i> المصادر</h4><ul>${item.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : ""}
    <div class="share-row">
      <b><i class="fa-solid fa-share-nodes"></i> شارك:</b>
      <button class="btn btn-ghost" data-share="x"><i class="fa-brands fa-x-twitter"></i></button>
      <button class="btn btn-ghost" data-share="fb"><i class="fa-brands fa-facebook-f"></i></button>
      <button class="btn btn-ghost" data-share="wa"><i class="fa-brands fa-whatsapp"></i></button>
      <button class="btn btn-ghost" data-share="tg"><i class="fa-brands fa-telegram"></i></button>
      <button class="btn btn-ghost" data-share="copy"><i class="fa-solid fa-link"></i> نسخ</button>
      <div class="rating-box" style="margin-inline-start:auto">
        <b style="font-size:.85rem">قيّم الموضوع:</b>
        <span class="rating-stars" id="rating-stars">${[1,2,3,4,5].map((n) => `<i class="fa-solid fa-star" data-n="${n}"></i>`).join("")}</span>
        <span class="rating-count" id="rating-count"></span>
      </div>
    </div>`;

  /* حفظ / متابعة */
  $("#save-btn").addEventListener("click", () => {
    const s = LS.get("saved", []);
    const i = s.indexOf(item.id);
    if (i > -1) s.splice(i, 1); else { s.push(item.id); Points.add(POINTS_RULES.saveArticle, "حفظ موضوع"); }
    LS.set("saved", s); initArticle();
  });
  $("#follow-btn").addEventListener("click", () => {
    const f = LS.get("follows", []);
    const i = f.indexOf(a.id);
    if (i > -1) { f.splice(i, 1); toast("ألغيت متابعة الكاتب", "fa-user-minus"); }
    else { f.push(a.id); toast(`أصبحت تتابع ${a.name}`, "fa-user-check"); Notify.push(`بدأت متابعة ${a.name}`, "fa-user-check"); }
    LS.set("follows", f); initArticle();
  });

  /* مشاركة */
  $$("[data-share]").forEach((b) => b.addEventListener("click", () => {
    const url = encodeURIComponent(location.href);
    const title = encodeURIComponent(item.title);
    const links = {
      x: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      wa: `https://wa.me/?text=${title}%20${url}`,
      tg: `https://t.me/share/url?url=${url}&text=${title}`,
    };
    if (b.dataset.share === "copy") { navigator.clipboard?.writeText(location.href); toast("تم نسخ الرابط"); }
    else window.open(links[b.dataset.share], "_blank", "noopener,width=650,height=500");
    Points.add(POINTS_RULES.share, "مشاركة موضوع");
  }));

  /* تقييم */
  const ratings = LS.get("ratings", {});
  const renderStars = () => {
    const r = ratings[item.id] || 0;
    $$("#rating-stars i").forEach((s) => s.classList.toggle("on", +s.dataset.n <= r));
    $("#rating-count").textContent = r ? `تقييمك: ${r}/5` : "";
  };
  renderStars();
  $$("#rating-stars i").forEach((s) => s.addEventListener("click", () => {
    ratings[item.id] = +s.dataset.n; LS.set("ratings", ratings); renderStars();
    toast(`شكراً لتقييمك (${s.dataset.n}/5)`, "fa-star");
  }));

  /* تعليقات */
  renderComments(item.id);

  /* ذات صلة */
  const related = all.filter((n) => n.id !== item.id && (n.cat === item.cat || (n.tags || []).some((t) => (item.tags || []).includes(t)))).slice(0, 3);
  $("#related-grid").innerHTML = (related.length ? related : all.filter((n) => n.id !== item.id).slice(0, 3)).map(newsCardHTML).join("");

  /* شريط تقدم القراءة */
  addEventListener("scroll", () => {
    const h = document.documentElement;
    $("#read-progress").style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + "%";
  });
  observeReveals();
}

/* ---------- نظام التعليقات ---------- */
const COMMENT_COOLDOWN = 10000; /* 10 ثوانٍ بين تعليق وآخر */
function commentsOf(id) { return LS.get("comments_" + id, []); }
function renderComments(articleId) {
  const box = $("#comments-box");
  if (!box) return;
  const user = Auth.user();
  const list = commentsOf(articleId);
  const cHTML = (c, i, isReply = false, parentI = -1) => `
    <div class="comment ${c.pinned ? "pinned" : ""}">
      <span class="avatar"><i class="fa-solid fa-user"></i></span>
      <div style="flex:1">
        <div class="c-head"><b>${esc(c.name)}</b><span class="when">${new Date(c.at).toLocaleDateString("ar-EG")}</span>
          ${c.pinned ? `<span class="pin"><i class="fa-solid fa-thumbtack"></i> مثبت</span>` : ""}</div>
        <p>${esc(c.text)}</p>
        <div class="c-actions">
          <button class="c-like ${c.likedByMe ? "liked" : ""}" data-i="${i}" data-p="${parentI}"><i class="fa-solid fa-thumbs-up"></i> ${c.likes || 0}</button>
          ${!isReply ? `<button class="c-reply" data-i="${i}"><i class="fa-solid fa-reply"></i> رد</button>` : ""}
          <button class="c-report" data-i="${i}"><i class="fa-solid fa-flag"></i> بلاغ</button>
        </div>
        ${(c.replies || []).length ? `<div class="replies">${c.replies.map((r, ri) => cHTML(r, ri, true, i)).join("")}</div>` : ""}
      </div>
    </div>`;

  box.innerHTML = `
    <h2><i class="fa-solid fa-comments"></i> التعليقات (${list.length})</h2>
    <form class="comment-form" id="comment-form">
      <textarea maxlength="${LIMITS.comment}" placeholder="${user ? "شاركنا رأيك بأدب واحترام…" : "سجّل دخولك لكتابة تعليق — أو اكتب باسم زائر"}" required></textarea>
      <div class="form-foot">
        <span class="hint"><i class="fa-solid fa-shield-halved"></i> التعليقات المسيئة تُحذف ويُحظر صاحبها · <span id="c-count">0</span>/${LIMITS.comment}</span>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> نشر التعليق</button>
      </div>
    </form>
    ${list.map((c, i) => cHTML(c, i)).join("") || `<p style="color:var(--faint);text-align:center;padding:20px 0">كن أول من يعلّق على هذا الموضوع!</p>`}`;

  const ta = $("#comment-form textarea", box);
  ta.addEventListener("input", () => ($("#c-count", box).textContent = ta.value.length));

  $("#comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = clamp(e.target.querySelector("textarea").value, LIMITS.comment);
    if (!text) return;
    /* تبريد بين التعليقات — يمنع الإغراق الآلي */
    const last = LS.get("lastComment", 0);
    if (Date.now() - last < COMMENT_COOLDOWN) {
      const left = Math.ceil((COMMENT_COOLDOWN - (Date.now() - last)) / 1000);
      return toast(`انتظر ${left} ثانية قبل التعليق مرة أخرى`, "fa-hourglass-half");
    }
    LS.set("lastComment", Date.now());
    list.unshift({ name: clamp(user ? user.name : "زائر", LIMITS.name), text, at: Date.now(), likes: 0, replies: [] });
    LS.set("comments_" + articleId, list.slice(0, 200));
    Points.add(POINTS_RULES.comment, "كتابة تعليق");
    renderComments(articleId);
  });

  $$(".c-like", box).forEach((b) => b.addEventListener("click", () => {
    const p = +b.dataset.p, i = +b.dataset.i;
    const target = p > -1 ? list[p]?.replies[i] : list[i];
    if (!target) return;
    target.likedByMe = !target.likedByMe;
    target.likes = Math.max(0, (target.likes || 0) + (target.likedByMe ? 1 : -1));
    LS.set("comments_" + articleId, list); renderComments(articleId);
  }));

  /* الرد عبر حقل داخل الصفحة بدل prompt() — يسمح بتطبيق حد الطول */
  $$(".c-reply", box).forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.i;
    if ($("#reply-form", box)) $("#reply-form", box).remove();
    const form = document.createElement("form");
    form.id = "reply-form";
    form.className = "comment-form";
    form.style.marginTop = "12px";
    form.innerHTML = `
      <textarea maxlength="${LIMITS.reply}" placeholder="اكتب ردك… (حتى ${LIMITS.reply} محرف)" required></textarea>
      <div class="form-foot">
        <button type="button" class="act-btn" id="reply-cancel"><i class="fa-solid fa-xmark"></i> إلغاء</button>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-reply"></i> إرسال الرد</button>
      </div>`;
    b.closest(".c-actions").after(form);
    form.querySelector("textarea").focus();
    $("#reply-cancel", form).addEventListener("click", () => form.remove());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = clamp(form.querySelector("textarea").value, LIMITS.reply);
      if (!t || !list[i]) return;
      (list[i].replies ||= []).push({ name: clamp(user ? user.name : "زائر", LIMITS.name), text: t, at: Date.now(), likes: 0 });
      LS.set("comments_" + articleId, list); renderComments(articleId);
    });
  }));

  $$(".c-report", box).forEach((b) => b.addEventListener("click", () => toast("تم استلام البلاغ وسيراجعه فريق الإشراف", "fa-flag")));
}

/* =========================================================
   صفحة القسم
   ========================================================= */
function initCategory() {
  const cat = catOf(param("cat")) || CATEGORIES[0];
  const sub = param("sub");
  document.title = `${cat.label}${sub ? " — " + sub : ""} | ${SITE.nameAr}`;

  const items = allContent().filter((n) => n.cat === cat.id && (!sub || n.sub === sub || (n.tags || []).includes(sub)));
  $("#cat-shell").innerHTML = `
    <nav class="breadcrumb">
      <a href="index.html"><i class="fa-solid fa-house"></i> الرئيسية</a>
      <i class="fa-solid fa-angle-left"></i><span>${cat.label}</span>
      ${sub ? `<i class="fa-solid fa-angle-left"></i><span>${esc(sub)}</span>` : ""}
    </nav>
    <div class="section-head">
      <div class="titles">
        <span class="kicker"><i class="fa-solid ${cat.icon}"></i> قسم متخصص</span>
        <h2>${cat.label} ${sub ? `— <span class="grad">${esc(sub)}</span>` : ""}</h2>
      </div>
    </div>
    <div class="tags-row" style="margin-bottom:28px">
      <a class="tag-chip ${!sub ? "active" : ""}" href="category.html?cat=${cat.id}">الكل</a>
      ${cat.subs.map((s) => `<a class="tag-chip ${s === sub ? "active" : ""}" href="category.html?cat=${cat.id}&sub=${encodeURIComponent(s)}">${s}</a>`).join("")}
    </div>
    <div class="cards-grid">${items.length ? items.map(newsCardHTML).join("")
      : `<div class="empty-state"><i class="fa-solid fa-inbox"></i>لا توجد مواضيع في هذا التصنيف الفرعي بعد — تابعنا قريباً</div>`}</div>`;
  observeReveals();
}

/* =========================================================
   البحث المتقدم
   ========================================================= */
function initSearch() {
  const form = $("#search-form");
  const doSearch = () => {
    const q = $("#s-q").value.trim().toLowerCase();
    const cat = $("#s-cat").value;
    const auth = $("#s-author").value;
    const from = $("#s-from").value, to = $("#s-to").value;
    const tag = param("tag");
    let items = allContent().filter((n) => {
      const text = (n.title + " " + n.excerpt + " " + (n.tags || []).join(" ")).toLowerCase();
      return (!q || text.includes(q)) &&
        (!cat || n.cat === cat) &&
        (!auth || n.author === auth) &&
        (!from || n.date >= from) && (!to || n.date <= to) &&
        (!tag || (n.tags || []).includes(tag));
    });
    $("#search-results").innerHTML = `
      <p style="color:var(--faint);margin-bottom:18px;font-weight:700">${items.length} نتيجة${tag ? ` للوسم «${esc(tag)}»` : ""}${q ? ` عن «${esc(q)}»` : ""}</p>
      <div class="cards-grid">${items.length ? items.map(newsCardHTML).join("")
        : `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i>لا نتائج مطابقة — جرّب كلمات أو فلاتر أخرى</div>`}</div>`;
    observeReveals();
  };
  $("#s-cat").innerHTML = `<option value="">كل الأقسام</option>` + CATEGORIES.map((c) => `<option value="${escAttr(c.id)}">${esc(c.label)}</option>`).join("");
  $("#s-author").innerHTML = `<option value="">كل الكتّاب</option>` + AUTHORS.map((a) => `<option value="${escAttr(a.id)}">${esc(a.name)}</option>`).join("");
  if (param("q")) $("#s-q").value = param("q");
  form.addEventListener("submit", (e) => { e.preventDefault(); doSearch(); });
  form.addEventListener("change", doSearch);
  $("#s-q").addEventListener("input", doSearch);
  doSearch();
}

/* =========================================================
   صفحة الكاتب
   ========================================================= */
function initAuthor() {
  const a = authorOf(param("id"));
  document.title = `${a.name} | ${SITE.nameAr}`;
  const posts = allContent().filter((n) => n.author === a.id);
  const followed = LS.get("follows", []).includes(a.id);
  $("#author-shell").innerHTML = `
    <div class="panel-box glow author-hero reveal visible">
      <span class="author-avatar ${coverCls(a)}"><i class="fa-solid ${safeToken(a.icon, "fa-user")}"></i></span>
      <div>
        <h1>${esc(a.name)}</h1>
        <div class="role"><i class="fa-solid fa-pen-nib"></i> ${esc(a.role)}</div>
        <p class="bio">${esc(a.bio)}</p>
        <div class="a-stats">
          <span><b>${posts.length}</b> موضوعاً</span>
          <span><b id="f-count">${fmtNum(a.followers + (followed ? 1 : 0))}</b> متابع</span>
          <button class="act-btn ${followed ? "on" : ""}" id="follow-a"><i class="fa-solid fa-user-plus"></i> ${followed ? "تتابعه" : "متابعة"}</button>
          ${Object.entries(a.socials || {}).map(([k, v]) => `<a class="icon-btn" href="${v}" aria-label="${k}"><i class="fa-brands fa-${k === "x" ? "x-twitter" : k}"></i></a>`).join("")}
        </div>
      </div>
    </div>
    <div class="section-head" style="margin-top:40px">
      <div class="titles"><h2>كل مواضيع <span class="grad">${esc(a.name)}</span></h2></div>
    </div>
    <div class="cards-grid">${posts.map(newsCardHTML).join("")}</div>`;
  $("#follow-a").addEventListener("click", () => {
    const f = LS.get("follows", []);
    const i = f.indexOf(a.id);
    if (i > -1) f.splice(i, 1); else f.push(a.id);
    LS.set("follows", f); initAuthor();
  });
  observeReveals();
}

/* =========================================================
   الصفحات الخاصة
   ========================================================= */
function initSpecial() {
  const view = param("view") || "latest";
  const defs = {
    breaking:       { t: "الأخبار العاجلة", i: "fa-tower-broadcast", get: () => allNews().filter((n) => n.breaking) },
    trending:       { t: "الأخبار الرائجة", i: "fa-fire", get: () => [...allContent()].sort((a, b) => viewsOf(b) - viewsOf(a)).slice(0, 9) },
    "most-read":    { t: "الأكثر قراءة", i: "fa-eye", get: () => [...allContent()].sort((a, b) => viewsOf(b) - viewsOf(a)) },
    "most-commented": { t: "الأكثر تعليقاً", i: "fa-comments", get: () => [...allContent()].sort((a, b) => commentsOf(b.id).length - commentsOf(a.id).length).slice(0, 9) },
    latest:         { t: "آخر الأخبار", i: "fa-bolt", get: () => [...allContent()].sort((a, b) => b.date.localeCompare(a.date)) },
    opinions:       { t: "مقالات الرأي", i: "fa-pen-nib", get: () => ARTICLES.filter((x) => x.type === "opinion") },
    reviews:        { t: "المراجعات", i: "fa-star-half-stroke", get: () => REVIEWS.filter((r) => r.kind === "review") },
    comparisons:    { t: "المقارنات", i: "fa-scale-balanced", get: () => REVIEWS.filter((r) => r.kind === "comparison") },
  };
  const d = defs[view] || defs.latest;
  document.title = `${d.t} | ${SITE.nameAr}`;
  const items = d.get();
  $("#special-shell").innerHTML = `
    <div class="section-head">
      <div class="titles">
        <span class="kicker"><i class="fa-solid ${d.i}"></i> صفحة خاصة</span>
        <h2>${d.t}</h2>
      </div>
    </div>
    <div class="tags-row" style="margin-bottom:28px">
      ${Object.entries(defs).map(([k, v]) => `<a class="tag-chip ${k === view ? "active" : ""}" href="special.html?view=${k}"><i class="fa-solid ${v.i}"></i>${v.t}</a>`).join("")}
    </div>
    <div class="cards-grid">${items.length ? items.map(newsCardHTML).join("") : `<div class="empty-state"><i class="fa-solid fa-inbox"></i>لا مواضيع هنا حالياً</div>`}</div>`;
  observeReveals();
}

/* =========================================================
   المسابقات
   ========================================================= */
const QuizState = { quiz: null, idx: 0, answers: [], startAt: 0, timer: null, timeLeft: 0 };

function allQuizzes() { return [...LS.get("adminQuizzes", []), ...QUIZZES]; }

function initQuiz() {
  const qid = param("id");
  if (qid) return startQuiz(qid);
  const shell = $("#quiz-shell");
  const myPts = Points.total();
  const badge = Points.badge();
  const user = Auth.user();

  /* لوحة المتصدرين مع المستخدم الحالي */
  const board = [...LEADERBOARD_SEED, ...(user ? [{ name: user.name, points: myPts, icon: "fa-user", me: true }] : [])]
    .sort((a, b) => b.points - a.points);

  shell.innerHTML = `
    <div class="section-head">
      <div class="titles">
        <span class="kicker"><i class="fa-solid fa-trophy"></i> مسابقات تك آي نيوز</span>
        <h2>اختبر معلوماتك <span class="grad">واربح جوائز حقيقية</span></h2>
      </div>
      <span class="points-pill"><i class="fa-solid fa-star"></i> رصيدك: ${myPts} نقطة</span>
    </div>

    <div class="panel-box glow reveal" style="margin-bottom:34px">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-medal" style="color:var(--cyan)"></i> شاراتك وإنجازاتك</h3>
      <div class="badges-row">${BADGES.map((b) => `<span class="badge-chip ${myPts >= b.min ? "earned" : ""}"><i class="fa-solid ${b.icon}"></i>${b.label}${myPts < b.min ? ` (${b.min}+)` : ""}</span>`).join("")}</div>
      <p style="color:var(--faint);font-size:.8rem;margin-top:12px">اجمع النقاط من قراءة الأخبار والتعليق والمشاركة والمسابقات — شارتك الحالية: <b style="color:#ffd966">${badge.label}</b></p>
    </div>

    <div class="cards-grid" style="margin-bottom:44px">
      ${allQuizzes().map((q) => {
        const attempts = LS.get("quizAttempts_" + q.id, 0);
        const left = q.maxAttempts - attempts;
        return `
        <article class="quiz-card reveal">
          <div class="quiz-cover ${coverCls(q)}"><span class="quiz-period">${esc(q.period)}</span><i class="fa-solid ${safeToken(q.icon, "fa-star")}"></i></div>
          <div class="quiz-body">
            <h3>${esc(q.title)}</h3>
            <p>${esc(q.desc)}</p>
            <div class="quiz-facts">
              <span><i class="fa-solid fa-circle-question"></i> ${q.questions.length} أسئلة</span>
              <span><i class="fa-solid fa-stopwatch"></i> ${q.timePerQ} ث/سؤال</span>
              <span><i class="fa-solid fa-gift"></i> ${q.winners} فائزين</span>
              <span><i class="fa-solid fa-rotate"></i> ${left > 0 ? left + " محاولات متبقية" : "استنفدت المحاولات"}</span>
            </div>
            <div style="font-size:.75rem;color:var(--faint);margin-bottom:14px">
              <b style="color:var(--cyan)">الجوائز:</b> ${q.prizes.map(esc).join(" · ")}<br>
              <b style="color:var(--cyan)">الشروط:</b> ${q.conditions.map(esc).join(" · ")}
            </div>
            <button class="btn btn-primary quiz-start" data-id="${q.id}" ${left <= 0 ? "disabled style='opacity:.4'" : ""}>
              <i class="fa-solid fa-play"></i> ${left > 0 ? "ابدأ المسابقة" : "انتهت محاولاتك"}</button>
          </div>
        </article>`;
      }).join("")}
    </div>

    <div class="section-head"><div class="titles"><h2>🏆 لوحة <span class="grad">المتصدرين</span></h2></div></div>
    <div class="leaderboard reveal" style="margin-bottom:44px">
      ${board.slice(0, 10).map((r, i) => `
        <div class="lb-row top${i + 1} ${r.me ? "me" : ""}">
          <span class="lb-rank">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
          <span class="lb-ava"><i class="fa-solid ${r.icon}"></i></span>
          <b>${esc(r.name)}${r.me ? " (أنت)" : ""}</b>
          <span class="lb-pts"><i class="fa-solid fa-star"></i>${r.points}</span>
        </div>`).join("")}
    </div>

    <div class="section-head"><div class="titles"><h2>🎁 جوائز <span class="grad">هذا الموسم</span></h2></div></div>
    <div class="tags-row reveal" style="margin-bottom:20px">
      ${PRIZES.map((p) => `<span class="tag-chip"><i class="fa-solid ${p.icon}"></i>${p.label}</span>`).join("")}
    </div>
    <p style="color:var(--faint);font-size:.8rem">يُجرى السحب آلياً بين المستوفين للشروط، وتُعلن النتائج في صفحة المسابقة وعبر الإشعارات. سجل السحب محفوظ للمراجعة.</p>`;

  $$(".quiz-start").forEach((b) => b.addEventListener("click", () => {
    const q = allQuizzes().find((x) => x.id === b.dataset.id);
    if (q.requireLogin && !Auth.user()) {
      toast("هذه المسابقة تتطلب تسجيل الدخول أولاً", "fa-lock");
      setTimeout(() => (location.href = "account.html"), 900);
      return;
    }
    location.href = "quiz.html?id=" + q.id;
  }));
  observeReveals();
}

function startQuiz(qid) {
  const quiz = allQuizzes().find((q) => q.id === qid);
  if (!quiz) return (location.href = "quiz.html");
  QuizState.quiz = quiz; QuizState.idx = 0; QuizState.answers = []; QuizState.startAt = Date.now();
  LS.set("quizAttempts_" + qid, LS.get("quizAttempts_" + qid, 0) + 1);
  renderQuestion();
}

function renderQuestion() {
  const { quiz, idx } = QuizState;
  const q = quiz.questions[idx];
  clearInterval(QuizState.timer);
  QuizState.timeLeft = quiz.timePerQ;

  const marker = (i) => `<span class="marker">${["أ", "ب", "ج", "د", "هـ"][i]}</span>`;
  let inner = "";
  if (q.type === "mcq") inner = `<div class="quiz-options">${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${marker(i)}${esc(o)}</button>`).join("")}</div>`;
  if (q.type === "tf") inner = `<div class="quiz-options">
      <button class="quiz-opt" data-i="true"><span class="marker">✔</span>صح</button>
      <button class="quiz-opt" data-i="false"><span class="marker">✖</span>خطأ</button></div>`;
  if (q.type === "multi") inner = `<div class="quiz-options">${q.options.map((o, i) => `<button class="quiz-opt multi" data-i="${i}">${marker(i)}${esc(o)}</button>`).join("")}</div>
      <p style="color:var(--faint);font-size:.78rem;margin-top:10px"><i class="fa-solid fa-circle-info"></i> اختر كل الإجابات الصحيحة ثم اضغط «التالي»</p>`;
  if (q.type === "fill") inner = `<div class="quiz-fill"><input type="text" id="fill-input" placeholder="اكتب إجابتك هنا…" autocomplete="off"></div>`;
  if (q.type === "text") inner = `<div class="quiz-text"><textarea id="text-input" placeholder="اكتب إجابتك بحرية…"></textarea></div>`;

  $("#quiz-shell").innerHTML = `
    <div class="quiz-play panel-box glow">
      <div class="quiz-progress">
        <span class="quiz-timer" id="q-timer">${quiz.timePerQ}</span>
        <div class="track"><div class="fill" style="width:${(idx / quiz.questions.length) * 100}%"></div></div>
        <span class="count">${idx + 1} / ${quiz.questions.length}</span>
      </div>
      <h2 class="quiz-q">${esc(q.q)}</h2>
      ${inner}
      <div class="quiz-foot">
        <a href="quiz.html" class="act-btn"><i class="fa-solid fa-xmark"></i> انسحاب</a>
        <button class="btn btn-primary" id="q-next">${idx + 1 === quiz.questions.length ? "إنهاء المسابقة" : "التالي"} <i class="fa-solid fa-angle-left"></i></button>
      </div>
    </div>`;

  let selected = q.type === "multi" ? [] : null;
  $$(".quiz-opt").forEach((b) => b.addEventListener("click", () => {
    if (q.type === "multi") {
      b.classList.toggle("selected");
      const i = +b.dataset.i;
      selected.includes(i) ? selected.splice(selected.indexOf(i), 1) : selected.push(i);
    } else {
      $$(".quiz-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      selected = q.type === "tf" ? b.dataset.i === "true" : +b.dataset.i;
    }
  }));

  const submit = () => {
    clearInterval(QuizState.timer);
    let ans = selected;
    if (q.type === "fill") ans = $("#fill-input")?.value.trim() || "";
    if (q.type === "text") ans = $("#text-input")?.value.trim() || "";
    QuizState.answers.push(ans);
    QuizState.idx++;
    QuizState.idx < quiz.questions.length ? renderQuestion() : showResults();
  };
  $("#q-next").addEventListener("click", submit);

  QuizState.timer = setInterval(() => {
    QuizState.timeLeft--;
    const t = $("#q-timer");
    if (t) { t.textContent = QuizState.timeLeft; t.classList.toggle("danger", QuizState.timeLeft <= 5); }
    if (QuizState.timeLeft <= 0) submit();
  }, 1000);
}

function isCorrect(q, ans) {
  if (q.type === "mcq") return ans === q.answer;
  if (q.type === "tf") return ans === q.answer;
  if (q.type === "multi") return Array.isArray(ans) && ans.length === q.answer.length && q.answer.every((x) => ans.includes(x));
  if (q.type === "fill") return typeof ans === "string" && q.answer.some((a) => ans.toLowerCase().includes(a.toLowerCase()));
  if (q.type === "text") return typeof ans === "string" && ans.length >= 3; /* تُراجع يدوياً */
  return false;
}

function showResults() {
  const { quiz, answers, startAt } = QuizState;
  const correct = quiz.questions.filter((q, i) => isCorrect(q, answers[i])).length;
  const total = quiz.questions.length;
  const pct = Math.round((correct / total) * 100);
  const secs = Math.round((Date.now() - startAt) / 1000);
  const won = correct === total;
  const pts = correct * POINTS_RULES.quizCorrect + (won ? POINTS_RULES.quizComplete : 0);
  if (pts) Points.add(pts, `نتيجة مسابقة «${quiz.title}»`);

  /* سجل النتائج + الفائزين */
  const log = LS.get("quizLog", []);
  log.unshift({ quiz: quiz.title, correct, total, secs, at: Date.now(), won });
  LS.set("quizLog", log);
  if (won) {
    const winners = LS.get("winners", []);
    const user = Auth.user();
    winners.unshift({ name: user ? user.name : "زائر", quiz: quiz.title, prize: quiz.prizes[0], at: new Date().toISOString().slice(0, 10), score: `${correct}/${total}` });
    LS.set("winners", winners);
    Notify.push(`🎉 تأهلت لسحب «${quiz.title}» على: ${quiz.prizes[0]}`, "fa-trophy");
  }

  $("#quiz-shell").innerHTML = `
    <div class="quiz-play panel-box glow result-hero">
      <div class="result-ring" style="--pct:${pct}"><b>${pct}%</b></div>
      <h2 style="font-weight:900;font-size:1.4rem;margin-bottom:6px">${won ? "🎉 ممتاز! علامة كاملة" : pct >= 60 ? "👏 نتيجة جيدة!" : "💪 حاول مرة أخرى"}</h2>
      <div class="result-stats">
        <div class="rs"><b>${correct}</b><span>إجابات صحيحة</span></div>
        <div class="rs"><b>${total - correct}</b><span>أخطاء</span></div>
        <div class="rs"><b>${secs} ث</b><span>الوقت المستغرق</span></div>
        <div class="rs"><b>+${pts}</b><span>نقاط مكتسبة</span></div>
      </div>
      ${won
        ? `<div class="win-banner"><i class="fa-solid fa-trophy"></i> مبروك! دخلت السحب الرسمي على: ${esc(quiz.prizes[0])}</div>`
        : `<div class="lose-banner">أجب على جميع الأسئلة صحيحاً لدخول السحب على الجوائز</div>`}
      <div class="wheel-wrap" id="wheel-area">
        <h3 style="font-weight:900;margin-bottom:6px">🎡 عجلة الحظ — مكافأة إتمام المسابقة</h3>
        <p style="color:var(--faint);font-size:.8rem;margin-bottom:14px">لفة واحدة مجانية بنقاط إضافية مضمونة</p>
        <div class="wheel-pointer"></div>
        <div class="wheel" id="wheel"></div>
        <button class="btn btn-primary" id="spin-btn"><i class="fa-solid fa-rotate"></i> لُفّ العجلة</button>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        <a href="quiz.html" class="btn btn-ghost"><i class="fa-solid fa-angle-right"></i> كل المسابقات</a>
        <a href="index.html" class="btn btn-ghost"><i class="fa-solid fa-house"></i> الرئيسية</a>
      </div>
    </div>`;

  $("#spin-btn").addEventListener("click", function () {
    this.disabled = true; this.style.opacity = 0.5;
    const rewards = [10, 20, 30, 50, 15, 25, 40, 5];
    const pick = Math.floor(Math.random() * 8);
    $("#wheel").style.transform = `rotate(${360 * 5 + pick * 45 + 22}deg)`;
    setTimeout(() => {
      Points.add(rewards[pick], "جائزة عجلة الحظ 🎡");
      this.textContent = `ربحت ${rewards[pick]} نقطة!`;
    }, 4200);
  });
}

/* =========================================================
   الحساب
   ========================================================= */
function initAccount() {
  const shell = $("#account-shell");
  const user = Auth.user();

  if (!user) {
    shell.innerHTML = `
      <div class="section-head"><div class="titles">
        <span class="kicker"><i class="fa-solid fa-user"></i> منطقة الأعضاء</span>
        <h2>انضم إلى مجتمع <span class="grad">تك آي نيوز</span></h2></div></div>
      <div class="auth-grid">
        <div class="panel-box glow auth-form">
          <h3 style="font-weight:900;margin-bottom:18px"><i class="fa-solid fa-user-plus" style="color:var(--cyan)"></i> حساب جديد <span class="tag-chip" style="font-size:.68rem">+${POINTS_RULES.register} نقطة ترحيبية</span></h3>
          <form id="reg-form">
            <label>الاسم الكامل</label><input type="text" required minlength="3" maxlength="${LIMITS.name}" autocomplete="name">
            <label>البريد الإلكتروني</label><input type="email" required>
            <label>كلمة المرور</label><input type="password" required minlength="8" maxlength="${LIMITS.password}" autocomplete="new-password" placeholder="8 محارف على الأقل، حروف وأرقام">
            <button class="btn btn-primary" style="width:100%;justify-content:center"><i class="fa-solid fa-rocket"></i> إنشاء الحساب</button>
          </form>
        </div>
        <div class="panel-box auth-form">
          <h3 style="font-weight:900;margin-bottom:18px"><i class="fa-solid fa-right-to-bracket" style="color:var(--cyan)"></i> تسجيل الدخول</h3>
          <form id="login-form">
            <label>البريد الإلكتروني</label><input type="email" required>
            <label>كلمة المرور</label><input type="password" required>
            <button class="btn btn-primary" style="width:100%;justify-content:center"><i class="fa-solid fa-right-to-bracket"></i> دخول</button>
          </form>
          <div class="divider">أو عبر</div>
          <div class="social-login">
            <button class="btn btn-ghost" data-social="Google"><i class="fa-brands fa-google"></i> المتابعة بحساب Google</button>
            <button class="btn btn-ghost" data-social="Apple"><i class="fa-brands fa-apple"></i> المتابعة بحساب Apple</button>
            <button class="btn btn-ghost" data-social="Facebook"><i class="fa-brands fa-facebook-f"></i> المتابعة بحساب Facebook</button>
          </div>
          <p style="color:var(--faint);font-size:.72rem;margin-top:14px"><i class="fa-solid fa-circle-info"></i> النسخة التجريبية تحفظ الحسابات محلياً على جهازك — عند الربط بالخادم تتحول لدخول حقيقي OAuth.</p>
        </div>
      </div>`;
    $("#reg-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const [n, em, p] = [...e.target.querySelectorAll("input")].map((i) => i.value);
      const r = Auth.register(n, em, p);
      r.err ? toast(r.err, "fa-triangle-exclamation") : location.reload();
    });
    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const [em, p] = [...e.target.querySelectorAll("input")].map((i) => i.value);
      const r = Auth.login(em, p);
      r.err ? toast(r.err, "fa-triangle-exclamation") : location.reload();
    });
    $$("[data-social]").forEach((b) => b.addEventListener("click", () => { Auth.social(b.dataset.social); setTimeout(() => location.reload(), 800); }));
    return;
  }

  /* ملف المستخدم */
  const pts = Points.total();
  const badge = Points.badge();
  const saved = LS.get("saved", []).map((id) => allContent().find((n) => n.id === id)).filter(Boolean);
  const follows = LS.get("follows", []).map((id) => AUTHORS.find((a) => a.id === id)).filter(Boolean);
  const quizLog = LS.get("quizLog", []);
  const winners = LS.get("winners", []);

  shell.innerHTML = `
    <div class="panel-box glow profile-head reveal visible">
      <span class="author-avatar cover-g1" style="width:84px;height:84px;font-size:2rem"><i class="fa-solid fa-user-astronaut"></i></span>
      <div style="flex:1">
        <h2 style="font-weight:900">${esc(user.name)}</h2>
        <p style="color:var(--faint);font-size:.85rem">${esc(user.email)}</p>
        <div class="badges-row" style="margin-top:10px">
          <span class="badge-chip earned"><i class="fa-solid ${badge.icon}"></i>${badge.label}</span>
        </div>
      </div>
      <div style="text-align:center">
        <span class="points-pill" style="font-size:1.05rem"><i class="fa-solid fa-star"></i> ${pts} نقطة</span>
        <button class="act-btn" style="margin-top:10px" id="logout-btn"><i class="fa-solid fa-right-from-bracket"></i> خروج</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="saved"><i class="fa-solid fa-bookmark"></i> المحفوظات (${saved.length})</button>
      <button class="tab-btn" data-tab="follows"><i class="fa-solid fa-user-check"></i> أتابعهم (${follows.length})</button>
      <button class="tab-btn" data-tab="quiz"><i class="fa-solid fa-trophy"></i> مسابقاتي (${quizLog.length})</button>
      <button class="tab-btn" data-tab="wins"><i class="fa-solid fa-gift"></i> لوحة الفائزين (${winners.length})</button>
    </div>

    <div class="tab-pane active" id="tab-saved">
      ${saved.length ? `<div class="cards-grid">${saved.map(newsCardHTML).join("")}</div>`
        : `<div class="empty-state"><i class="fa-regular fa-bookmark"></i>لم تحفظ أي مواضيع بعد — اضغط «حفظ» في أي خبر</div>`}
    </div>
    <div class="tab-pane" id="tab-follows">
      ${follows.length ? follows.map((a) => `
        <div class="trend-item"><span class="lb-ava"><i class="fa-solid ${a.icon}"></i></span>
          <h4><a href="author.html?id=${encodeURIComponent(a.id)}">${a.name}</a> — <span style="color:var(--faint);font-weight:600">${a.role}</span></h4></div>`).join("")
        : `<div class="empty-state"><i class="fa-solid fa-user-plus"></i>لا تتابع أي كاتب بعد</div>`}
    </div>
    <div class="tab-pane" id="tab-quiz">
      ${quizLog.length ? `<div class="table-scroll"><table class="data-table">
        <tr><th>المسابقة</th><th>النتيجة</th><th>الوقت</th><th>الحالة</th></tr>
        ${quizLog.map((l) => `<tr><td>${esc(l.quiz)}</td><td>${l.correct}/${l.total}</td><td>${l.secs} ث</td>
          <td><span class="status-pill ${l.won ? "pub" : "arch"}">${l.won ? "دخل السحب 🎉" : "لم يكتمل"}</span></td></tr>`).join("")}
      </table></div>` : `<div class="empty-state"><i class="fa-solid fa-trophy"></i>لم تشارك في مسابقات بعد — <a href="quiz.html" style="color:var(--blue-soft)">ابدأ الآن</a></div>`}
    </div>
    <div class="tab-pane" id="tab-wins">
      ${winners.length ? `<div class="table-scroll"><table class="data-table">
        <tr><th>الفائز</th><th>المسابقة</th><th>الجائزة</th><th>الدرجة</th><th>التاريخ</th></tr>
        ${winners.map((w) => `<tr><td><b>${esc(w.name)}</b></td><td>${esc(w.quiz)}</td><td>🎁 ${esc(w.prize)}</td><td>${w.score}</td><td>${w.at}</td></tr>`).join("")}
      </table></div>` : `<div class="empty-state"><i class="fa-solid fa-gift"></i>لا فائزين بعد — كن الأول!</div>`}
    </div>`;

  $("#logout-btn").addEventListener("click", () => Auth.logout());
  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    $$(".tab-btn").forEach((x) => x.classList.remove("active"));
    $$(".tab-pane").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $("#tab-" + b.dataset.tab).classList.add("active");
  }));
  observeReveals();
}

/* =========================================================
   لوحة التحكم
   ========================================================= */
function initAdmin() {
  /* لا يُعرض أي شيء من اللوحة قبل اجتياز القفل */
  if (!Admin.session()) return renderAdminGate();

  const views = {
    dash: renderAdminDash, news: renderAdminNews, cats: renderAdminCats,
    comments: renderAdminComments, quizzes: renderAdminQuizzes,
    newsletter: renderAdminNewsletter, ads: renderAdminAds, seo: renderAdminSEO,
    users: renderAdminUsers, logs: renderAdminLogs,
  };
  const role = Admin.role();
  const roleDef = ROLES[role] || ROLES.mod;

  /* بناء القائمة الجانبية حسب صلاحيات الدور فقط */
  const items = [
    ["dash", "fa-gauge-high", "الإحصائيات"], ["news", "fa-newspaper", "إدارة الأخبار"],
    ["cats", "fa-layer-group", "التصنيفات والوسوم"], ["comments", "fa-comments", "التعليقات"],
    ["quizzes", "fa-trophy", "المسابقات"], ["newsletter", "fa-envelope", "النشرة البريدية"],
    ["ads", "fa-rectangle-ad", "الإعلانات"], ["seo", "fa-magnifying-glass-chart", "SEO"],
    ["users", "fa-users-gear", "المستخدمون والأدوار"], ["logs", "fa-clock-rotate-left", "سجل العمليات"],
  ].filter(([v]) => Admin.can(v));

  $(".admin-side").innerHTML = `
    <div class="admin-who">
      <span class="lb-ava"><i class="fa-solid ${safeToken(roleDef.icon, "fa-user")}"></i></span>
      <div><b>${esc(roleDef.label)}</b><span>جلسة إدارة نشطة</span></div>
    </div>
    ${items.map(([v, i, l], k) => `<button class="${k === 0 ? "active" : ""}" data-v="${escAttr(v)}"><i class="fa-solid ${i}"></i> ${l}</button>`).join("")}
    <button id="admin-lock" style="color:#ff9d9d"><i class="fa-solid fa-lock"></i> إقفال اللوحة</button>`;

  $$(".admin-side button[data-v]").forEach((b) => b.addEventListener("click", () => {
    Admin.touch();
    if (!Admin.can(b.dataset.v)) return toast("لا تملك صلاحية هذا القسم", "fa-ban");
    $$(".admin-side button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    views[b.dataset.v]();
  }));
  $("#admin-lock").addEventListener("click", () => { Admin.log("إقفال اللوحة", "fa-lock"); Admin.lock(); });

  /* إنهاء الجلسة تلقائياً عند الخمول */
  setInterval(() => { if (!Admin.session()) { toast("انتهت جلسة الإدارة", "fa-lock"); location.reload(); } }, 30000);
  ["click", "keydown"].forEach((ev) => document.addEventListener(ev, () => Admin.touch(), { passive: true }));

  (views[items[0]?.[0]] || renderAdminDash)();
}

/* شاشة القفل — ضبط أول مرة أو دخول */
function renderAdminGate() {
  const side = $(".admin-side");
  if (side) side.style.display = "none";
  const first = !Admin.isSetUp();

  adminMain().innerHTML = `
    <div class="admin-gate panel-box glow">
      <span class="gate-ico"><i class="fa-solid fa-shield-halved"></i></span>
      <h2>${first ? "تأمين لوحة التحكم" : "لوحة التحكم مقفلة"}</h2>
      <p>${first
        ? "اضبط كلمة مرور للوحة التحكم. لن تُخزَّن كلمة المرور نفسها — فقط بصمة SHA-256 مملّحة."
        : "أدخل كلمة مرور اللوحة للمتابعة. تنتهي الجلسة تلقائياً بعد 30 دقيقة خمول."}</p>

      <form class="auth-form" id="gate-form" autocomplete="off">
        ${first ? `
          <label>الدور</label>
          <select id="gate-role">${Object.entries(ROLES).map(([k, r]) => `<option value="${escAttr(k)}">${esc(r.label)}</option>`).join("")}</select>` : ""}
        <label>كلمة المرور</label>
        <input type="password" id="gate-pass" required autocomplete="new-password" maxlength="${LIMITS.password}"
               placeholder="8 محارف على الأقل، حروف وأرقام">
        <button class="btn btn-primary" style="width:100%;justify-content:center">
          <i class="fa-solid ${first ? "fa-key" : "fa-unlock"}"></i> ${first ? "ضبط وحفظ" : "دخول"}</button>
      </form>

      <div class="gate-warn">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><b>اعرف حدود هذه الحماية:</b> الموقع يعمل بلا خادم، وهذا قفل على مستوى الواجهة فقط.
        من يملك الجهاز يستطيع تجاوزه من أدوات المطوّر. للحماية الفعلية يلزم ربط اللوحة بباك إند
        (Firebase Auth أو API) يتحقق من الصلاحيات على الخادم.</div>
      </div>
      ${!first ? `<button class="act-btn" id="gate-reset"><i class="fa-solid fa-rotate-left"></i> نسيت كلمة المرور — إعادة الضبط ومسح بيانات الإدارة</button>` : ""}
    </div>`;

  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = $("#gate-pass").value;
    const r = first
      ? await Admin.setup(pass, safePick(ROLES, $("#gate-role").value, "admin") ? $("#gate-role").value : "admin")
      : await Admin.unlock(pass);
    if (r.err) return toast(r.err, "fa-triangle-exclamation");
    toast(first ? "تم تأمين اللوحة بنجاح" : "أهلاً بك", "fa-shield-halved");
    if (side) side.style.display = "";
    initAdmin();
  });

  $("#gate-reset")?.addEventListener("click", () => {
    if (!confirm("سيُمسح قفل اللوحة وسجل العمليات والأخبار والمسابقات المضافة محلياً. متابعة؟")) return;
    ["adminHash", "adminSalt", "adminRole", "adminSession", "adminFails", "auditLog", "adminNews", "adminQuizzes"]
      .forEach((k) => localStorage.removeItem("tan_" + k));
    location.reload();
  });
}

/* إدارة المستخدمين والأدوار */
function renderAdminUsers() {
  const users = Auth.users();
  adminMain().innerHTML = `
    <div class="panel-box" style="margin-bottom:24px">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-users-gear" style="color:var(--cyan)"></i> المستخدمون المسجلون (${users.length})</h3>
      ${users.length ? `<div class="table-scroll"><table class="data-table">
        <tr><th>الاسم</th><th>البريد</th><th>طريقة الدخول</th><th>كلمة المرور</th><th>تاريخ الانضمام</th></tr>
        ${users.map((u) => `<tr>
          <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
          <td>${u.social ? esc(u.social) : "بريد وكلمة مرور"}</td>
          <td><span class="status-pill ${u.hash ? "pub" : "draft"}">${u.hash ? "مُجزَّأة SHA-256" : u.social ? "لا تنطبق" : "قديمة — تُرحَّل عند الدخول"}</span></td>
          <td>${esc(u.joined)}</td></tr>`).join("")}
      </table></div>` : `<div class="empty-state"><i class="fa-solid fa-users"></i>لا مستخدمين مسجلين من هذا المتصفح</div>`}
      <p style="color:var(--faint);font-size:.78rem;margin-top:14px"><i class="fa-solid fa-circle-info"></i>
        كلمات المرور تُخزَّن كبصمة SHA-256 مع مِلح فريد لكل مستخدم — لا يمكن استرجاع النص الأصلي منها.</p>
    </div>
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-user-shield" style="color:var(--cyan)"></i> الأدوار والصلاحيات</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>الدور</th><th>الأقسام المصرّح بها</th></tr>
        ${Object.entries(ROLES).map(([k, r]) => `<tr>
          <td><i class="fa-solid ${safeToken(r.icon, "fa-user")}" style="color:var(--blue-soft);margin-inline-end:8px"></i><b>${esc(r.label)}</b>${k === Admin.role() ? ' <span class="status-pill pub">دورك الحالي</span>' : ""}</td>
          <td>${r.can.map(esc).join(" · ")}</td></tr>`).join("")}
      </table></div>
    </div>`;
}

/* سجل العمليات */
function renderAdminLogs() {
  const logs = Admin.logs();
  adminMain().innerHTML = `
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--cyan)"></i> سجل العمليات (${logs.length})</h3>
      ${logs.length ? `<div class="table-scroll"><table class="data-table">
        <tr><th>العملية</th><th>الدور</th><th>الوقت</th></tr>
        ${logs.map((l) => `<tr>
          <td><i class="fa-solid ${safeToken(l.icon, "fa-circle")}" style="color:var(--blue-soft);margin-inline-end:8px"></i>${esc(l.action)}</td>
          <td>${esc((ROLES[l.role] || {}).label || l.role)}</td>
          <td>${new Date(l.at).toLocaleString("ar-EG")}</td></tr>`).join("")}
      </table></div>` : `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i>لا عمليات مسجلة بعد</div>`}
    </div>`;
}

function adminMain() { return $("#admin-main"); }

function renderAdminDash() {
  const totalViews = allContent().reduce((s, n) => s + viewsOf(n), 0);
  const comments = allContent().reduce((s, n) => s + commentsOf(n.id).length, 0);
  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const seed = [62, 78, 55, 90, 84, 70, 96];
  adminMain().innerHTML = `
    <div class="demo-note"><i class="fa-solid fa-flask"></i> نسخة عرض تفاعلية — البيانات تُحفظ محلياً في متصفحك، وكل شاشة جاهزة للربط بواجهة API حقيقية.</div>
    <div class="stats-grid">
      <div class="stat-card"><i class="fa-solid fa-eye bgi"></i><b>${fmtNum(totalViews)}</b><span>إجمالي المشاهدات</span> <span class="delta">▲ 12%</span></div>
      <div class="stat-card"><i class="fa-solid fa-newspaper bgi"></i><b>${allContent().length}</b><span>المواضيع المنشورة</span> <span class="delta">▲ 5</span></div>
      <div class="stat-card"><i class="fa-solid fa-comments bgi"></i><b>${comments}</b><span>التعليقات</span></div>
      <div class="stat-card"><i class="fa-solid fa-users bgi"></i><b>${Auth.users().length + 1240}</b><span>المستخدمون المسجلون</span> <span class="delta">▲ 8%</span></div>
      <div class="stat-card"><i class="fa-solid fa-envelope bgi"></i><b>${LS.get("newsletter", []).length + 856}</b><span>مشتركو النشرة</span></div>
      <div class="stat-card"><i class="fa-solid fa-trophy bgi"></i><b>${LS.get("quizLog", []).length}</b><span>مشاركات المسابقات</span></div>
    </div>
    <div class="panel-box" style="margin-bottom:24px">
      <h3 style="font-weight:900;margin-bottom:8px"><i class="fa-solid fa-chart-column" style="color:var(--cyan)"></i> زيارات الأسبوع</h3>
      <div class="bar-chart" style="margin-bottom:30px">${seed.map((h, i) => `<div class="bar" style="height:${h}%"><span>${days[i]}</span></div>`).join("")}</div>
    </div>
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-fire" style="color:var(--cyan)"></i> الأكثر قراءة</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>#</th><th>العنوان</th><th>القسم</th><th>المشاهدات</th></tr>
        ${[...allContent()].sort((a, b) => viewsOf(b) - viewsOf(a)).slice(0, 6)
          .map((n, i) => `<tr><td>${i + 1}</td><td><a href="article.html?id=${n.id}" style="color:var(--text)">${esc(n.title.slice(0, 60))}…</a></td><td>${catLabel(n.cat)}</td><td>${fmtNum(viewsOf(n))}</td></tr>`).join("")}
      </table></div>
    </div>`;
}

function renderAdminNews() {
  const custom = LS.get("adminNews", []);
  const rows = [
    ...custom.map((n, i) => ({ ...n, _custom: i })),
    ...NEWS.map((n) => ({ ...n, status: "منشور" })),
  ];
  const statusCls = { "منشور": "pub", "مسودة": "draft", "مجدول": "sched", "مؤرشف": "arch", "قيد المراجعة": "draft" };
  adminMain().innerHTML = `
    <div class="panel-box" style="margin-bottom:24px">
      <h3 style="font-weight:900;margin-bottom:16px"><i class="fa-solid fa-plus" style="color:var(--cyan)"></i> إضافة خبر جديد</h3>
      <form class="admin-form" id="add-news-form">
        <div><label>عنوان الخبر</label><input name="title" required maxlength="${LIMITS.title}"></div>
        <div class="row2">
          <div><label>القسم</label><select name="cat">${CATEGORIES.map((c) => `<option value="${escAttr(c.id)}">${esc(c.label)}</option>`).join("")}</select></div>
          <div><label>الحالة</label><select name="status"><option>منشور</option><option>مسودة</option><option>مجدول</option><option>قيد المراجعة</option><option>مؤرشف</option></select></div>
        </div>
        <div class="row2">
          <div><label>الكاتب</label><select name="author">${AUTHORS.map((a) => `<option value="${escAttr(a.id)}">${esc(a.name)}</option>`).join("")}</select></div>
          <div><label>تاريخ النشر / الجدولة</label><input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
        <div><label>مقدمة مختصرة</label><input name="excerpt" required maxlength="${LIMITS.excerpt}"></div>
        <div><label>نص الخبر (افصل الفقرات بسطر فارغ)</label><textarea name="body" required maxlength="${LIMITS.body}"></textarea></div>
        <div><label>وسوم (مفصولة بفواصل)</label><input name="tags" placeholder="ذكاء اصطناعي, Google"></div>
        <button class="btn btn-primary" style="justify-self:start"><i class="fa-solid fa-floppy-disk"></i> حفظ الخبر</button>
      </form>
    </div>
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-newspaper" style="color:var(--cyan)"></i> إدارة الأخبار (${rows.length})</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>العنوان</th><th>القسم</th><th>الكاتب</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr>
        ${rows.map((n) => `
          <tr><td>${esc(n.title.slice(0, 50))}…</td><td>${catLabel(n.cat)}</td><td>${authorOf(n.author).name}</td><td>${n.date}</td>
          <td><span class="status-pill ${statusCls[n.status] || "pub"}">${n.status}</span></td>
          <td style="white-space:nowrap">
            ${n._custom !== undefined
              ? `<button class="mini-btn danger del-news" data-i="${n._custom}" title="حذف"><i class="fa-solid fa-trash"></i></button>
                 <button class="mini-btn arch-news" data-i="${n._custom}" title="أرشفة"><i class="fa-solid fa-box-archive"></i></button>`
              : `<a class="mini-btn" href="article.html?id=${n.id}" title="عرض"><i class="fa-solid fa-eye"></i></a>`}
          </td></tr>`).join("")}
      </table></div>
    </div>`;

  $("#add-news-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const list = LS.get("adminNews", []);
    list.unshift({
      id: "custom-" + Date.now(),
      title: clamp(f.get("title"), LIMITS.title), excerpt: clamp(f.get("excerpt"), LIMITS.excerpt),
      body: clamp(f.get("body"), LIMITS.body).split(/\n\s*\n/).filter(Boolean),
      cat: safeToken(f.get("cat"), "ai"), author: safeToken(f.get("author"), "team"), date: clamp(f.get("date"), 10),
      status: clamp(f.get("status"), 20),
      tags: clamp(f.get("tags"), LIMITS.tags).split(",").map((t) => clamp(t, 40)).filter(Boolean).slice(0, 8),
      readMins: Math.max(2, Math.round(f.get("body").length / 700)),
      cover: "g" + (1 + Math.floor(Math.random() * 6)), icon: "fa-newspaper", views: 0, sources: [],
    });
    LS.set("adminNews", list);
    Admin.log(`إضافة خبر: ${clamp(f.get("title"), 60)} (${f.get("status")})`, "fa-plus");
    toast("تم حفظ الخبر بنجاح"); renderAdminNews();
  });
  $$(".del-news").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("حذف هذا الخبر نهائياً؟")) return;
    const list = LS.get("adminNews", []);
    Admin.log(`حذف خبر: ${clamp((list[+b.dataset.i] || {}).title, 60)}`, "fa-trash");
    list.splice(+b.dataset.i, 1);
    LS.set("adminNews", list); renderAdminNews();
  }));
  $$(".arch-news").forEach((b) => b.addEventListener("click", () => {
    const list = LS.get("adminNews", []);
    list[+b.dataset.i].status = "مؤرشف";
    Admin.log(`أرشفة خبر: ${clamp(list[+b.dataset.i].title, 60)}`, "fa-box-archive");
    LS.set("adminNews", list); renderAdminNews();
  }));
}

function renderAdminCats() {
  adminMain().innerHTML = `
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-layer-group" style="color:var(--cyan)"></i> التصنيفات والوسوم</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>القسم</th><th>الأقسام الفرعية</th><th>عدد المواضيع</th></tr>
        ${CATEGORIES.map((c) => `<tr><td><i class="fa-solid ${c.icon}" style="color:var(--blue-soft);margin-inline-end:8px"></i><b>${c.label}</b></td>
          <td>${c.subs.map(esc).join(" · ")}</td><td>${allContent().filter((n) => n.cat === c.id).length}</td></tr>`).join("")}
      </table></div>
      <p style="color:var(--faint);font-size:.78rem;margin-top:14px"><i class="fa-solid fa-circle-info"></i> في النسخة المربوطة بالخادم يمكن الإضافة والتعديل والحذف مباشرة من هنا.</p>
    </div>`;
}

function renderAdminComments() {
  const all = [];
  allContent().forEach((n) => commentsOf(n.id).forEach((c, i) => all.push({ ...c, article: n, i })));
  adminMain().innerHTML = `
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-comments" style="color:var(--cyan)"></i> إدارة التعليقات (${all.length})</h3>
      ${all.length ? `<div class="table-scroll"><table class="data-table">
        <tr><th>الكاتب</th><th>التعليق</th><th>الموضوع</th><th>إجراءات</th></tr>
        ${all.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.text.slice(0, 60))}…</td>
          <td>${esc(c.article.title.slice(0, 30))}…</td>
          <td style="white-space:nowrap">
            <button class="mini-btn c-pin" data-a="${c.article.id}" data-i="${c.i}" title="تثبيت"><i class="fa-solid fa-thumbtack"></i></button>
            <button class="mini-btn danger c-del" data-a="${c.article.id}" data-i="${c.i}" title="حذف"><i class="fa-solid fa-trash"></i></button>
            <button class="mini-btn danger c-ban" title="حظر المستخدم"><i class="fa-solid fa-ban"></i></button>
          </td></tr>`).join("")}
      </table></div>` : `<div class="empty-state"><i class="fa-solid fa-comments"></i>لا تعليقات بعد</div>`}
    </div>`;
  $$(".c-del").forEach((b) => b.addEventListener("click", () => {
    const list = commentsOf(b.dataset.a);
    Admin.log(`حذف تعليق لـ ${clamp((list[+b.dataset.i] || {}).name, 40)}`, "fa-trash");
    list.splice(+b.dataset.i, 1);
    LS.set("comments_" + b.dataset.a, list); renderAdminComments();
  }));
  $$(".c-pin").forEach((b) => b.addEventListener("click", () => {
    const list = commentsOf(b.dataset.a);
    list[+b.dataset.i].pinned = !list[+b.dataset.i].pinned;
    Admin.log(`${list[+b.dataset.i].pinned ? "تثبيت" : "إلغاء تثبيت"} تعليق`, "fa-thumbtack");
    LS.set("comments_" + b.dataset.a, list); toast("تم تحديث التثبيت"); renderAdminComments();
  }));
  $$(".c-ban").forEach((b) => b.addEventListener("click", () => toast("تم حظر المستخدم (تجريبي)", "fa-ban")));
}

function renderAdminQuizzes() {
  adminMain().innerHTML = `
    <div class="panel-box" style="margin-bottom:24px">
      <h3 style="font-weight:900;margin-bottom:16px"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--cyan)"></i> إنشاء مسابقة سريعة</h3>
      <form class="admin-form" id="add-quiz-form">
        <div class="row2">
          <div><label>اسم المسابقة</label><input name="title" required></div>
          <div><label>الدورية</label><select name="period"><option>يومية</option><option>أسبوعية</option><option>شهرية</option></select></div>
        </div>
        <div><label>الوصف</label><input name="desc" required></div>
        <div class="row2">
          <div><label>سؤال اختيار من متعدد</label><input name="q1" placeholder="نص السؤال" required></div>
          <div><label>الخيارات (افصل بفواصل — الأول هو الصحيح)</label><input name="q1o" placeholder="الإجابة الصحيحة, خيار2, خيار3" required></div>
        </div>
        <div class="row2">
          <div><label>سؤال صح/خطأ</label><input name="q2" placeholder="عبارة صحيحة" required></div>
          <div><label>الجائزة</label><input name="prize" value="100 نقطة"></div>
        </div>
        <button class="btn btn-primary" style="justify-self:start"><i class="fa-solid fa-plus"></i> إنشاء المسابقة</button>
      </form>
      <p style="color:var(--faint);font-size:.78rem;margin-top:12px"><i class="fa-solid fa-robot"></i> عند الربط بالخادم: زر «توليد الأسئلة بالذكاء الاصطناعي من خبر» بنقرة واحدة.</p>
    </div>
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-trophy" style="color:var(--cyan)"></i> المسابقات الحالية</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>المسابقة</th><th>الدورية</th><th>الأسئلة</th><th>من</th><th>إلى</th></tr>
        ${allQuizzes().map((q) => `<tr><td><b>${esc(q.title)}</b></td><td>${q.period}</td><td>${q.questions.length}</td><td>${q.startDate}</td><td>${q.endDate}</td></tr>`).join("")}
      </table></div>
    </div>`;
  $("#add-quiz-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const opts = clamp(f.get("q1o"), 400).split(",").map((s) => clamp(s, 80)).filter(Boolean);
    const list = LS.get("adminQuizzes", []);
    list.unshift({
      id: "cq-" + Date.now(), title: clamp(f.get("title"), LIMITS.title), desc: clamp(f.get("desc"), LIMITS.excerpt),
      cover: "g6", icon: "fa-star", period: clamp(f.get("period"), 20),
      startDate: new Date().toISOString().slice(0, 10), endDate: "2026-12-31",
      winners: 1, timePerQ: 30, maxAttempts: 3, requireLogin: false,
      prizes: [clamp(f.get("prize"), 80)], conditions: ["إكمال جميع الأسئلة"],
      questions: [
        { type: "mcq", q: clamp(f.get("q1"), 300), options: opts.slice(0, 6), answer: 0 },
        { type: "tf", q: clamp(f.get("q2"), 300), answer: true },
      ],
    });
    LS.set("adminQuizzes", list);
    Admin.log(`إنشاء مسابقة: ${clamp(f.get("title"), 60)}`, "fa-trophy");
    toast("تم إنشاء المسابقة!"); renderAdminQuizzes();
  });
}

function renderAdminNewsletter() {
  const subs = LS.get("newsletter", []);
  adminMain().innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><i class="fa-solid fa-envelope bgi"></i><b>${subs.length + 856}</b><span>إجمالي المشتركين</span></div>
      <div class="stat-card"><i class="fa-solid fa-envelope-open bgi"></i><b>62%</b><span>معدل الفتح</span></div>
      <div class="stat-card"><i class="fa-solid fa-arrow-pointer bgi"></i><b>18%</b><span>معدل النقر CTR</span></div>
    </div>
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:14px"><i class="fa-solid fa-paper-plane" style="color:var(--cyan)"></i> المشتركون الجدد (من هذا المتصفح)</h3>
      ${subs.length ? `<div class="table-scroll"><table class="data-table"><tr><th>#</th><th>البريد</th></tr>
        ${subs.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s)}</td></tr>`).join("")}</table></div>`
        : `<div class="empty-state"><i class="fa-solid fa-envelope"></i>لا اشتراكات جديدة من هذا المتصفح بعد</div>`}
    </div>`;
}

function renderAdminAds() {
  const ads = LS.get("adsOn", true);
  adminMain().innerHTML = `
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:16px"><i class="fa-solid fa-rectangle-ad" style="color:var(--cyan)"></i> إدارة الإعلانات</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>الموضع</th><th>النوع</th><th>الحالة</th></tr>
        <tr><td>أعلى الرئيسية</td><td>Banner 970×250</td><td><span class="status-pill pub">فعّال</span></td></tr>
        <tr><td>بين الأقسام</td><td>Native Ad</td><td><span class="status-pill pub">فعّال</span></td></tr>
        <tr><td>داخل المقال</td><td>In-Article</td><td><span class="status-pill draft">متوقف</span></td></tr>
        <tr><td>أسفل الشاشة</td><td>Sticky</td><td><span class="status-pill draft">متوقف</span></td></tr>
      </table></div>
      <div style="margin-top:18px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="act-btn ${ads ? "on" : ""}" id="ads-toggle"><i class="fa-solid fa-power-off"></i> ${ads ? "المساحات الإعلانية ظاهرة" : "المساحات الإعلانية مخفية"}</button>
      </div>
      <p style="color:var(--faint);font-size:.78rem;margin-top:14px"><i class="fa-solid fa-circle-info"></i> عند الربط: تُستبدل المساحات بأكواد Google AdSense أو الإعلانات المباشرة، مع فصل كامل بين الإعلان والمحتوى.</p>
    </div>`;
  $("#ads-toggle").addEventListener("click", () => { LS.set("adsOn", !ads); renderAdminAds(); });
}

function renderAdminSEO() {
  adminMain().innerHTML = `
    <div class="panel-box">
      <h3 style="font-weight:900;margin-bottom:16px"><i class="fa-solid fa-magnifying-glass-chart" style="color:var(--cyan)"></i> إعدادات SEO</h3>
      <div class="table-scroll"><table class="data-table">
        <tr><th>العنصر</th><th>الحالة</th></tr>
        <tr><td>Meta Title & Description لكل صفحة</td><td><span class="status-pill pub">مفعّل</span></td></tr>
        <tr><td>Open Graph + Twitter Cards</td><td><span class="status-pill pub">مفعّل</span></td></tr>
        <tr><td>Canonical URLs</td><td><span class="status-pill pub">مفعّل</span></td></tr>
        <tr><td>Schema.org (NewsArticle)</td><td><span class="status-pill pub">يُحقن آلياً في صفحات الأخبار</span></td></tr>
        <tr><td>sitemap.xml</td><td><span class="status-pill pub">موجود — <a href="sitemap.xml" style="color:var(--cyan)">عرض</a></span></td></tr>
        <tr><td>robots.txt</td><td><span class="status-pill pub">موجود</span></td></tr>
        <tr><td>RSS Feed</td><td><span class="status-pill pub">موجود — <a href="rss.xml" style="color:var(--cyan)">عرض</a></span></td></tr>
        <tr><td>PWA (Manifest + Service Worker)</td><td><span class="status-pill pub">مفعّل</span></td></tr>
        <tr><td>Lazy Loading للصور</td><td><span class="status-pill pub">مفعّل</span></td></tr>
        <tr><td>AMP</td><td><span class="status-pill arch">اختياري — غير مفعّل</span></td></tr>
      </table></div>
    </div>`;
}

/* =========================================================
   الصفحات الثابتة
   ========================================================= */
function initStatic() {
  /* safePick يمنع الوصول لـ __proto__ / constructor عبر ?page= */
  const p = safePick(STATIC_PAGES, param("page"), "about") || STATIC_PAGES.about;
  document.title = `${p.title} | ${SITE.nameAr}`;
  $("#static-shell").innerHTML = `
    <nav class="breadcrumb"><a href="index.html"><i class="fa-solid fa-house"></i> الرئيسية</a>
      <i class="fa-solid fa-angle-left"></i><span>${p.title}</span></nav>
    <h1><i class="fa-solid ${p.icon}"></i>${p.title}</h1>
    <div class="static-body panel-box" style="margin-top:20px">
      ${p.body.map((t) => `<p>${esc(t)}</p>`).join("")}
      ${p.form ? `
        <form class="admin-form" id="contact-form" style="margin-top:10px">
          <div class="row2">
            <div><label>الاسم</label><input required></div>
            <div><label>البريد الإلكتروني</label><input type="email" required></div>
          </div>
          <div><label>الموضوع</label><input required></div>
          <div><label>الرسالة</label><textarea required></textarea></div>
          <button class="btn btn-primary" style="justify-self:start"><i class="fa-solid fa-paper-plane"></i> إرسال</button>
        </form>` : ""}
      ${p.showTeam ? `<div class="cards-grid" style="margin-top:20px">${AUTHORS.map((a) => `
        <a class="article-card" href="author.html?id=${encodeURIComponent(a.id)}">
          <span class="article-icon ${coverCls(a)}"><i class="fa-solid ${a.icon}"></i></span>
          <div class="article-info"><h3>${a.name}</h3><p>${a.role}</p></div>
        </a>`).join("")}</div>` : ""}
    </div>`;
  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("تم إرسال رسالتك — سنعود إليك قريباً", "fa-paper-plane");
    e.target.reset();
  });
}

/* =========================================================
   حركات الظهور + الإقلاع
   ========================================================= */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("visible"); revealObserver.unobserve(en.target); }
  });
}, { threshold: 0.1 });
function observeReveals(scope = document) { $$(".reveal", scope).forEach((el) => revealObserver.observe(el)); }

document.addEventListener("DOMContentLoaded", () => {
  buildShell();
  const page = document.body.dataset.page;
  const inits = { home: initHome, article: initArticle, category: initCategory, search: initSearch, author: initAuthor, special: initSpecial, quiz: initQuiz, account: initAccount, admin: initAdmin, static: initStatic };
  inits[page]?.();
  observeReveals();
});
