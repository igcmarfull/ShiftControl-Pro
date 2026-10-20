// Pruebas de documents-data.js y documents-render.js con datos ficticios.
// Uso: node src/modules/documents/documents.test.js
const assert=require('assert');
const D=require('./documents-data.js');
const R=require('./documents-render.js');

// ---- números en letras y cuotas
assert.strictEqual(D.numberToWords(1038649),'un millón treinta y ocho mil seiscientos cuarenta y nueve');
assert.strictEqual(D.numberToWords(553553),'quinientos cincuenta y tres mil quinientos cincuenta y tres');
assert.strictEqual(D.numberToWords(21000),'veintiún mil');
assert.strictEqual(D.numberToWords(31),'treinta y uno');
assert.strictEqual(D.numberToWords(100),'cien');assert.strictEqual(D.numberToWords(101),'ciento uno');
assert.strictEqual(D.numberToWords(1000000),'un millón');assert.strictEqual(D.numberToWords(2100100),'dos millones cien mil cien');
assert.strictEqual(D.numberToWords(0),'cero');
assert.strictEqual(D.pesosInWords(1),'un peso');assert.strictEqual(D.pesosInWords(31),'treinta y un pesos');assert.strictEqual(D.pesosInWords(21),'veintiún pesos');assert.strictEqual(D.pesosInWords(1000001),'un millón un pesos');assert.strictEqual(D.pesosInWords(201001),'doscientos un mil un pesos');assert.strictEqual(D.pesosInWords(485096),'cuatrocientos ochenta y cinco mil noventa y seis pesos');
assert.deepStrictEqual(D.splitInstallments(1038649,2),[519324,519325]);
assert.deepStrictEqual(D.splitInstallments(100,3),[33,33,34]);
assert.strictEqual(D.splitInstallments(500,3).reduce((a,b)=>a+b,0),500);
console.log('ok  números en letras y cuotas');

// ---- fechas, RUT, ordinales
assert.strictEqual(D.longDate('2026-08-25'),'25 de agosto de 2026');assert.strictEqual(D.longDate(''),'');assert.strictEqual(D.longDate('basura'),'');
assert.strictEqual(D.shortDate('2026-09-10'),'10-09-2026');
assert.strictEqual(D.formatRut('123456789'),'12.345.678-9');assert.strictEqual(D.formatRut('11.222.333-k'),'11.222.333-K');
assert.deepStrictEqual([1,10,13,20,21,34].map(D.ordinal),['Primero','Décimo','Décimo tercero','Vigésimo','Vigésimo primero','Trigésimo cuarto']);
assert.strictEqual(D.clp(1038649),'$ 1.038.649');
console.log('ok  fechas, RUT y ordinales');

