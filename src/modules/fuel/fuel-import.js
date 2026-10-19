/* Lector de los informes «Resumen de venta combustible» del POS (Excel), para cargar litros por día.
   Funciones puras sobre las filas de la hoja (arreglo de arreglos), sin DOM ni red: se prueban con node
   (fuel-import.test.js). Hay dos informes: el de «Tarjeta flota» (litros de flota) y el general («Prueba surtidor,
   General, Handling, Descuento»: retail y kerosene). La columna «Tipo de Venta» no separa esos tipos, así que el
   informe general se toma completo, con el kerosene aparte por nombre de producto. */
(function(root){
'use strict';

const pad=n=>String(n).padStart(2,'0');
const norm=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const iso=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const year4=y=>{const n=Number(y);return n<100?2000+n:n};

function toIso(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return iso(value.getFullYear(),value.getMonth()+1,value.getDate());
  const match=String(value??'').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  return match?iso(year4(match[3]),Number(match[2]),Number(match[1])):null;
}
function toNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:NaN;
  let text=String(value??'').trim().replace(/\s/g,'');
  if(!text)return NaN;
  if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');
  return Number(text);
}
function eachDay(from,to){
  const out=[];
  const a=new Date(`${from}T12:00:00`),b=new Date(`${to}T12:00:00`);
  for(let d=a;d<=b&&out.length<400;d.setDate(d.getDate()+1))out.push(iso(d.getFullYear(),d.getMonth()+1,d.getDate()));
  return out;
}

// rows: filas de la hoja. Devuelve {ok:true, kind, from, to, days:{fecha:{...litros}}, lines, liters} o {ok:false, error}.
function parseReport(rows){
  if(!Array.isArray(rows)||!rows.length)return {ok:false,error:'El archivo está vacío.'};
  const head=rows.slice(0,8);
  const metaRow=head.find(r=>Array.isArray(r)&&String(r[0]??'').toLowerCase().includes('tipo de venta'));
  if(!metaRow)return {ok:false,error:'No parece un «Resumen de venta combustible»: no encuentro el tipo de venta.'};
  const meta=String(metaRow[0]);
  const typeText=meta.split(/tipo de venta\s*:/i)[1]||'';
  const kind=/flota/i.test(typeText)&&!/general/i.test(typeText)?'flota':/general/i.test(typeText)?'general':null;
  if(!kind)return {ok:false,error:`No reconozco el tipo de venta del informe («${typeText.trim().slice(0,60)}»). Debe ser el de Tarjeta flota o el general.`};
  const headerIndex=rows.findIndex(r=>Array.isArray(r)&&r.some(c=>norm(c)==='fecha contable')&&r.some(c=>norm(c)==='volumen'));
  if(headerIndex<0)return {ok:false,error:'No encuentro las columnas «Fecha Contable» y «Volumen».'};
  const header=rows[headerIndex].map(norm);
  const col={date:header.indexOf('fecha contable'),product:header.indexOf('nombre producto'),volume:header.indexOf('volumen')};
  if(col.product<0)return {ok:false,error:'No encuentro la columna «Nombre Producto».'};

  const days={};
  let lines=0,liters=0;
  for(let i=headerIndex+1;i<rows.length;i++){
    const r=rows[i];
    if(!Array.isArray(r)||String(r[0]??'').trim().toLowerCase()==='total')continue;
    const day=toIso(r[col.date]);
    if(!day)continue;
    const volume=toNumber(r[col.volume]);
    if(!Number.isFinite(volume)||volume<0)return {ok:false,error:`Hay un volumen que no se puede leer en la fila ${i+1}.`};
    const entry=days[day]||(days[day]=kind==='flota'?{flota:0}:{retail:0,kerosene:0});
    if(kind==='flota')entry.flota+=volume;
    else if(/kerosene|kerosen/i.test(String(r[col.product]??'')))entry.kerosene+=volume;
    else entry.retail+=volume;
    lines++;liters+=volume;
  }
  if(!lines)return {ok:false,error:'El informe no trae ventas.'};

  // Período del informe: la fecha contable al final de «>>» en «Periodo desde» y en «Periodo hasta».
  const ends=[...meta.matchAll(/>>\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)].map(m=>iso(year4(m[3]),Number(m[2]),Number(m[1])));
  const sorted=Object.keys(days).sort();
  let from=ends.length>=2?ends[0]:sorted[0];
  let to=ends.length>=2?ends[ends.length-1]:sorted[sorted.length-1];
  if(sorted[0]<from)from=sorted[0];
  if(sorted[sorted.length-1]>to)to=sorted[sorted.length-1];
  // Los días del período sin ventas de esa línea cuentan como cero.
  eachDay(from,to).forEach(day=>{if(!days[day])days[day]=kind==='flota'?{flota:0}:{retail:0,kerosene:0}});
  Object.values(days).forEach(entry=>Object.keys(entry).forEach(k=>{entry[k]=Math.round(entry[k])}));
  return {ok:true,kind,from,to,days,lines,liters};
}

// Une los informes cargados en filas {date, retail?, flota?, kerosene?} ordenadas por fecha.
function mergeReports(reports){
  const kinds=reports.map(r=>r.kind);
  if(new Set(kinds).size!==kinds.length)return {ok:false,error:'Subiste dos informes del mismo tipo. Sube uno de flota y uno general, o uno solo.'};
  const byDate={};
  reports.forEach(report=>Object.entries(report.days).forEach(([date,values])=>{byDate[date]={...(byDate[date]||{}),date,...values}}));
  const rows=Object.values(byDate).sort((a,b)=>a.date<b.date?-1:1);
  return {ok:true,rows};
}

const api={parseReport,mergeReports,toIso,toNumber};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FuelImport=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
