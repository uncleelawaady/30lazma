(()=>{
  'use strict';
  if(window.__NEWLYNOW_LINK_SAFETY__) return;
  window.__NEWLYNOW_LINK_SAFETY__=true;
  const allowed=new Set(['http:','https:','mailto:','tel:']);
  function safe(a){
    if(!(a instanceof HTMLAnchorElement)) return;
    const raw=(a.getAttribute('href')||'').trim();
    if(!raw||raw.startsWith('#')) return;
    try{
      const u=new URL(raw,location.href);
      if(!allowed.has(u.protocol)){
        a.removeAttribute('href');
        a.setAttribute('aria-disabled','true');
        a.dataset.unsafeHref='1';
        return;
      }
    }catch(_){a.removeAttribute('href');a.setAttribute('aria-disabled','true');return;}
    if(a.target==='_blank'){
      const rel=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
      rel.add('noopener');rel.add('noreferrer');a.setAttribute('rel',[...rel].join(' '));
    }
  }
  const scan=root=>{
    if(root instanceof HTMLAnchorElement) safe(root);
    root.querySelectorAll?.('a[href]').forEach(safe);
  };
  const start=()=>{
    scan(document);
    const mo=new MutationObserver(ms=>ms.forEach(m=>{
      if(m.type==='attributes') safe(m.target);
      m.addedNodes.forEach(n=>{if(n.nodeType===Node.ELEMENT_NODE)scan(n);});
    }));
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href','target']});
    document.addEventListener('click',e=>{
      const a=e.target.closest?.('a');
      if(a?.dataset.unsafeHref==='1'){e.preventDefault();window.nnToast?.('الرابط غير مسموح لأسباب أمنية','fa-shield-halved');}
    },true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
