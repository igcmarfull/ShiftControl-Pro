// Pruebas de sales-analysis-calc.js con transacciones ficticias (no son datos reales).
// Uso: node src/modules/sales-analysis/sales-analysis-calc.test.js
const assert=require('assert');
const C=require('./sales-analysis-calc.js');

const HEAD=[null,'Tienda','Periodo','Turno','Fecha Transacción','Nro de Comprobante','Nro Trx','Nro Trx Original','Tipo Trx','Terminal','Cliente','Nro de cliente externo','Tipo/s de cliente','Operador','Operador original','Grupo','$Total ticket','$Neto Ventas','$Desc Manuales','$Desc PROMO','$Desc lista promocional','$Devoluciones','$Ventas Brutas (+)','$Ventas Brutas (-)','$IVA','$IIBB','Cancelada'];
const row=(when,receipt,client,operator,total,cancelled='NO',kind='Sale')=>{
  const r=new Array(HEAD.length).fill(null);
  r[1]='Tienda de prueba';r[4]=when;r[5]=receipt;r[8]=kind;r[9]=4;r[10]=client;r[13]=operator;r[16]=total;r[24]=Math.round(total*0.19/1.19);r[26]=cancelled;
  return r;
};
const UNO='111111111 - CLIENTE UNO SPA',DOS='222222222 - CLIENTE DOS LTDA',TRES='333333333 - PERSONA TRES PRUEBA';
const ANA='Ana María Prueba Soto',BEA='Beatriz Test Rojas',CAR='Carla Ejemplo Díaz';
const rows=[
  ['Reporte de Transacciones Realizadas 03-11-2026'],
  ['Reporte | Tienda : 0000 Fecha desde : 01/11/2026'],
  HEAD,
  row('01/11/2026 08:00:00','FC-1',UNO,ANA,30000),
  row('01/11/2026 09:00:00','FC-2',UNO,ANA,45000),
  row('01/11/2026 10:00:00','FC-3',UNO,ANA,28000),
  row('02/11/2026 11:00:00','FC-4',UNO,ANA,52000),
  row('02/11/2026 12:00:00','FC-5',TRES,ANA,15000),
  row('01/11/2026 16:00:00','FC-6',DOS,BEA,20000),
  row('01/11/2026 16:30:00','FC-7',TRES,BEA,30000),
  row('01/11/2026 17:00:00','FC-8',UNO,BEA,40000),
  row('01/11/2026 18:00:00','FC-9',DOS,BEA,50000),
  row('01/11/2026 19:00:00','FC-10',TRES,BEA,60000),
  row('01/11/2026 14:00:00','FC-11',DOS,CAR,18000),
  row('01/11/2026 14:10:00',null,TRES,CAR,25000,'SI'),
  row('01/11/2026 14:12:00','FC-12',TRES,CAR,25000),
  row('02/11/2026 23:30:00','FC-13',DOS,CAR,12000),
  row('02/11/2026 13:00:00','FC-14',UNO,CAR,9000,'NO','Return'),
  [null,null,null,null,null,null,null,null,null,null,null,null,null,null]
];

/* lectura */
const p=C.parse(rows);
assert.strictEqual(p.ok,true,p.error);
assert.strictEqual(p.transactions.length,14);
assert.strictEqual(p.nonSale,1);
assert.deepStrictEqual(p.period,{from:'2026-11-01',to:'2026-11-02'});
const first=p.transactions[0];
assert.strictEqual(first.rut,'111111111');assert.strictEqual(first.client,'CLIENTE UNO SPA');
assert.strictEqual(first.date,'2026-11-01');assert.strictEqual(first.time,'08:00');assert.strictEqual(first.total,30000);
assert.strictEqual(p.transactions.filter(t=>t.cancelled).length,1);
assert.strictEqual(C.parse([['nada']]).ok,false);

/* sin planificación */
const a=C.analyze(p.transactions);
assert.strictEqual(a.summary.n,13);
assert.strictEqual(a.summary.cancelled,1);
assert.strictEqual(a.summary.total,30000+45000+28000+52000+15000+20000+30000+40000+50000+60000+18000+25000+12000);
assert.strictEqual(a.operators[0].operator,BEA,'ordenadas por monto: Beatriz 200.000, Ana 170.000');

const conc=a.alerts.filter(x=>x.kind==='concentracion');
assert.strictEqual(conc.length,2,'Ana con el cliente uno y Beatriz con la persona tres');
assert.strictEqual(conc[0].operator,ANA);
assert.strictEqual(conc[0].level,'high');
assert.strictEqual(conc[0].count,4);
assert.ok(/4 ventas al mismo cliente/.test(conc[0].detail)&&/% de todo lo que vendió/.test(conc[0].detail));
assert.strictEqual(conc[1].operator,BEA);
assert.strictEqual(conc[1].level,'mid','2 ventas que son el 45 % de lo que vendió: avisa, pero sin gravedad alta');

