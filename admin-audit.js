// NewlyNow — immutable admin audit log viewer
(async function () {
  'use strict';
  const tabs = document.querySelector('#app .tabs');
  const appEl = document.getElementById('app');
  if (!tabs || !appEl || document.getElementById('tab-audit-log')) return;

  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.tab = 'audit-log';
  tab.innerHTML = '<i class="fas fa-clock-rotate-left"></i> سجل النشاط';
  tabs.appendChild(tab);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'tab-audit-log';
  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div><h3 style="margin:0"><i class="fas fa-shield-halved"></i> Audit Log</h3><p class="muted">سجل غير قابل للتعديل لعمليات الإدارة الحساسة.</p></div>
        <button class="btn btn-ghost btn-sm" id="nnAuditRefresh"><i class="fas fa-rotate"></i> تحديث</button>
      </div>
      <div id="nnAuditList"><p class="muted">جاري التحميل...</p></div>
    </div>`;
  appEl.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    .nn-audit{display:grid;grid-template-columns:minmax(180px,1.25fr) minmax(150px,1fr) minmax(130px,.8fr);gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
    .nn-audit:last-child{border-bottom:0}.nn-audit strong{display:block;font-size:.9rem}.nn-audit small{display:block;color:var(--muted);font-size:.76rem;overflow-wrap:anywhere}.nn-audit-action{color:var(--yellow)}
    @media(max-width:700px){.nn-audit{grid-template-columns:1fr;gap:4px}}
  `;
  document.head.appendChild(style);

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  const [{ getApps, getApp, initializeApp }, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const fbApp = getApps().length ? getApp() : initializeApp(cfg);
  const db = fs.getFirestore(fbApp);
  const box = document.getElementById('nnAuditList');

  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const labels = {
    'payments.methods.updated':'تعديل وسائل الدفع',
    'payment.manual.approved':'اعتماد دفعة يدوية',
    'payment.manual.rejected':'رفض دفعة يدوية'
  };
  const timeText = v => {
    try {
      const d = v && v.toDate ? v.toDate() : null;
      return d ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(d) : '—';
    } catch (_) { return '—'; }
  };

  function card(a) {
    const details = a.details && typeof a.details === 'object'
      ? Object.entries(a.details).slice(0,5).map(([k,v]) => `${k}: ${String(v == null ? '' : v)}`).join(' · ')
      : '';
    return `<div class="nn-audit">
      <div><strong class="nn-audit-action">${esc(labels[a.action] || a.action || 'عملية')}</strong><small>${esc(details)}</small></div>
      <div><strong>${esc(a.actor || '—')}</strong><small>${esc(a.targetType || '')} · ${esc(a.targetId || '')}</small></div>
      <div><strong>${esc(timeText(a.createdAt))}</strong><small>غير قابل للتعديل</small></div>
    </div>`;
  }

  async function loadAudit() {
    box.innerHTML = '<p class="muted">جاري التحميل...</p>';
    try {
      let snap;
      try { snap = await fs.getDocs(fs.query(fs.collection(db,'auditLogs'), fs.orderBy('createdAt','desc'), fs.limit(100))); }
      catch (_) { snap = await fs.getDocs(fs.collection(db,'auditLogs')); }
      const rows = []; snap.forEach(d => rows.push(d.data()));
      box.innerHTML = rows.length ? rows.map(card).join('') : '<p class="muted">مفيش عمليات حساسة مسجلة لسه.</p>';
    } catch (e) {
      console.warn(e);
      box.innerHTML = '<p class="muted">تعذّر تحميل سجل النشاط.</p>';
    }
  }

  tab.addEventListener('click', () => {
    document.querySelectorAll('#app .tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('#app .panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active'); panel.classList.add('active'); loadAudit();
  });
  document.getElementById('nnAuditRefresh').addEventListener('click', loadAudit);
})();
