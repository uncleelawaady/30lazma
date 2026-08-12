(()=>{
  'use strict';
  if(window.__NEWLYNOW_INNER_POLISH__) return;
  window.__NEWLYNOW_INNER_POLISH__=true;
  const polish=()=>{
    if(/Elwaset|Elawaady\s*XDigital|\bEXD\b/i.test(document.title)){
      document.title=document.title.replace(/Elwaset\.net/gi,'NewlyNow.com').replace(/\bElwaset\b/gi,'NewlyNow').replace(/Elawaady\s*XDigital/gi,'NewlyNow').replace(/\bEXD\b/gi,'NewlyNow');
    }
    const code=document.getElementById('svcCode');
    if(code&&/\bEL-/i.test(code.textContent||'')){
      code.innerHTML=code.innerHTML.replace(/\bEL-/gi,'NN-');
    }
    document.querySelectorAll('.foot-bottom').forEach(el=>{
      if(/Elwaset|Elawaady\s*XDigital|\bEXD\b/i.test(el.textContent||'')) el.textContent='© 2026 NewlyNow.com — جميع الحقوق محفوظة';
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',polish,{once:true});else polish();
  document.addEventListener('catalogready',polish);
  document.addEventListener('siteconfig',()=>setTimeout(polish,0));
  const mo=new MutationObserver(()=>polish());
  document.addEventListener('DOMContentLoaded',()=>{
    const roots=[document.getElementById('svcCode'),document.querySelector('.footer')].filter(Boolean);
    roots.forEach(r=>mo.observe(r,{subtree:true,childList:true,characterData:true}));
  },{once:true});
})();
