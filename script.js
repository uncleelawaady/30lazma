// NewlyNow — core storefront interactions
(function(){
  'use strict';
  if(window.__NEWLYNOW_CORE_SCRIPT__) return;
  window.__NEWLYNOW_CORE_SCRIPT__=true;

  // Proofs lightbox (only when present)
  const items=[...document.querySelectorAll('.proof-item')];
  const lb=document.getElementById('lightbox');
  if(items.length&&lb){
    const lbImg=document.getElementById('lbImg');
    const srcs=items.map(b=>b.dataset.src).filter(Boolean);
    let idx=0;
    const show=i=>{if(!srcs.length)return;idx=(i+srcs.length)%srcs.length;lbImg.src=srcs[idx];};
    const open=i=>{show(i);lb.classList.add('open');lb.setAttribute('aria-hidden','false');document.body.classList.add('lb-open');};
    const close=()=>{lb.classList.remove('open');lb.setAttribute('aria-hidden','true');document.body.classList.remove('lb-open');};
    items.forEach((b,i)=>b.addEventListener('click',()=>open(i)));
    document.getElementById('lbClose')?.addEventListener('click',close);
    document.getElementById('lbNext')?.addEventListener('click',()=>show(idx+1));
    document.getElementById('lbPrev')?.addEventListener('click',()=>show(idx-1));
    lb.addEventListener('click',e=>{if(e.target===lb)close();});
    document.addEventListener('keydown',e=>{
      if(!lb.classList.contains('open'))return;
      if(e.key==='Escape')close();
      if(e.key==='ArrowLeft')show(idx+1);
      if(e.key==='ArrowRight')show(idx-1);
    });
  }

  // Mobile navigation
  const navToggle=document.getElementById('navToggle');
  const navLinks=document.getElementById('navLinks');
  if(navToggle&&navLinks){
    navToggle.addEventListener('click',()=>{
      const open=navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded',String(open));
    });
    navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      navLinks.classList.remove('open');navToggle.setAttribute('aria-expanded','false');
    }));
  }

  // Smooth in-page navigation, with reduced-motion respect.
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',function(e){
      const href=this.getAttribute('href');
      if(!href||href==='#')return;
      const t=document.querySelector(href);
      if(t){e.preventDefault();t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});}
    });
  });

  // Search categories/services with a useful no-results state instead of an automatic popup.
  const searchInput=document.getElementById('searchInput');
  const searchBtn=document.getElementById('searchBtn');
  let emptyState=null;
  function ensureEmptyState(){
    if(emptyState)return emptyState;
    const host=document.querySelector('.search-bar')?.parentElement||document.querySelector('.hero-inner');
    if(!host)return null;
    emptyState=document.createElement('div');
    emptyState.className='nn-search-empty glass';
    emptyState.hidden=true;
    emptyState.setAttribute('role','status');
    emptyState.innerHTML='<i class="fas fa-magnifying-glass-minus" aria-hidden="true"></i><div><strong>الخدمة مش ظاهرة في النتائج</strong><span>ابعت اسم الخدمة لفريق NewlyNow ونساعدك نوصل لها.</span></div><a class="btn btn-grad btn-sm" target="_blank" rel="noopener noreferrer">اطلب البحث عن الخدمة</a>';
    host.appendChild(emptyState);
    return emptyState;
  }
  function resetCards(){
    document.querySelectorAll('.cat').forEach(c=>{c.style.opacity='';c.style.filter='';c.removeAttribute('aria-hidden');});
    if(emptyState)emptyState.hidden=true;
  }
  function runSearch(){
    if(!searchInput)return;
    const raw=(searchInput.value||'').trim();
    const q=raw.toLowerCase();
    if(!q){resetCards();document.getElementById('categories')?.scrollIntoView({behavior:reduce?'auto':'smooth'});return;}
    const cats=[...document.querySelectorAll('.cat')];
    let firstMatch=null,matchCount=0;
    cats.forEach(c=>{
      const hit=(c.textContent||'').toLowerCase().includes(q);
      c.style.opacity=hit?'1':'.18';
      c.style.filter=hit?'none':'grayscale(.75)';
      c.setAttribute('aria-hidden',hit?'false':'true');
      if(hit){matchCount++;if(!firstMatch)firstMatch=c;}
    });
    const state=ensureEmptyState();
    if(firstMatch){if(state)state.hidden=true;firstMatch.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});}
    else if(state){
      const a=state.querySelector('a');
      a.href='https://wa.me/201055578777?text='+encodeURIComponent('مرحبًا NewlyNow، أبحث عن خدمة: '+raw);
      state.hidden=false;
      state.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
    }
    searchInput.setAttribute('aria-label',matchCount?`تم العثور على ${matchCount} نتيجة`:'لم يتم العثور على نتائج');
  }
  searchBtn?.addEventListener('click',runSearch);
  searchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch();}});
  searchInput?.addEventListener('input',()=>{if(!searchInput.value.trim())resetCards();});

  // Active navigation state
  const sections=[...document.querySelectorAll('section[id], header[id]')];
  const anchors=[...document.querySelectorAll('.nav-links a[href^="#"]')];
  let ticking=false;
  function updateActive(){
    ticking=false;let cur='';
    sections.forEach(s=>{if(window.scrollY>=s.offsetTop-130)cur=s.id;});
    anchors.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+cur));
  }
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateActive);}},{passive:true});
  updateActive();
})();
