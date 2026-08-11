// NewlyNow — lightweight premium interactions
(function(){
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const q = (s,r=document)=>Array.from(r.querySelectorAll(s));

  document.addEventListener('DOMContentLoaded',()=>{
    const cards=q('.card,.service-card,.product-card,.cat,.glass');
    cards.forEach((el,i)=>{
      el.classList.add('nn-reveal');
      el.style.transitionDelay = reduce ? '0ms' : `${Math.min((i%8)*60,360)}ms`;
      el.addEventListener('pointermove',e=>{
        const r=el.getBoundingClientRect();
        el.style.setProperty('--mx',`${e.clientX-r.left}px`);
        el.style.setProperty('--my',`${e.clientY-r.top}px`);
        if(!coarse && !reduce){
          const rx=((e.clientY-r.top)/r.height-.5)*-4;
          const ry=((e.clientX-r.left)/r.width-.5)*4;
          el.style.transform=`translateY(-7px) perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        }
      });
      el.addEventListener('pointerleave',()=>{ if(!coarse && !reduce) el.style.transform=''; });
    });

    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('is-visible');io.unobserve(x.target);}}),{threshold:.12,rootMargin:'0px 0px -5%'});
      q('section,.nn-reveal').forEach(el=>{if(!el.classList.contains('nn-reveal'))el.classList.add('nn-reveal');io.observe(el);});
    } else q('.nn-reveal').forEach(el=>el.classList.add('is-visible'));

    if(!coarse && !reduce){
      q('.btn,.btn-primary,.btn-grad').forEach(btn=>{
        btn.addEventListener('pointermove',e=>{
          const r=btn.getBoundingClientRect();
          const x=(e.clientX-r.left-r.width/2)*.08;
          const y=(e.clientY-r.top-r.height/2)*.08;
          btn.style.transform=`translate(${Math.max(-5,Math.min(5,x))}px,${Math.max(-5,Math.min(5,y))}px) translateY(-2px)`;
        });
        btn.addEventListener('pointerleave',()=>btn.style.transform='');
      });
    }

    q('.btn,.btn-primary,.btn-grad,button').forEach(btn=>btn.addEventListener('click',e=>{
      if(reduce) return;
      const r=btn.getBoundingClientRect(),d=document.createElement('span');
      const size=Math.max(r.width,r.height)*1.4;
      d.style.cssText=`position:absolute;pointer-events:none;width:${size}px;height:${size}px;border-radius:50%;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px;background:rgba(255,141,183,.28);transform:scale(0);animation:nnRipple .55s ease-out forwards;z-index:0`;
      btn.appendChild(d);setTimeout(()=>d.remove(),650);
    }));
    if(!document.getElementById('nn-ripple-style')){
      const s=document.createElement('style');s.id='nn-ripple-style';s.textContent='@keyframes nnRipple{to{transform:scale(1);opacity:0}}';document.head.appendChild(s);
    }
  },{once:true});
})();
