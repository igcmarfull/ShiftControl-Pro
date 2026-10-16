(function(){
  'use strict';
  /* iPad: la barra lateral compacta se abre al tocar la marca y se cierra al elegir una vista o tocar fuera. */
  var mq=window.matchMedia?window.matchMedia('(min-width:821px) and (max-width:1400px) and (pointer:coarse)'):null;
  function close(){document.body.classList.remove('tab-nav-open')}
  function init(){
    var brand=document.querySelector('.sidebar .brand');
    if(!brand)return;
    brand.id='tabNavToggle';
    brand.addEventListener('click',function(){if(mq&&mq.matches)document.body.classList.toggle('tab-nav-open')});
    document.addEventListener('click',function(e){
      if(!document.body.classList.contains('tab-nav-open'))return;
      var sb=document.querySelector('.sidebar');
      if(e.target.closest&&e.target.closest('.nav-btn'))return close();
      if(sb&&!sb.contains(e.target))close();
    },true);
    if(mq&&mq.addEventListener)mq.addEventListener('change',close);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