const round=a.alerts.filter(x=>x.kind==='redondos');
assert.strictEqual(round.length,1,'solo Beatriz: 5 de 5 ventas redondas');
assert.strictEqual(round[0].operator,BEA);

const cancel=a.alerts.filter(x=>x.kind==='anulada');
assert.strictEqual(cancel.length,1);
assert.ok(/volvió a emitir/.test(cancel[0].detail));

assert.strictEqual(a.alerts.filter(x=>x.kind==='turno').length,0,'sin planificación no hay cruce de turnos');
assert.strictEqual(a.alerts[0].level,'high','las alertas altas van primero');

/* umbrales editables */
assert.strictEqual(C.analyze(p.transactions,{minRepeat:99,share:101}).alerts.filter(x=>x.kind==='concentracion').length,0);

/* clientes de confianza: no generan alertas de cliente repetido ni de mismo día */
const trusted=C.analyze(p.transactions,{ignoreClients:['111111111','333333333','222222222']});
assert.strictEqual(trusted.alerts.filter(x=>x.kind==='concentracion'||x.kind==='mismo-dia').length,0);
assert.ok(a.alerts.filter(x=>x.kind==='concentracion').every(x=>x.clientKey),'cada alerta de cliente trae su clave');

/* mismo día: tres ventas al cliente dos en un día */
const day=C.analyze(p.transactions,{sameDay:2}).alerts.filter(x=>x.kind==='mismo-dia');
assert.ok(day.some(x=>/CLIENTE DOS/.test(x.title)));

/* nombres del POS → trabajadores de la app */
const emps=[{id:'e1',name:'Ana Prueba'},{id:'e2',name:'Beatriz Rojas'},{id:'e3',name:'Carla Díaz'},{id:'e4',name:'Otra Persona'}];
assert.strictEqual(C.suggestEmployee(ANA,emps).id,'e1');
assert.strictEqual(C.suggestEmployee(BEA,emps).id,'e2');
assert.strictEqual(C.suggestEmployee(CAR,emps).id,'e3');
assert.strictEqual(C.suggestEmployee('Alguien Desconocido',emps),null);
assert.strictEqual(C.suggestEmployee('Ana Prueba Sola',[{id:'x',name:'Ana Prueba'},{id:'y',name:'Prueba Ana'}]),null,'si hay dos posibles no adivina');

/* cruce con la planificación: B 07-15, C 15-23, A 23-07 (A lleva la fecha del día en que termina) */
const shiftAt=minutes=>{
  if(minutes>=1380||minutes<420)return {code:'A',start:1380,wraps:true};
  if(minutes<900)return {code:'B',start:420,wraps:false};
  return {code:'C',start:900,wraps:false};
};
const plans=[
  {employeeId:'e1',date:'2026-11-01',code:'B'},{employeeId:'e1',date:'2026-11-02',code:'B'},
  {employeeId:'e2',date:'2026-11-01',code:'D'},
  {employeeId:'e3',date:'2026-11-01',code:'L'},{employeeId:'e3',date:'2026-11-02',code:'C'},{employeeId:'e3',date:'2026-11-03',code:'A'}
];
const map={};
p.transactions.forEach(t=>{const e=C.suggestEmployee(t.operator,emps);if(e)map[t.operatorKey]=e});
const b=C.analyze(p.transactions,{plans,operatorMap:map,shiftAt});
const shifts=b.alerts.filter(x=>x.kind==='turno');
const find=(op,re)=>shifts.find(x=>x.operator===op&&re.test(x.title));
assert.ok(find(BEA,/descanso/),'Beatriz vendió en su descanso');
assert.strictEqual(find(BEA,/descanso/).level,'mid');
assert.strictEqual(find(BEA,/descanso/).count,5);
assert.ok(find(CAR,/licencia/),'Carla vendió con licencia');
assert.strictEqual(find(CAR,/licencia/).level,'high');
assert.ok(!find(CAR,/turno A/),'la venta de las 23:30 del 2-11 cae en el A del 3-11: coincide con su plan');
assert.ok(!shifts.some(x=>x.operator===ANA),'todas las ventas de Ana caen en su turno B');

/* una venta de la tarde con turno B planificado es «otro turno» (puede ser reemplazo) */
const c=C.analyze(p.transactions,{plans:[{employeeId:'e2',date:'2026-11-01',code:'B'}],operatorMap:map,shiftAt});
const other=c.alerts.find(x=>x.kind==='turno'&&x.operator===BEA);
assert.ok(other&&other.level==='info'&&/turno C \(tenía el B\)/.test(other.title)&&/reemplazo/.test(other.detail));
console.log('sales-analysis-calc: todo bien');
