// Pruebas del lector de informes de combustible. Sin dependencias: node src/modules/fuel/fuel-import.test.js
const assert=require('assert');
const I=require('./fuel-import.js');
let n=0;
const ok=(name,fn)=>{fn();n++;console.log('PASS',name)};

const META_FLOTA='Resumen de venta combustible |  Tienda : 9319 - 9319 RD Coltauco Periodo desde : 285 - 1(30/09/26 22:56 >> 01/10/26 22:56) Periodo hasta : 301 - 1(16/10/26 22:59 >> 05/10/26 22:57) Producto : [ Producto | Indistinto] Tipo de venta : Tarjeta flota';
const META_GENERAL='Resumen de venta combustible |  Tienda : 9319 - 9319 RD Coltauco Periodo desde : 285 - 1(30/09/26 22:56 >> 01/10/26 22:56) Periodo hasta : 301 - 1(16/10/26 22:59 >> 05/10/26 22:57) Producto : [ Producto | Indistinto] Tipo de venta : General,Descuento';
const META_TODOS='Resumen de venta combustible |  Tienda : 9319 - 9319 RD Coltauco Periodo desde : 285 - 1(30/09/26 22:56 >> 01/10/26 22:56) Periodo hasta : 301 - 1(16/10/26 22:59 >> 05/10/26 22:57) Producto : [ Producto | Indistinto] Tipo de venta : Prueba surtidor,General,Handling,Descuento';
const HEAD=['Estacion','Fecha Contable','Nombre Producto','Consignado','Tipo de Venta','Volumen','PPU','PPU Original','Monto','Monto (Teorico sin descuentos)'];
const L=(date,product,vol)=>['9319 RD Coltauco',date,product,'SI','-',vol,1500,1500,1,1];
const sheet=(meta,lines)=>[['Resumen de venta combustible 18-10-2026'],[meta],HEAD,...lines,['TOTAL',null,null,null,null,0]];

const flota=sheet(META_FLOTA,[L('01/10/2026','Aramco Gasolina 93',46.236),L('01/10/2026','Aramco ProForce Diesel',1616.162),L('01/10/2026','Aramco ProForce Diesel',612.641),L('03/10/2026','Aramco ProForce Diesel',1831.933),L('05/10/2026','Aramco ProForce Diesel',100.4)]);
const general=sheet(META_GENERAL,[L('01/10/2026','Aramco Gasolina 93',866.334),L('01/10/2026','Aramco Gasolina 95',1265.267),L('01/10/2026','Aramco ProForce Diesel',3951.795),L('01/10/2026','Kerosene',31.798),L('01/10/2026','Kerosene',18.129),
  L('02/10/2026','Aramco ProForce Gasolina 97',550.823),L('02/10/2026','Kerosene',54.762),L('03/10/2026','Aramco Gasolina 93',5480.095),L('04/10/2026','Aramco Gasolina 93',5194.97),L('05/10/2026','Aramco Gasolina 93',5201.255)]);

