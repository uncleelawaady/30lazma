// NewlyNow — order + payment foundation
(function () {
  'use strict';

  const MAX_ITEMS = 50;
  const MAX_QTY = 100000;
  let dbPromise = null;

  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const qty = v => Math.max(1, Math.min(MAX_QTY, Number.parseInt(v, 10) || 1));
  const MANUAL_DEFAULTS = [
    { id:'vodafone-cash-1', name:'Vodafone Cash', type:'manual', enabled:true, icon:'fa-mobile-screen-button', account:'01008002333', instructions:'حوّل المبلغ على الرقم ثم اكتب رقم العملية أو أرسل صورة الإيصال عند متابعة الطلب.' },
    { id:'vodafone-cash-2', name:'Vodafone Cash — رقم إضافي', type:'manual', enabled:true, icon:'fa-mobile-screen-button', account:'01040898404', instructions:'حوّل المبلغ على الرقم ثم اكتب رقم العملية أو أرسل صورة الإيصال عند متابعة الطلب.' },
    { id:'instapay', name:'InstaPay', type:'manual', enabled:true, icon:'fa-building-columns', account:'elawaady5@instapay', instructions:'حوّل المبلغ إلى عنوان InstaPay ثم اكتب رقم العملية للمراجعة.' },
    { id:'usdt-trc20', name:'USDT (TRC20)', type:'manual', enabled:true, icon:'fa-coins', account:'TLhuL7PAYrdB93Vo66r17d4fM9epucxLfc', instructions:'الشبكة: TRC20 فقط. تأكد من الشبكة والعنوان قبل التحويل، ولا ترسل NFT أو أصولًا مختلفة إلى هذا العنوان.' },
    { id:'bank-transfer', name:'تحويل بنكي', type:'manual', enabled:true, icon:'fa-building-columns', account:'IBAN: EG220002020602060333000068335', instructions:'حوّل على رقم الـIBAN الموضح، ويفضل كتابة رقم الطلب في وصف التحويل إن كان البنك يسمح بذلك.' },
    { id:'fawry-code', name:'فوري (كود دفع)', type:'manual', enabled:true, icon:'fa-receipt', account:'يتم إرسال كود الدفع بعد مراجعة الطلب', instructions:'لا تدفع لأي كود غير صادر من القناة الرسمية الخاصة بطلبك.' }
  ];

  function safeHttpsUrl(value) {
    try { const u = new URL(String(value || ''), location.origin); return u.protocol === 'https:' ? u.href : ''; }
    catch (_) { return ''; }
  }

  function securityConfig() {
    const site = window.SITE_CONFIG || {};
    const live = site.security || {};
    const fallback = window.NEWLYNOW_SECURITY_CONFIG || {};
    const appCheckSiteKey = clean(live.appCheckSiteKey || fallback.appCheckSiteKey, 300);
    const rawBase = clean(live.apiBaseUrl || fallback.apiBaseUrl, 500);
    const apiBaseUrl = safeHttpsUrl(rawBase).replace(/\/+$/, '');
    const secureCommerceOnly = live.secureCommerceOnly === true || fallback.secureCommerceOnly === true;
    return { appCheckSiteKey, apiBaseUrl, secureCommerceOnly, secureApiReady: !!appCheckSiteKey && !!apiBaseUrl };
  }

  async function appCheckToken() {
    const appCheck = window.NewlyNowAppCheck;
    if (!appCheck || !appCheck.configured()) throw new Error('APP_CHECK_NOT_CONFIGURED');
    const token = await appCheck.getToken(false);
    if (!token) throw new Error('APP_CHECK_TOKEN_FAILED');
    return token;
  }

  async function securePost(route, payload) {
    const security = securityConfig();
    if (!security.secureApiReady) throw new Error('SECURE_COMMERCE_NOT_CONFIGURED');
    const token = await appCheckToken();
    const response = await fetch(security.apiBaseUrl + '/' + String(route || '').replace(/^\/+/, ''), {
      method:'POST', headers:{'Content-Type':'application/json','X-Firebase-AppCheck':token}, credentials:'omit', cache:'no-store',
      referrerPolicy:'strict-origin-when-cross-origin', body:JSON.stringify(payload || {})
    });
    let data={}; try { data=await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data && data.error || ('SECURE_API_HTTP_' + response.status));
    return data || {};
  }

  function orderNumber() {
    const d=new Date();
    const stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');
    const bytes=new Uint8Array(4); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes); else for(let i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256);
    return 'NN-'+stamp+'-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  function normalizeItems(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('EMPTY_CART');
    const normalized=items.slice(0,MAX_ITEMS).map(it=>({name:clean(it&&it.name,180),category:clean(it&&it.category,140),qty:qty(it&&it.qty),link:clean(it&&it.link,2000),notes:clean(it&&it.notes,1500),coupon:clean(it&&it.coupon,120),code:clean(it&&it.code,120)})).filter(it=>it.name);
    if (!normalized.length) throw new Error('EMPTY_CART'); return normalized;
  }

  async function firestore() {
    if (dbPromise) return dbPromise;
    dbPromise=(async()=>{ const cfg=window.FIREBASE_CONFIG; if(!cfg||!cfg.apiKey)return null; const [{initializeApp},fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')]); const app=initializeApp(cfg,'newlynowCommerceApp'); return {db:fs.getFirestore(app),fs}; })().catch(err=>{console.warn('NewlyNow commerce database unavailable',err);return null;});
    return dbPromise;
  }

  async function createOrder(input) {
    const items=normalizeItems(input&&input.items), name=clean(input&&input.name,120), phone=clean(input&&input.phone,40), notes=clean(input&&input.notes,3000);
    if(!name||phone.length<4) throw new Error('INVALID_CUSTOMER');
    const security=securityConfig();
    if(security.secureApiReady){ const data=await securePost('createOrder',{name,phone,notes,items}); const id=clean(data.id,128),orderNo=clean(data.orderNo,64); if(!id||!orderNo||data.persisted!==true)throw new Error('INVALID_SECURE_ORDER_RESPONSE'); return {id,orderNo,persisted:true,secure:true,payload:{name,phone,notes,items}}; }
    if(security.secureCommerceOnly) throw new Error('SECURE_COMMERCE_REQUIRED');
    const orderNo=orderNumber();
    const payloadBase={orderNo,name,phone,notes,items,count:items.reduce((s,it)=>s+it.qty,0),status:'new',paymentStatus:'unpaid',paymentMethod:'',paymentAttemptId:'',source:'store'};
    const conn=await firestore(); if(!conn)return{id:'',orderNo,persisted:false,secure:false,payload:payloadBase};
    const {db,fs}=conn; let ref=null;
    try{ref=await fs.addDoc(fs.collection(db,'orders'),Object.assign({},payloadBase,{createdAt:fs.serverTimestamp()}));}catch(err){console.warn('Order persistence failed',err);return{id:'',orderNo,persisted:false,secure:false,payload:payloadBase};}
    try{await fs.addDoc(fs.collection(db,'customers'),{name,phone,source:'order',createdAt:fs.serverTimestamp()});}catch(_){}
    return{id:ref.id,orderNo,persisted:true,secure:false,payload:payloadBase};
  }

  function paymentMethods() {
    const site=window.SITE_CONFIG||{}, payments=site.payments||{}, security=securityConfig();
    const configured=Array.isArray(payments.methods)?payments.methods:[];
    const list=configured.length?configured:MANUAL_DEFAULTS;
    return list.map((m,i)=>({id:clean(m&&(m.id||('method-'+i)),80),name:clean(m&&m.name,120),type:m&&m.type==='automatic'?'automatic':'manual',enabled:!(m&&m.enabled===false),icon:clean(m&&m.icon,80),instructions:clean(m&&m.instructions,2000),account:clean(m&&m.account,240),endpoint:clean(m&&m.endpoint,2000)})).filter(m=>{
      if(!m.enabled||!m.id||!m.name)return false;
      if(m.type==='automatic'){const legacyEndpointReady=!!safeHttpsUrl(m.endpoint);return !!security.appCheckSiteKey&&(security.secureApiReady||legacyEndpointReady);} return true;
    });
  }

  async function createPaymentAttempt(order,method,extra) {
    if(!order||!order.persisted||!order.id)return{id:'',persisted:false}; if(!method||!method.id)throw new Error('INVALID_PAYMENT_METHOD');
    const reference=clean(extra&&extra.reference,160),security=securityConfig();
    if(security.secureApiReady){const data=await securePost('createPaymentAttempt',{orderId:clean(order.id,128),orderNo:clean(order.orderNo,48),methodId:clean(method.id,80),reference});const id=clean(data.id,128);if(!id||data.persisted!==true)throw new Error('INVALID_SECURE_PAYMENT_ATTEMPT_RESPONSE');return{id,persisted:true,secure:true,status:clean(data.status,40),type:clean(data.type,20),reused:!!data.reused};}
    if(security.secureCommerceOnly)throw new Error('SECURE_COMMERCE_REQUIRED');
    const type=method.type==='automatic'?'automatic':'manual',status=type==='automatic'?'initiated':'pending_verification',conn=await firestore(); if(!conn)return{id:'',persisted:false};
    const {db,fs}=conn; const ref=await fs.addDoc(fs.collection(db,'paymentAttempts'),{orderId:clean(order.id,128),orderNo:clean(order.orderNo,48),methodId:clean(method.id,80),methodName:clean(method.name,120),type,status,reference,createdAt:fs.serverTimestamp()}); return{id:ref.id,persisted:true,secure:false,status,type};
  }

  async function startAutomaticPayment(order,method,attempt) {
    if(!order||!order.persisted||!attempt||!attempt.persisted)throw new Error('ORDER_NOT_PERSISTED'); const security=securityConfig();
    const endpoint=security.secureApiReady?security.apiBaseUrl+'/initPayment':safeHttpsUrl(method&&method.endpoint); if(!endpoint)throw new Error('PAYMENT_ENDPOINT_NOT_CONFIGURED');
    const token=await appCheckToken(); const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Firebase-AppCheck':token},credentials:'omit',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin',body:JSON.stringify({orderId:order.id,orderNo:order.orderNo,paymentAttemptId:attempt.id,methodId:method.id})});
    let data={};try{data=await response.json();}catch(_){} if(!response.ok)throw new Error(data&&data.error||'PAYMENT_INIT_FAILED'); const checkoutUrl=safeHttpsUrl(data&&data.checkoutUrl);if(!checkoutUrl)throw new Error('INVALID_CHECKOUT_URL');return checkoutUrl;
  }

  function buildOrderText(input) {
    const items=normalizeItems(input&&input.items),method=input&&input.method;let t='مرحبًا فريق NewlyNow 👋\nأريد متابعة الطلب التالي:\n\n';t+='رقم الطلب: '+clean(input&&input.orderNo,48)+'\n';t+='الاسم: '+clean(input&&input.name,120)+'\n';t+='الواتساب: '+clean(input&&input.phone,40)+'\n';if(method&&method.name)t+='طريقة الدفع: '+clean(method.name,120)+'\n';t+='\nالخدمات:\n';items.forEach((it,i)=>{t+=(i+1)+') '+it.name+' ×'+it.qty+(it.category?' — '+it.category:'')+'\n';if(it.link)t+='   🔗 '+it.link+'\n';if(it.coupon)t+='   🎟️ '+it.coupon+'\n';if(it.notes)t+='   📝 '+it.notes+'\n';});const notes=clean(input&&input.notes,3000);if(notes)t+='\nملاحظات الطلب: '+notes+'\n';return t;
  }

  window.NewlyNowCommerce={createOrder,getPaymentMethods:paymentMethods,createPaymentAttempt,startAutomaticPayment,buildOrderText,getSecurityState:securityConfig};
})();
