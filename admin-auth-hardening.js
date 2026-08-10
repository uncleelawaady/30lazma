// NewlyNow — verified-email hardening for dashboard owners/admins
(async function () {
  'use strict';
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;

  const OWNERS = ['elawaady.official@gmail.com', 'elawadi.store4@gmail.com'];
  const [appMod, authMod, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
  const auth = authMod.getAuth(app);
  const db = fs.getFirestore(app);
  const cfgRef = fs.doc(db, 'config', 'site');
  const $ = id => document.getElementById(id);
  const emailOf = u => String(u && u.email || '').toLowerCase();
  const show = (message, ok=false) => {
    const box = $('gateMsg');
    if (!box) return;
    box.style.display = 'block'; box.style.color = ok ? '#34d399' : '#ff6b6b'; box.textContent = message;
  };
  const toast = m => { const t=$('toast'); if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);} };

  function replaceButton(id, handler) {
    const old = $(id); if (!old) return;
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click', handler);
  }

  // Replace the legacy owner bootstrap handler. Newly created owner accounts must verify email first.
  replaceButton('createOwnerBtn', async () => {
    const email = String($('liEmail') && $('liEmail').value || '').trim().toLowerCase();
    const pass = String($('liPass') && $('liPass').value || '');
    if (!OWNERS.includes(email)) return show('استخدم إيميل المالك المعتمد.');
    if (pass.length < 8) return show('استخدم كلمة سر قوية لا تقل عن 8 أحرف.');
    try {
      const cred = await authMod.createUserWithEmailAndPassword(auth, email, pass);
      await authMod.sendEmailVerification(cred.user);
      await authMod.signOut(auth);
      show('✅ تم إنشاء الحساب وإرسال رابط التحقق. افتح البريد وفعّل الحساب ثم سجّل الدخول.', true);
    } catch (e) {
      if (e && e.code === 'auth/email-already-in-use') show('الحساب موجود بالفعل. سجّل الدخول، ولو غير موثّق افتح رسالة التحقق في بريدك.');
      else show('تعذّر إنشاء حساب المالك: ' + (e && e.message || e));
    }
  });

  // Replace legacy admin creation. The admin is authorized only after verifying the email address.
  replaceButton('createAdminBtn', async () => {
    const owner = auth.currentUser;
    if (!owner || !OWNERS.includes(emailOf(owner)) || !owner.emailVerified) return toast('إنشاء المشرفين متاح لمالك موثّق فقط');
    const email = String($('ad_email') && $('ad_email').value || '').trim().toLowerCase();
    const pass = String($('ad_pass') && $('ad_pass').value || '');
    const msg = $('ad_msg');
    if (!email || pass.length < 8) { if(msg){msg.style.display='block';msg.textContent='اكتب إيميل صحيح وكلمة سر 8 أحرف على الأقل.';} return; }

    let makerApp, makerAuth, user;
    try {
      makerApp = appMod.initializeApp(cfg, 'verifiedAdminMaker-' + Date.now());
      makerAuth = authMod.getAuth(makerApp);
      try {
        const cred = await authMod.createUserWithEmailAndPassword(makerAuth, email, pass);
        user = cred.user;
      } catch (e) {
        if (!e || e.code !== 'auth/email-already-in-use') throw e;
        const cred = await authMod.signInWithEmailAndPassword(makerAuth, email, pass);
        user = cred.user;
      }
      if (!user.emailVerified) await authMod.sendEmailVerification(user);
      await authMod.signOut(makerAuth);

      const batch = fs.writeBatch(db);
      batch.set(cfgRef, { admins: fs.arrayUnion(email) }, { merge: true });
      batch.set(fs.doc(fs.collection(db,'auditLogs')), {
        action:'admin.authorized', actor:owner.email || '', targetType:'admin', targetId:email,
        details:{ emailVerificationRequired:true }, createdAt:fs.serverTimestamp()
      });
      await batch.commit();
      if (msg) { msg.style.display='block'; msg.style.color='#34d399'; msg.textContent='✅ اتضاف المشرف واترسلت له رسالة تحقق. مش هتشتغل صلاحياته قبل تفعيل الإيميل.'; }
      if ($('ad_email')) $('ad_email').value=''; if ($('ad_pass')) $('ad_pass').value='';
      setTimeout(() => location.reload(), 1400);
    } catch (e) {
      console.warn(e);
      if (msg) { msg.style.display='block'; msg.style.color='#ff6b6b'; msg.textContent='تعذّر إنشاء المشرف: ' + (e && e.message || e); }
    } finally {
      if (makerApp) { try { await appMod.deleteApp(makerApp); } catch (_) {} }
    }
  });

  // Never keep an unverified email/password identity active on the admin page.
  authMod.onAuthStateChanged(auth, async user => {
    if (!user || user.emailVerified) return;
    const usesPassword = (user.providerData || []).some(p => p.providerId === 'password');
    if (!usesPassword) return;
    show('لازم تفعّل البريد الإلكتروني من رسالة Firebase قبل دخول لوحة التحكم.');
    try { await authMod.signOut(auth); } catch (_) {}
  });
})();