ok('reconoce el informe de flota',()=>{const r=I.parseReport(flota);assert.strictEqual(r.ok,true);assert.strictEqual(r.kind,'flota');assert.strictEqual(r.from,'2026-10-01');assert.strictEqual(r.to,'2026-10-05')});
ok('reconoce el informe general',()=>{const r=I.parseReport(general);assert.strictEqual(r.ok,true);assert.strictEqual(r.kind,'general')});
ok('suma las líneas de un mismo día y redondea al litro',()=>{
  const r=I.parseReport(flota);
  assert.strictEqual(r.days['2026-10-01'].flota,Math.round(46.236+1616.162+612.641));
  assert.strictEqual(r.days['2026-10-03'].flota,1832);
});
ok('los días del período sin ventas de flota quedan en cero',()=>{
  const r=I.parseReport(flota);
  assert.strictEqual(r.days['2026-10-02'].flota,0);assert.strictEqual(r.days['2026-10-04'].flota,0);
  assert.deepStrictEqual(Object.keys(r.days).sort(),['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05']);
});
ok('en el informe general separa el kerosene del retail',()=>{
  const r=I.parseReport(general);
  assert.strictEqual(r.days['2026-10-01'].retail,Math.round(866.334+1265.267+3951.795));
  assert.strictEqual(r.days['2026-10-01'].kerosene,Math.round(31.798+18.129));
  assert.strictEqual(r.days['2026-10-02'].retail,551);assert.strictEqual(r.days['2026-10-02'].kerosene,55);
});
ok('la gasolina 97 cuenta como retail',()=>{assert.strictEqual(I.parseReport(general).days['2026-10-02'].retail,Math.round(550.823))});
ok('ignora la fila TOTAL',()=>{const r=I.parseReport(general);assert.strictEqual(Object.values(r.days).length,5)});
ok('une los dos informes en filas por día con sus columnas',()=>{
  const m=I.mergeReports([I.parseReport(flota),I.parseReport(general)]);
  assert.strictEqual(m.ok,true);assert.strictEqual(m.rows.length,5);
  assert.deepStrictEqual(Object.keys(m.rows[0]).sort(),['date','flota','kerosene','retail']);
  assert.strictEqual(m.rows[0].date,'2026-10-01');
});
ok('un solo informe deja fuera las columnas del otro',()=>{
  const m=I.mergeReports([I.parseReport(flota)]);
  assert.deepStrictEqual(Object.keys(m.rows[0]).sort(),['date','flota']);
});
ok('rechaza dos informes del mismo tipo',()=>{assert.strictEqual(I.mergeReports([I.parseReport(flota),I.parseReport(flota)]).ok,false)});
ok('rechaza el informe general si incluye Prueba surtidor y Handling',()=>{
  const r=I.parseReport(sheet(META_TODOS,[L('01/10/2026','Aramco Gasolina 93',10)]));
  assert.strictEqual(r.ok,false);assert.ok(r.error.includes('Prueba surtidor')&&r.error.includes('Handling'));assert.ok(r.error.includes('solo «General» y «Descuento»'));
});
ok('rechaza el general aunque traiga solo uno de los dos',()=>{
  assert.strictEqual(I.parseReport(sheet(META_GENERAL.replace('General,Descuento','General,Handling,Descuento'),[L('01/10/2026','Aramco Gasolina 93',10)])).ok,false);
  const r=I.parseReport(sheet(META_GENERAL.replace('General,Descuento','Prueba surtidor,General'),[L('01/10/2026','Aramco Gasolina 93',10)]));
  assert.strictEqual(r.ok,false);assert.ok(r.error.includes('Prueba surtidor')&&!r.error.includes('Handling'));
});
ok('acepta General y Descuento sin avisos',()=>{const r=I.parseReport(general);assert.strictEqual(r.ok,true);assert.deepStrictEqual(r.warnings,[])});
ok('avisa si el general no incluye Descuento',()=>{
  const r=I.parseReport(sheet(META_GENERAL.replace('General,Descuento','General'),[L('01/10/2026','Aramco Gasolina 93',10)]));
  assert.strictEqual(r.ok,true);assert.strictEqual(r.warnings.length,1);assert.ok(r.warnings[0].includes('Descuento'));
});
ok('el informe de flota no lleva avisos',()=>{assert.deepStrictEqual(I.parseReport(flota).warnings,[])});
ok('rechaza un archivo que no es el informe',()=>{
  assert.strictEqual(I.parseReport([['Informe de Ventas por Articulos'],['Tienda : x'],['Fecha','Codigo']]).ok,false);
  assert.strictEqual(I.parseReport([]).ok,false);
});
ok('rechaza un tipo de venta desconocido',()=>{
  const r=I.parseReport(sheet(META_FLOTA.replace('Tarjeta flota','Crédito'),[L('01/10/2026','Aramco Gasolina 93',10)]));
  assert.strictEqual(r.ok,false);assert.ok(/tipo de venta/i.test(r.error));
});
ok('rechaza un volumen ilegible',()=>{assert.strictEqual(I.parseReport(sheet(META_FLOTA,[L('01/10/2026','Aramco Gasolina 93','abc')])).ok,false)});
ok('lee volúmenes escritos como texto con coma',()=>{
  const r=I.parseReport(sheet(META_FLOTA,[L('01/10/2026','Aramco Gasolina 93','1.616,162')]));
  assert.strictEqual(r.days['2026-10-01'].flota,1616);
});
ok('lee fechas como Date de Excel',()=>{
  const r=I.parseReport(sheet(META_FLOTA,[L(new Date(2026,9,2),'Aramco Gasolina 93',10)]));
  assert.strictEqual(r.days['2026-10-02'].flota,10);
});
ok('sin período en el encabezado usa las fechas de las líneas',()=>{
  const r=I.parseReport(sheet('Resumen Tipo de venta : Tarjeta flota',[L('03/10/2026','Aramco Gasolina 93',10),L('06/10/2026','Aramco Gasolina 93',5)]));
  assert.strictEqual(r.from,'2026-10-03');assert.strictEqual(r.to,'2026-10-06');assert.strictEqual(Object.keys(r.days).length,4);
});
console.log(`\n${n} comprobaciones: TODAS PASARON`);
