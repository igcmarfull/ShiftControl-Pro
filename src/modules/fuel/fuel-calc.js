/* Cálculo de la comisión de combustible según el contrato (addendum C-3602-04, julio a diciembre de 2026).
   Funciones puras, sin DOM ni red, para poder probarlas con node (ver fuel-calc.test.js).
   Montos en pesos netos; el IVA se agrega aparte. Solo el retail (gasolinas y diésel) cuenta para el pivote:
   la flota paga su tarifa por litro y el kerosene la suya, ambas fuera del pivote. */
(function(root){
'use strict';

// Valores del addendum; se usan solo si la empresa no tiene un contrato guardado.
const DEFAULT_CONTRACT=Object.freeze({
  valid_from:'2026-07-01',valid_to:'2026-12-31',pivot_l:450000,
  low_rate:19.9,low_fixed:5000000,high_rate:35,high_fixed:13956000,
  kero_rate:30,flota_rate:5,iva_pct:19
});

const pad=n=>String(n).padStart(2,'0');
const daysIn=(year,month)=>new Date(year,month,0).getDate();
const monthStart=(year,month)=>`${year}-${pad(month)}-01`;
const monthEnd=(year,month)=>`${year}-${pad(month)}-${pad(daysIn(year,month))}`;
const dayOf=iso=>Number(String(iso).slice(8,10));

// Comisión por los litros retail del mes. Hasta el pivote: fijo + tarifa por litro. Sobre el pivote: fijo mayor
// + tarifa mayor solo por los litros que pasan del pivote. En el pivote ambas fórmulas casi coinciden.
function retailCommission(contract,liters){
  const v=Math.max(0,Number(liters)||0);
  return v<=contract.pivot_l
    ?Number(contract.low_fixed)+Number(contract.low_rate)*v
    :Number(contract.high_fixed)+Number(contract.high_rate)*(v-contract.pivot_l);
}

function commission(contract,totals){
  const retail=retailCommission(contract,totals.retail);
  const flota=Number(contract.flota_rate)*(Number(totals.flota)||0);
  const kerosene=Number(contract.kero_rate)*(Number(totals.kerosene)||0);
  const net=retail+flota+kerosene;
  const iva=net*Number(contract.iva_pct)/100;
  return {retail,flota,kerosene,net,iva,gross:net+iva};
}

// rows: filas de fuel_sales del mes ({sold_on, retail_l, flota_l, kerosene_l}).
// today: 'AAAA-MM-DD' del día de hoy (para saber si el mes ya terminó).
function monthSummary(contract,rows,{year,month,today}){
  const dim=daysIn(year,month);
  const from=monthStart(year,month),to=monthEnd(year,month);
  const inMonth=(rows||[]).filter(r=>r.sold_on>=from&&r.sold_on<=to).sort((a,b)=>a.sold_on<b.sold_on?-1:1);
  const totals={retail:0,flota:0,kerosene:0};
  inMonth.forEach(r=>{totals.retail+=Number(r.retail_l)||0;totals.flota+=Number(r.flota_l)||0;totals.kerosene+=Number(r.kerosene_l)||0});
  const loaded=inMonth.length;
  const last=loaded?dayOf(inMonth[loaded-1].sold_on):0;
  const loadedDays=new Set(inMonth.map(r=>dayOf(r.sold_on)));
  const missing=[];
  for(let d=1;d<=last;d++)if(!loadedDays.has(d))missing.push(d);
  const inContract=Boolean(contract)&&from>=contract.valid_from&&to<=contract.valid_to;
  const ended=today>to||last===dim;
  const factor=loaded?(ended?1:dim/loaded):null;
  const projected=loaded?{retail:totals.retail*factor,flota:totals.flota*factor,kerosene:totals.kerosene*factor}:null;
  const result={year,month,dim,loaded,last,missing,totals,projected,ended,inContract,from,to};
  if(!inContract||!contract)return result;
  result.now=commission(contract,totals);
  result.close=projected?commission(contract,projected):null;
  const pivot=contract.pivot_l;
  result.pivot=pivot;
  result.tramo=totals.retail>pivot?'high':'low';
  result.pct=pivot?totals.retail/pivot:0;
  result.toPivot=Math.max(0,pivot-totals.retail);
  result.remainingDays=Math.max(0,dim-last);
  result.neededPerDay=result.remainingDays>0?result.toPivot/result.remainingDays:null;
  result.marginalRate=totals.retail>pivot?Number(contract.high_rate):Number(contract.low_rate);
  result.rateGain=contract.low_rate>0?(contract.high_rate/contract.low_rate-1):null;
  result.avgRetail=loaded?totals.retail/loaded:0;
  return result;
}

const api={DEFAULT_CONTRACT,retailCommission,commission,monthSummary,daysIn,monthStart,monthEnd};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FuelCalc=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
