(()=>{
  'use strict';
  if(window.__NEWLYNOW_BRAND_RUNTIME__) return;
  window.__NEWLYNOW_BRAND_RUNTIME__=true;
  const BRAND='NewlyNow', DOMAIN='NewlyNow.com';
  const DEFAULT_TITLE='NewlyNow — منصة الخدمات الرقمية';
  const DEFAULT_DESC='NewlyNow — منصة عربية حديثة للخدمات والمنتجات الرقمية، بتجربة شراء منظمة وآمنة وسريعة.';
  const legacyRe=/Elwaset|Elawaady\s*XDigital|EXD\s*\|\s*Elawaady\s*XDigital/i;
  const replaceLegacy=(value)=>String(value||'')
    .replace(/EXD\s*\|\s*Elawaady\s*XDigital/gi,BRAND)
    .replace(/Elawaady\s*XDigital/gi,BRAND)
    .replace(/Elwaset\.net/gi,DOMAIN)
    .replace(/\bElwaset\b/gi,BRAND);

  const ensureMeta=(selector,attrs)=>{
    let el=document.head.querySelector(selector);
    if(!el){el=document.createElement('meta');Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));document.head.appendChild(el);}
    return el;
  };

  document.title=replaceLegacy(document.title||DEFAULT_TITLE);
  if(!/NewlyNow/i.test(document.title)) document.title=DEFAULT_TITLE;
  const desc=ensureMeta('meta[name="description"]',{name:'description'});
  desc.setAttribute('content',replaceLegacy(desc.getAttribute('content')||DEFAULT_DESC));
  if(!/NewlyNow/i.test(desc.content)) desc.content=DEFAULT_DESC;
  ensureMeta('meta[property="og:title"]',{property:'og:title'}).content=document.title;
  ensureMeta('meta[property="og:description"]',{property:'og:description'}).content=desc.content;
  ensureMeta('meta[property="og:type"]',{property:'og:type'}).content='website';
  ensureMeta('meta[name="twitter:card"]',{name:'twitter:card'}).content='summary_large_image';

  const brandElement=(root)=>{
    if(!(root instanceof Element||root instanceof Document))return;
    if(root.matches?.('.brand-name')) root.innerHTML='NewlyNow<em>.com</em>';
    root.querySelectorAll?.('.brand-name').forEach(el=>{el.innerHTML='NewlyNow<em>.com</em>';});
    if(root.matches?.('img[alt*="Elwaset" i],img[alt*="Elawaady" i]')) root.alt='NewlyNow';
    root.querySelectorAll?.('img[alt*="Elwaset" i],img[alt*="Elawaady" i]').forEach(img=>img.alt='NewlyNow');
  };

  const brandText=(root)=>{
    if(!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION','CODE','PRE'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return legacyRe.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{node.nodeValue=replaceLegacy(node.nodeValue);});
  };

  const applyRoot=(root)=>{brandElement(root);brandText(root);};
  const start=()=>{
    applyRoot(document.body);
    const observer=new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes.forEach(node=>{
        if(node.nodeType===Node.TEXT_NODE){if(legacyRe.test(node.nodeValue||''))node.nodeValue=replaceLegacy(node.nodeValue);return;}
        if(node.nodeType===Node.ELEMENT_NODE)applyRoot(node);
      }));
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
