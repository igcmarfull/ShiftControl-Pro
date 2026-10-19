// Pruebas de invoice-cost-calc.js con una factura ficticia (no es un documento real).
// Uso: node src/modules/invoice-cost/invoice-cost-calc.test.js
const assert=require('assert');
const C=require('./invoice-cost-calc.js');

const TEXT=`Proveedor de Prueba S.A.                                           R.U.T.: 76.000.000-0
Factura Electronica
Nº 1234567
Fecha de Emisión: 09-10-2026
Item      Tipo Cod.     Código       Nombre Item          Cantidad    Un.     Precio Unit.      Descto.      Recargo      Monto
   0001             0        100001    Gaseosa Cola PT1,5 x 6           4       PAC            7.000         7.000        3.000       24.000
   0002             0        100002    Agua Mineral PT600 x 12          3       PAC            5.000         3.000        2.000       14.000
   0003             0        100003    Gaseosa Light LT350 pack x 1*6   2       PAC            3.000         0            600          6.600
Impuestos Adicionales
        (18.00 %)                      ILA (10.00 %)
        $ 5.000                         $ 2.440
                                      Monto Exento             $                                      0
                                      Monto Neto               $                                 44.600
                                      IVA (19.00%)             $                                  8.474
                                      Total                    $                                 60.514
                                      Total a Pagar            $`;

const p=C.parse(TEXT);
assert.strictEqual(p.ok,true,p.warnings.join(' '));
assert.strictEqual(p.supplierName,'Proveedor de Prueba S.A.');
assert.strictEqual(p.rut,'76.000.000-0');
assert.strictEqual(p.folio,'1234567');
assert.strictEqual(p.issueDate,'2026-10-09');
assert.strictEqual(p.lines.length,3);
assert.strictEqual(p.net,44600);assert.strictEqual(p.iva,8474);assert.strictEqual(p.total,60514);
assert.strictEqual(p.linesSum,44600);assert.deepStrictEqual(p.warnings,[]);
assert.strictEqual(p.extraTax,7440);
assert.deepStrictEqual(p.extraBreakdown,[{rate:18,amount:5000},{rate:10,amount:2440}]);
assert.deepStrictEqual(p.lines[0],{n:1,code:'100001',name:'Gaseosa Cola PT1,5 x 6',qty:4,unit:'PAC',packSize:6,price:7000,discount:7000,surcharge:3000,amount:24000});
assert.strictEqual(p.lines[2].packSize,6,'«pack x 1*6» son 6 unidades');
console.log('ok  lectura de cabecera, líneas, totales e impuesto adicional');

assert.strictEqual(C.packSize('Coca Cola PT591cc x 6'),6);
assert.strictEqual(C.packSize('Vital C/G PT600cc x 12 ter'),12);
assert.strictEqual(C.packSize('Monster Energy Zero Sugar Green LT473 x6'),6);
assert.strictEqual(C.packSize('Coca-Cola Zero Cafe. Zero Azucar LT310x6'),6,'sin espacio antes de la x');
assert.strictEqual(C.packSize('Max 2 unidades'),1,'una x dentro de una palabra no es un pack');
[['RED BULL TRADIC 4PCX6-LAT250',24],['RED BULL TRADIC 24PF-LAT355',24],['RED BULL BLUE ED 24PF-LAT250',24],
  ['RED BULL TRADIC 12PC-LATA473',12],['KEM XTREME 6PFX4-LATA 473',24],['PEPSI 6PFX4-LATA 350',24],
  ['CACHANTUN C-GAS 12PF-PET 600',12],['GINGER ALE 12PF-PET600',12],['WATTS NARANJA GNB 300 X 12',12]]
  .forEach(([name,units])=>assert.strictEqual(C.packSize(name),units,name));
assert.strictEqual(C.packSize('Producto suelto'),1);
console.log('ok  unidades por pack');

const c=C.compute(p);
assert.strictEqual(c.net,44600);
assert.strictEqual(c.real,44600+7440);
assert.ok(Math.abs(c.overPct-(7440/44600*100))<1e-9);
const [cola,agua,light]=c.lines;
assert.strictEqual(cola.units,24);assert.strictEqual(cola.packCost,6000);assert.strictEqual(cola.unitNet,1000);
assert.strictEqual(agua.hasTax,false,'el agua parte sin impuesto');
assert.strictEqual(agua.tax,0);assert.strictEqual(agua.unitReal,agua.unitNet);
assert.strictEqual(cola.tax+light.tax,7440,'el impuesto se reparte completo entre las líneas marcadas');
assert.strictEqual(cola.tax,Math.round(7440*24000/30600));
assert.ok(Math.abs(cola.unitReal-(cola.unitNet+cola.tax/24))<1e-9);
assert.strictEqual(c.lines.reduce((s,l)=>s+l.amount+l.tax,0),c.real,'neto de las líneas + impuesto = costo real');
console.log('ok  costo por pack y por unidad, reparto del impuesto');

const all=C.compute(p,{flags:[true,true,true],packs:[6,12,6]});
assert.strictEqual(all.lines.reduce((s,l)=>s+l.tax,0),7440);
assert.strictEqual(all.lines[1].units,36);
const none=C.compute(p,{flags:[false,false,false]});
assert.strictEqual(none.lines.reduce((s,l)=>s+l.tax,0),0,'sin ninguna casilla marcada no se reparte');
console.log('ok  casillas y unidades por pack editables');

const bad=C.parse('Texto cualquiera sin factura '.repeat(5));
assert.strictEqual(bad.ok,false);assert.ok(bad.warnings.length);
assert.strictEqual(C.parse('').ok,false);
const mismatch=C.parse(TEXT.replace('44.600','44.000'));
assert.ok(mismatch.warnings.some(w=>/no coincide/.test(w)),'avisa si las líneas no suman el neto');
console.log('ok  textos que no son factura y totales que no cuadran');
console.log('\nTODAS LAS PRUEBAS PASARON');
