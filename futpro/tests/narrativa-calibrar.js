/* Calibración de las referencias de rendimiento del motor narrativo (FP.Narr.BASE). Simula carreras y escribe filas de liga por posición y nivel.
   Uso: node tests/narrativa-calibrar.js [parte] [partes] [carreras] [temporadas]  (resultado en /tmp/narr-cal-<parte>.json) */
var H=require('./harness.js'),FP=H.FP;
var part=+process.argv[2]||0,nparts=+process.argv[3]||1,N=+process.argv[4]||24,seasons=+process.argv[5]||12;
function rng(s){var a=s>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
var snap=H.buildWorld(4242),r=rng(77),profs=H.PROFILES(N,r),out=[];
profs.forEach(function(p,i){ if(i%nparts!==part)return; var S=H.restore(snap);
  if(p.club.kind==='academy'){var cl=S.clubs.filter(function(c){return c.c===p.nat&&FP.LGDEF[c.lg].t<=2;});if(!cl.length)cl=S.clubs.filter(function(c){return FP.LGDEF[c.lg].t<=2;});p.club.id=cl[Math.floor(r()*cl.length)].id;}
  var rec=H.runCareer(p,seasons),h=rec.hero;
  FP.Stats.rows().forEach(function(x){ if(x.k!=='liga'&&x.k!=='juv'&&x.k!=='amat'&&x.k!=='cont'&&x.k!=='copa')return; var cl=x.t<5000&&S.clubs[x.t]?S.clubs[x.t]:null; var lg=cl?FP.LGDEF[cl.lg]:null;
    out.push({pos:h.pos,k:x.k,t:lg?lg.t:null,q:lg?lg.q:null,p:x.p,st:x.st,min:x.min,g:x.g,a:x.a,rs:x.rs,rn:x.rn,n:x.n,s:x.s});});
  console.error('#'+i,p.pos,'ok');
});
require('fs').writeFileSync('/tmp/narr-cal-'+part+'.json',JSON.stringify(out));
