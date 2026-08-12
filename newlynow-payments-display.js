(()=>{
  'use strict';
  if(window.__NEWLYNOW_PAYMENT_DISPLAY__) return;
  window.__NEWLYNOW_PAYMENT_DISPLAY__=true;

  const iconFor=(name,type)=>{
    const n=String(name||'').toLowerCase();
    if(/visa|master|card|بطاق/.test(n)) return 'fa-credit-card';
    if(/insta|bank|بن/.test(n)) return 'fa-building-columns';
    if(/wallet|cash|محفظ|فودافون|orange|etisalat|we/.test(n)) return 'fa-wallet';
    if(/fawry|فوري/.test(n)) return 'fa-receipt';
    if(type==='automatic') return 'fa-bolt';
    return 'fa-money-check-dollar';
  };

  function render(){
    const host=document.querySelector('#payments .pay-strip');
    if(!host) return;
    const cfg=window.SITE_CONFIG||{};
    const methods=Array.isArray(cfg?.payments?.methods)?cfg.payments.methods.filter(m=>m&&m.enabled!==false):[];
    host.innerHTML='';
    host.classList.add('nn-live-payments');
    if(!methods.length){
      const empty=document.createElement('div');
      empty.className='nn-payments-empty';
      empty.innerHTML='<i class="fas fa-shield-halved" aria-hidden="true"></i><div><strong>وسائل الدفع تظهر حسب الطلب</strong><span>اختر خدمتك أولًا، وستظهر لك الطرق المتاحة أثناء إتمام الطلب.</span></div>';
      host.appendChild(empty);return;
    }
    const grid=document.createElement('div');grid.className='nn-payment-badges';
    methods.slice(0,12).forEach(m=>{
      const item=document.createElement('div');item.className='nn-payment-badge';
      const i=document.createElement('i');i.className='fas '+iconFor(m.name,m.type);i.setAttribute('aria-hidden','true');
      const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=String(m.name||'طريقة دفع');
      const small=document.createElement('small');small.textContent=m.type==='automatic'?'دفع تلقائي':'دفع يدوي';
      text.append(strong,small);item.append(i,text);grid.appendChild(item);
    });
    host.appendChild(grid);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
  document.addEventListener('siteconfig',()=>setTimeout(render,0));
})();
