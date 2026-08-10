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
      <h3><i class="fas fa-shield-halved"></i> Firebase App Check</h3>
      <p class="muted" style="margin-bottom:14px">مفتاح reCAPTCHA Enterprise Site Key عام وآمن للظهور في الواجهة. مفاتيح البوابات وSecrets ممنوع تخزينها هنا.</p>
      <div class="field">
        <label>reCAPTCHA Enterprise Site Key</label>
        <input type="text" id="nnAppCheckKey" autocomplete="off" placeholder="6Lc..." maxlength="300">
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <button class="btn" id="nnSecuritySave"><i class="fas fa-floppy-disk"></i> حفظ إعدادات الأمان</button>
        <span class="pill wait" id="nnSecurityState">غير مضبوط</span>
      </div>
      <p class="hint" style="margin-top:12px">بعد تسجيل newlynow.com في Firebase App Check ووضع الـSite Key هنا، طلبات الدفع التلقائي سترسل App Check Token للـBackend.</p>
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
  const state = document.getElementById('nnSecurityState');

  const toast = m => {
    const t = document.getElementById('toast');
    if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
  };
  const isOwner = user => !!user && OWNERS.includes(String(user.email || '').toLowerCase());
  const setState = key => {
    state.textContent = key ? 'App Check مضبوط' : 'غير مضبوط';
    state.className = 'pill ' + (key ? 'ok' : 'wait');
  };

  async function load() {
    try {
      const snap = await fs.getDoc(cfgRef);
      const security = snap.exists() && snap.data().security || {};
      keyInput.value = String(security.appCheckSiteKey || '');
      setState(keyInput.value.trim());
    } catch (e) { console.warn(e); }
  }

  tab.addEventListener('click', () => {
    document.querySelectorAll('#app .tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('#app .panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active'); panel.classList.add('active'); load();
  });

  document.getElementById('nnSecuritySave').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!isOwner(user)) return toast('إعدادات الأمان للمالك فقط');
    const siteKey = keyInput.value.trim().slice(0, 300);
    try {
      const batch = fs.writeBatch(db);
      batch.set(cfgRef, { security: { appCheckSiteKey: siteKey } }, { merge: true });
      batch.set(fs.doc(fs.collection(db, 'auditLogs')), {
        action: 'security.appcheck.updated', actor: user.email || '', targetType: 'config', targetId: 'site',
        details: { configured: !!siteKey }, createdAt: fs.serverTimestamp()
      });
      await batch.commit();
      setState(siteKey); toast('اتحفظت إعدادات الأمان ✅');
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
