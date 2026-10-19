// Pruebas del cálculo de comisiones. Sin dependencias: node src/modules/fuel/fuel-calc.test.js
const assert=require('assert');
const C=require('./fuel-calc.js');
const k=C.DEFAULT_CONTRACT;
let n=0;
const ok=(name,fn)=>{fn();n++;console.log('PASS',name)};
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<0.01,`${msg||''} ${a} ≠ ${b}`);

ok('sin litros: solo el fijo del primer tramo',()=>near(C.retailCommission(k,0),5000000));
ok('300 m³: 5.000.000 + 19,9 por litro',()=>near(C.retailCommission(k,300000),10970000));
ok('400 m³',()=>near(C.retailCommission(k,400000),12960000));
ok('en el pivote exacto sigue el primer tramo',()=>near(C.retailCommission(k,450000),13955000));
ok('un litro sobre el pivote: fijo mayor + 35',()=>near(C.retailCommission(k,450001),13956035));
ok('462.700 L: 13.956.000 + 35 por los 12.700 que pasan',()=>near(C.retailCommission(k,462700),14400500));
ok('500 m³',()=>near(C.retailCommission(k,500000),15706000));
ok('600 m³',()=>near(C.retailCommission(k,600000),19206000));
ok('los dos tramos empalman en el pivote (diferencia de $1.000)',()=>near(13956000-C.retailCommission(k,450000),1000));
ok('la comisión nunca baja al sumar litros',()=>{let prev=-1;for(let v=0;v<=700000;v+=2500){const c=C.retailCommission(k,v);assert.ok(c>=prev);prev=c}});
ok('litros negativos o vacíos cuentan como cero',()=>{near(C.retailCommission(k,-50),5000000);near(C.retailCommission(k,null),5000000)});

ok('flota y kerosene van aparte del pivote',()=>{
  const c=C.commission(k,{retail:300000,flota:50000,kerosene:2000});
  near(c.retail,10970000);near(c.flota,250000,'flota 50.000 L × $5');near(c.kerosene,60000,'kerosene 2.000 L × $30');
  near(c.net,11280000);near(c.iva,2143200);near(c.gross,13423200);
});
ok('la flota no mueve el pivote: mucha flota, retail bajo',()=>{
  const c=C.commission(k,{retail:100000,flota:600000,kerosene:0});
  near(c.retail,5000000+19.9*100000);near(c.flota,3000000);
});

const rows=[];
for(let d=1;d<=19;d++)rows.push({sold_on:`2026-10-${String(d).padStart(2,'0')}`,retail_l:14000,flota_l:2000,kerosene_l:50});
ok('resumen de octubre a mitad de mes',()=>{
  const s=C.monthSummary(k,rows,{year:2026,month:10,today:'2026-10-20'});
  assert.strictEqual(s.dim,31);assert.strictEqual(s.loaded,19);assert.strictEqual(s.last,19);assert.deepStrictEqual(s.missing,[]);
  near(s.totals.retail,266000);near(s.totals.flota,38000);near(s.totals.kerosene,950);
  assert.strictEqual(s.inContract,true);assert.strictEqual(s.ended,false);assert.strictEqual(s.tramo,'low');
  near(s.projected.retail,266000*31/19);near(s.pct,266000/450000);near(s.toPivot,184000);
  assert.strictEqual(s.remainingDays,12);near(s.neededPerDay,184000/12);near(s.marginalRate,19.9);
  near(s.rateGain,35/19.9-1);
  near(s.now.retail,5000000+19.9*266000);
  near(s.close.retail,C.retailCommission(k,266000*31/19));
});
ok('detecta días sin cargar entre el 1 y el último',()=>{
  const r=rows.filter(x=>x.sold_on!=='2026-10-05'&&x.sold_on!=='2026-10-06');
  const s=C.monthSummary(k,r,{year:2026,month:10,today:'2026-10-20'});
  assert.deepStrictEqual(s.missing,[5,6]);assert.strictEqual(s.loaded,17);
  near(s.projected.retail,s.totals.retail/17*31);
});
ok('un mes ya terminado no se proyecta',()=>{
  const full=[];for(let d=1;d<=30;d++)full.push({sold_on:`2026-09-${String(d).padStart(2,'0')}`,retail_l:16000,flota_l:0,kerosene_l:0});
  const s=C.monthSummary(k,full,{year:2026,month:9,today:'2026-10-02'});
  assert.strictEqual(s.ended,true);near(s.projected.retail,480000);assert.strictEqual(s.tramo,'high');
  near(s.close.retail,13956000+35*30000);assert.strictEqual(s.toPivot,0);near(s.marginalRate,35);
});
ok('mes pasado aunque falte el último día: se toma lo cargado',()=>{
  const some=rows.slice(0,10);
  const s=C.monthSummary(k,some,{year:2026,month:10,today:'2026-11-03'});
  assert.strictEqual(s.ended,true);near(s.projected.retail,s.totals.retail);
});
ok('mes fuera del contrato: litros sí, comisión no',()=>{
  const s=C.monthSummary(k,[{sold_on:'2026-06-10',retail_l:1000,flota_l:0,kerosene_l:0}],{year:2026,month:6,today:'2026-10-20'});
  assert.strictEqual(s.inContract,false);near(s.totals.retail,1000);assert.strictEqual(s.now,undefined);
});
ok('mes sin datos',()=>{
  const s=C.monthSummary(k,[],{year:2026,month:11,today:'2026-10-20'});
  assert.strictEqual(s.loaded,0);assert.strictEqual(s.projected,null);assert.strictEqual(s.close,null);assert.strictEqual(s.last,0);
});
ok('ignora filas de otros meses',()=>{
  const s=C.monthSummary(k,[...rows,{sold_on:'2026-09-30',retail_l:99999,flota_l:0,kerosene_l:0}],{year:2026,month:10,today:'2026-10-20'});
  near(s.totals.retail,266000);
});
ok('sin contrato guardado no se calcula comisión',()=>{
  const s=C.monthSummary(null,rows,{year:2026,month:10,today:'2026-10-20'});
  assert.strictEqual(s.inContract,false);near(s.totals.retail,266000);
});
console.log(`\n${n} comprobaciones: TODAS PASARON`);
