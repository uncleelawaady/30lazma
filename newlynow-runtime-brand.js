(()=>{
  'use strict';
  const BRAND='NewlyNow';
  const DOMAIN='NewlyNow.com';
  const DEFAULT_TITLE='NewlyNow — منصة الخدمات الرقمية';
  const DEFAULT_DESC='NewlyNow — منصة عربية حديثة للخدمات والمنتجات الرقمية، بتجربة شراء منظمة وآمنة وسريعة.';
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
  const ogTitle=ensureMeta('meta[property="og:title"]',{property:'og:title'});ogTitle.content=document.title;
  const ogDesc=ensureMeta('meta[property="og:description"]',{property:'og:description'});ogDesc.content=desc.content;
  const ogType=ensureMeta('meta[property="og:type"]',{property:'og:type'});ogType.content='website';
  const twitter=ensureMeta('meta[name="twitter:card"]',{name:'twitter:card'});twitter.content='summary_large_image';

  const apply=()=>{
    document.querySelectorAll('.brand-name').forEach(el=>{el.innerHTML='NewlyNow<em>.com</em>';});
    document.querySelectorAll('img[alt*="Elwaset" i],img[alt*="Elawaady" i]').forEach(img=>img.alt='NewlyNow');
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return /Elwaset|Elawaady\s*XDigital/i.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{node.nodeValue=replaceLegacy(node.nodeValue);});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  const observer=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length))apply();});
  document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
})();
