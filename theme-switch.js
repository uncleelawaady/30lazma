// NewlyNow — A/B theme switcher (preview: pick one, we lock it later)
(function(){
  var saved = localStorage.getItem('nnTheme') || 'a';
  function apply(t){ document.body.classList.toggle('theme-b', t==='b'); }
  // apply ASAP
  if(document.body) apply(saved);
  else document.addEventListener('DOMContentLoaded', function(){ apply(saved); });
  document.addEventListener('DOMContentLoaded', function(){
    apply(localStorage.getItem('nnTheme')||'a');
    if(document.getElementById('themeSwitch')) return;
    var box=document.createElement('div'); box.id='themeSwitch';
    box.innerHTML='<button data-t="a">فاتح</button><button data-t="b">غامق</button>';
    document.body.appendChild(box);
    function sync(){ var t=localStorage.getItem('nnTheme')||'a';
      box.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.t===t); }); }
    box.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return;
      localStorage.setItem('nnTheme', b.dataset.t); apply(b.dataset.t); sync(); });
    sync();
  });
})();
