// NewlyNow — owner-only security settings
(async function () {
  'use strict';
  const tabs = document.querySelector('#app .tabs');
  const appEl = document.getElementById('app');
  if (!tabs || !appEl || document.getElementById('tab-security-core')) return;

  const OWNERS = ['elawaady.official@gmail.com', 'elawadi.store4@gmail.com'];
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.tab = 'security-core';
  tab.innerHTML = '<i class="fas fa-shield-halved"></i> الأمان';
  tab.style.display = 'none';
  tabs.appendChild(tab);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'tab-security-core';
  panel.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-shield-halved"></i> App Check + Secure Commerce API</h3>
      <p class="muted" style="margin-bottom:14px">القيم هنا Public configuration فقط. مفاتيح البوابات وSecrets ممنوع تخزينها في Firestore أو الواجهة.</p>
      <div class="field">
        <label>reCAPTCHA Enterprise Site Key</label>
        <input type="text" id="nnAppCheckKey" autocomplete="off" placeholder="6Lc..." maxlength="300">
      </div>
      <div class="field">
        <label>Firebase Functions API Base URL</label>
        <input type="url" id="nnApiBase" autocomplete="off" placeholder="https://REGION-PROJECT.cloudfunctions.net" maxlength="500">
        <p class="hint">اكتب الـBase فقط بدون /createOrder أو /initPayment.</p>
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <button class="btn" id="nnSecuritySave"><i class="fas fa-floppy-disk"></i> حفظ إعدادات الأمان</button>
        <span class="pill wait" id="nnSecurityState">غير جاهز</span>
      </div>
      <p class="hint" style="margin-top:12px">المسار المالي الآمن يصبح جاهزًا فقط عند وجود App Check + HTTPS API Base. بعدها الواجهة تفضّل إنشاء الطلب ومحاولة الدفع على السيرفر.</p>
    </div>`;
  appEl.appendChild(panel);

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  const [appMod, authMod, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
  const auth = authMod.getAuth(fbApp);
  const db = fs.getFirestore(fbApp);
  const cfgRef = fs.doc(db, 'config', 'site');
  const keyInput = document.getElementById('nnAppCheckKey');
  const apiInput = document.getElementById('nnApiBase');
  const state = document.getElementById('nnSecurityState');

  const toast = m => {
    const t = document.getElementById('toast');
    if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
  };
  const isOwner = user => !!user && user.emailVerified === true && OWNERS.includes(String(user.email || '').toLowerCase());
  const safeBase = value => {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    try {
      const u = new URL(raw);
      return u.protocol === 'https:' ? u.href.replace(/\/+$/, '') : '';
    } catch (_) { return ''; }
  };
  const setState = () => {
    const key = keyInput.value.trim();
    const api = safeBase(apiInput.value);
    const ready = !!key && !!api;
    state.textContent = ready ? 'Secure Commerce جاهز' : (key || api ? 'الإعدادات ناقصة' : 'غير جاهز');
    state.className = 'pill ' + (ready ? 'ok' : 'wait');
  };

  async function load() {
    try {
      const snap = await fs.getDoc(cfgRef);
      const security = snap.exists() && snap.data().security || {};
      keyInput.value = String(security.appCheckSiteKey || '');
      apiInput.value = String(security.apiBaseUrl || '');
      setState();
    } catch (e) { console.warn(e); }
  }

  keyInput.addEventListener('input', setState);
  apiInput.addEventListener('input', setState);

  tab.addEventListener('click', () => {
    document.querySelectorAll('#app .tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('#app .panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active'); panel.classList.add('active'); load();
  });

  document.getElementById('nnSecuritySave').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!isOwner(user)) return toast('إعدادات الأمان لمالك موثّق فقط');
    const siteKey = keyInput.value.trim().slice(0, 300);
    const rawApi = apiInput.value.trim();
    const apiBaseUrl = safeBase(rawApi);
    if (rawApi && !apiBaseUrl) return toast('API Base لازم يكون HTTPS صالح');
    try {
      const batch = fs.writeBatch(db);
      batch.set(cfgRef, { security: { appCheckSiteKey: siteKey, apiBaseUrl } }, { merge: true });
      batch.set(fs.doc(fs.collection(db, 'auditLogs')), {
        action: 'security.commerce.updated', actor: user.email || '', targetType: 'config', targetId: 'site',
        details: { appCheckConfigured: !!siteKey, apiBaseConfigured: !!apiBaseUrl }, createdAt: fs.serverTimestamp()
      });
      await batch.commit();
      apiInput.value = apiBaseUrl; setState(); toast('اتحفظت إعدادات الأمان ✅');
    } catch (e) { console.warn(e); toast('تعذّر حفظ إعدادات الأمان'); }
  });

  authMod.onAuthStateChanged(auth, user => {
    const owner = isOwner(user);
    tab.style.display = owner ? '' : 'none';
    if (!owner && panel.classList.contains('active')) {
      panel.classList.remove('active');
      const first = document.querySelector('#app .tab');
      first && first.click();
    }
  });
})();