// ---- todos los modelos se arman con sus valores por defecto y no dejan basura
const COMPANY=D.COMPANY;
const textOf=doc=>doc.blocks.map(b=>b.runs?b.runs.map(r=>r.text).join(''):b.text||(b.rows?b.rows.map(x=>x.label+' '+x.amount).join(' '):b.cols?b.cols.flat().join(' '):'')).join('\n');
assert.strictEqual(D.TEMPLATES.length,8);
D.TEMPLATES.forEach(t=>{
  const doc=t.build(D.defaults(t));
  const text=textOf(doc);
  assert.ok(doc.blocks.length>3,t.id);
  assert.ok(!/undefined|NaN|\[object/.test(text),`${t.id} deja basura: ${text.match(/.{20}(undefined|NaN|\[object).{10}/)}`);
  assert.ok(doc.fileName&&!/\s/.test(doc.fileName),t.id);
  const html=R.pageHtml(doc,{company:COMPANY,logoUrl:'x.png',highlight:true});
  assert.ok(html.includes(COMPANY.name)&&html.includes(COMPANY.rut),`${t.id}: membrete`);
  const keys=t.fields.map(f=>f.key);assert.strictEqual(new Set(keys).size,keys.length,`${t.id}: claves repetidas`);
});
console.log('ok  los 8 modelos se arman sin dejar datos rotos');

// ---- finiquito: total, letras y cuotas
const fin=D.get('finiquito');
let v={...D.defaults(fin),workerName:'Persona de Prueba',workerRut:'12.345.678-9',workerRole:'Atendedora',legalRep:'Rep Prueba',legalRepRut:'11.111.111-1',
  startDate:'2025-07-01',endDate:'2026-08-25',a1:'485096',a2:'553553',pay:'En 2 cuotas',d1:'2026-09-10',d2:'2026-10-10',account:'Cta 1'};
let doc=fin.build(v),text=textOf(doc);
assert.strictEqual(doc.total,1038649);
assert.ok(text.includes('TOTAL $ 1.038.649'));
assert.ok(text.includes('un millón treinta y ocho mil seiscientos cuarenta y nueve pesos.'));
assert.ok(text.includes('10-09-2026 $ 519.324')&&text.includes('10-10-2026 $ 519.325'));
assert.ok(text.includes('desde el 1 de julio de 2025 hasta el 25 de agosto de 2026'));
assert.ok(text.includes('Art. 159 N° 1 del Código del Trabajo, «Mutuo acuerdo de las partes»'));
v={...v,pay:'En este acto'};text=textOf(fin.build(v));
assert.ok(text.includes('se paga en este acto')&&!text.includes('cuotas'));
v={...v,a3:'100000',c3:'Feriado legal',pay:'En 3 cuotas',d3:'2026-11-10'};doc=fin.build(v);
assert.strictEqual(doc.total,1138649);assert.ok(textOf(doc).includes('FERIADO LEGAL $ 100.000'));
assert.strictEqual(fin.build({...v,a1:'',a2:'',a3:''}).total,0);
console.log('ok  finiquito: total, letras, cuotas y conceptos');

// ---- campos condicionales
const ff=Object.fromEntries(fin.fields.map(f=>[f.key,f]));
assert.strictEqual(D.visible(ff.account,{pay:'En este acto'}),false);assert.strictEqual(D.visible(ff.account,{pay:'En 2 cuotas'}),true);
assert.strictEqual(D.visible(ff.d2,{pay:'En 1 cuota'}),false);assert.strictEqual(D.visible(ff.d2,{pay:'En 3 cuotas'}),true);assert.strictEqual(D.visible(ff.d3,{pay:'En 2 cuotas'}),false);
console.log('ok  campos que aparecen según otros');

// ---- contrato: anexo completo y opciones
const con=D.get('contrato');
v={...D.defaults(con),workerName:'Persona de Prueba',workerRut:'12.345.678-9',legalRep:'Rep Prueba',netSalary:'553553',startDate:'2026-06-26',date:'2026-06-26',term:'Plazo fijo',endDate:'2026-07-09'};
doc=con.build(v);text=textOf(doc);
assert.ok(text.includes('El sueldo líquido será de $ 553.553 (quinientos cincuenta y tres mil quinientos cincuenta y tres pesos).'));
assert.ok(text.includes('tendrá una duración hasta el 9 de julio de 2026'));
assert.ok(text.includes('ANEXO DE CONTRATO')&&text.includes('TRIGÉSIMO CUARTO: Cláusula de confidencialidad')&&text.includes('ACUSE DE RECIBO'));
assert.strictEqual((text.match(/^[A-ZÁÉÍÓÚ ]+: /gm)||[]).filter(x=>/PRIMERO|SEGUNDO/.test(x)).length>=4,true);
assert.ok(doc.blocks.some(b=>b.t==='break'));
assert.ok(textOf(con.build({...v,term:'Indefinido'})).includes('duración indefinida'));
const noAnnex=textOf(con.build({...v,annex:false}));
assert.ok(!noAnnex.includes('ANEXO DE CONTRATO')&&!noAnnex.includes('ACUSE DE RECIBO'));
console.log('ok  contrato: cláusulas, sueldo en letras, plazo y anexo opcional');

// ---- carta de aviso: causal y hechos
const car=D.get('carta_aviso');
v={...D.defaults(car),workerName:'Persona de Prueba',workerRut:'12.345.678-9',causal:'160-7',facts:'Hechos de prueba.',endDate:'2026-10-20'};
text=textOf(car.build(v));
assert.ok(text.includes('Art. 160 N° 7')&&text.includes('Hechos en que se funda la causal: Hechos de prueba.'));
assert.ok(text.includes('sin necesidad de aviso previo'));
assert.ok(textOf(car.build({...v,notice:'Con 30 días de anticipación',causal:'161'})).includes('treinta días de anticipación'));
console.log('ok  carta de aviso');

// ---- vacíos: queda una línea para completar
text=textOf(D.get('amonestacion').build(D.defaults(D.get('amonestacion'))));
assert.ok(text.includes('____________'),'los datos que faltan quedan en blanco');

// ---- HTML seguro
doc=D.get('constancia_vehiculo').build({...D.defaults(D.get('constancia_vehiculo')),driver:'<script>alert(1)</script>',plate:'"><img src=x>'});
const html=R.printHtml(doc,{company:COMPANY,logoUrl:'x.png'});
assert.ok(!html.includes('<script>alert')&&!html.includes('<img src=x>'));
assert.ok(html.includes('@page')&&html.includes('Letter'));
console.log('ok  HTML escapado y hoja carta');

// ---- densidad: los textos cortos llevan más aire, los largos van compactos
const dens=id=>R.density(D.get(id).build(D.defaults(D.get(id))));
assert.deepStrictEqual(['constancia_vehiculo','certificado','vacaciones','amonestacion','anexo'].map(dens),Array(5).fill('roomy'));
assert.strictEqual(dens('carta_aviso'),'normal');
assert.strictEqual(dens('finiquito'),'compact');assert.strictEqual(dens('contrato'),'compact');
assert.ok(R.printHtml(D.get('certificado').build(D.defaults(D.get('certificado'))),{company:COMPANY}).includes('class="dens-roomy"'));
console.log('ok  densidad según el largo del documento');
console.log('\nTODAS LAS PRUEBAS PASARON');
