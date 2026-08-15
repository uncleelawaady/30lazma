// NewlyNow — fill product grids from the Drive image pool (placeholders; owner will refine)
(function(){
  fetch('assets/store/manifest.json').then(function(r){return r.json();}).then(function(m){
    var pool=(m&&m.pool)||[]; if(!pool.length) return;
    var grid=document.getElementById('nnProducts');
    if(grid){ grid.innerHTML=pool.map(function(f){
      return '<a class="nn-prod" href="https://wa.me/201055578777" target="_blank" rel="noopener">'+
             '<img src="assets/store/'+f+'" loading="lazy" alt="خدمة NewlyNow"></a>'; }).join(''); }
  }).catch(function(){});
})();
