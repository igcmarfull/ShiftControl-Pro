/* Importar el informe de ventas del POS (Excel) y descontar el stock.
   Lee el .xlsx en el navegador, muestra una vista previa y aplica las ventas
   con inv_apply_sales (que evita descontar dos veces el mismo día). */
(function(){
'use strict';

const SHEETJS_URL='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const MAX_BYTES=8*1024*1024;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Number(n||0).toLocaleString('es-CL');
const A=()=>window.InventoryApi;
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const dmy=iso=>iso.split('-').reverse().join('-');

let libPromise=null;
function loadLib(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!libPromise){
    libPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=SHEETJS_URL;
      script.onload=()=>resolve(window.XLSX);
      script.onerror=()=>{libPromise=null;reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.'))};
      document.head.appendChild(script);
    });
  }
  return libPromise;
}

/* ------------------------------------------------------------ lectura */
function isoOf(value){
  if(value instanceof Date&&!isNaN(value)){
    const pad=n=>String(n).padStart(2,'0');
    return `${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}`;
  }
  const text=String(value??'').trim();
  const match=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(text);
  if(match)return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso?iso[0]:'';
}
const norm=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

async function readFile(file){
  const XLSX=await loadLib();
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});
  // Busca la fila de títulos del informe de ventas por artículo.
  const headerAt=rows.findIndex(row=>row&&row.some(cell=>norm(cell)==='codigo')&&row.some(cell=>norm(cell)==='cantidad')&&row.some(cell=>norm(cell).startsWith('fecha')));
  if(headerAt<0)throw new Error('No reconozco este archivo. Sube el «Informe de Ventas por Artículos» tal como sale del POS.');
  const head=rows[headerAt].map(norm);
  const col={date:head.findIndex(cell=>cell.startsWith('fecha')),code:head.indexOf('codigo'),name:head.indexOf('descripcion'),qty:head.indexOf('cantidad')};
  const map=new Map();
  let skipped=0;
  rows.slice(headerAt+1).forEach(row=>{
    if(!row)return;
    const code=String(row[col.code]??'').trim();
    const qty=Number(row[col.qty]);
    const date=isoOf(row[col.date]);
    if(!code||!date||!Number.isFinite(qty)){if(code||date)skipped++;return}
    if(qty<=0||!Number.isInteger(qty)){skipped++;return}
    const key=`${date}|${code}`;
    const entry=map.get(key)||{date,code,name:col.name>=0?String(row[col.name]??''):'',qty:0};
    entry.qty+=qty;
    map.set(key,entry);
  });
  const lines=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code));
  if(!lines.length)throw new Error('El archivo no trae ventas con fecha, código y cantidad.');
  return {lines,skipped};
}

/* ------------------------------------------------------------- estado */
const S={open:false,busy:false,step:'pick',message:'',file:'',parsed:null,products:new Map(),machineCodes:new Set(),existing:new Map(),existingMachine:new Map(),preview:null,result:null,requestId:null};
const isAdmin=()=>(typeof window.getAppRole==='function'?window.getAppRole():'')==='admin';

async function loadProducts(){
  const overview=await A().overview(companyId());
  const inventories=(overview?.inventories||[]).filter(inv=>inv.active);
  const lists=await Promise.all(inventories.map(inv=>A().products(inv.id).then(rows=>(rows||[]).map(row=>({...row,inventory_id:inv.id,inventory:inv.name})))));
  S.products=new Map(lists.flat().filter(product=>product.active).map(product=>[String(product.code),product]));
}
async function loadMachineCodes(){
  S.machineCodes=new Set();
  try{
    const response=await client().from('coffee_machine_codes').select('pos_code').eq('company_id',companyId());
    if(!response.error)(response.data||[]).forEach(row=>S.machineCodes.add(String(row.pos_code)));
  }catch(_error){}
}
async function loadExisting(from,to){
  S.existing=new Map();
  S.existingMachine=new Map();
  try{
    const machine=await client().from('coffee_sales').select('sold_on, pos_code, qty').eq('company_id',companyId()).gte('sold_on',from).lte('sold_on',to);
    if(!machine.error)(machine.data||[]).forEach(row=>S.existingMachine.set(`${row.sold_on}|${row.pos_code}`,row.qty));
  }catch(_error){}
  const response=await client().from('inv_sales_lines').select('sold_on, pos_code, qty_reported').eq('company_id',companyId()).gte('sold_on',from).lte('sold_on',to);
  if(response.error)throw response.error;
  (response.data||[]).forEach(row=>S.existing.set(`${row.sold_on}|${row.pos_code}`,row.qty_reported));
}

function buildPreview(){
  const lines=S.parsed.lines;
  const preview={matched:[],noProduct:{lines:0,units:0},already:0,changed:0,byProduct:new Map(),machine:{lines:0,units:0},byMachine:new Map(),byOther:new Map()};
  lines.forEach(line=>{
    if(S.machineCodes.has(line.code)){
      const key=`${line.date}|${line.code}`;
      if(S.existingMachine.has(key)){if(S.existingMachine.get(key)===line.qty)preview.already++;else preview.changed++;return}
      preview.machine.lines++;preview.machine.units+=line.qty;
      const mk=preview.byMachine.get(line.code)||{code:line.code,name:line.name,qty:0,days:0};mk.qty+=line.qty;mk.days++;preview.byMachine.set(line.code,mk);
      return;
    }
    const product=S.products.get(line.code);
    if(!product){preview.noProduct.lines++;preview.noProduct.units+=line.qty;const ok=preview.byOther.get(line.code)||{code:line.code,name:line.name,qty:0};ok.qty+=line.qty;preview.byOther.set(line.code,ok);return}
    const key=`${line.date}|${line.code}`;
    if(S.existing.has(key)){if(S.existing.get(key)===line.qty)preview.already++;else preview.changed++;return}
    preview.matched.push(line);
    const entry=preview.byProduct.get(product.id)||{product,qty:0,days:0};
    entry.qty+=line.qty;entry.days++;
    preview.byProduct.set(product.id,entry);
  });
  preview.products=[...preview.byProduct.values()].sort((a,b)=>b.qty-a.qty);
  preview.machines=[...preview.byMachine.values()].sort((a,b)=>b.qty-a.qty);
  preview.others=[...preview.byOther.values()].sort((a,b)=>b.qty-a.qty);
  preview.units=preview.matched.reduce((sum,line)=>sum+line.qty,0);
  preview.short=preview.products.filter(entry=>entry.qty>Number(entry.product.stock||0)).length;
  S.preview=preview;
}

/* ------------------------------------------------------------ pantalla */
function root(){
  let element=document.getElementById('invSalesRoot');
  if(!element){element=document.createElement('div');element.id='invSalesRoot';document.body.appendChild(element)}
  return element;
}
function frame(inner){
  root().innerHTML=`<div class="sv-ov" data-sv="bg"><div class="sv-m" role="dialog" aria-label="Importar ventas">${inner}</div></div>`;
}
function render(){
  if(!S.open){root().innerHTML='';return}
  if(S.step==='pick'){
    frame(`<h3>Importar ventas del POS</h3>
      <p class="sv-sub">Sube el «Informe de Ventas por Artículos» en Excel. Se descuenta del stock lo vendido de los productos que ya existen en Inventarios; el resto se ignora.</p>
      ${S.message?`<p class="sv-err">${esc(S.message)}</p>`:''}
      <label class="sv-drop"><input type="file" id="svFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden><b>${S.busy?'Leyendo el archivo…':'Elegir archivo Excel'}</b><small>.xlsx · hasta 8 MB</small></label>
      <div class="sv-f"><span></span><button type="button" class="inv-btn" data-sv="close">Cancelar</button></div>`);
    return;
  }
  if(S.step==='preview'){
    const pv=S.preview;
    const dates=[...new Set(S.parsed.lines.map(line=>line.date))].sort();
    const range=dates.length>1?`${dmy(dates[0])} al ${dmy(dates[dates.length-1])}`:dmy(dates[0]);
    const rows=pv.products.slice(0,60).map(entry=>{
      const stock=Number(entry.product.stock||0);
      const left=stock-entry.qty;
      return `<div class="sv-r"><div><b>${esc(entry.product.name)}</b><small>${esc(entry.product.inventory)} · código ${esc(entry.product.code)}</small></div><div class="sv-n"><b>${fmt(entry.qty)}</b><small>vendidas</small></div><div class="sv-n"><b>${fmt(stock)}</b><small>stock ahora</small></div><div class="sv-n ${left<0?'bad':''}"><b>${left<0?`faltan ${fmt(-left)}`:fmt(left)}</b><small>${left<0?'quedaría en 0':'quedaría'}</small></div></div>`;
    }).join('');
    const machineRows=pv.machines.map(m=>`<div class="sv-r"><div><b>${esc(m.name||'Café')}</b><small>Máquina de café · código ${esc(m.code)}</small></div><div class="sv-n"><b>${fmt(m.qty)}</b><small>vasos</small></div><div class="sv-n"><b>${fmt(m.days)}</b><small>${m.days===1?'día':'días'}</small></div><div class="sv-n"><b>—</b><small>sin stock</small></div></div>`).join('');
    const otherRows=pv.others.slice(0,15).map(o=>`<div class="sv-r"><div><b>${esc(o.name||'Sin nombre')}</b><small>Sin producto · código ${esc(o.code)}</small></div><div class="sv-n"><b>${fmt(o.qty)}</b><small>vendidas</small></div><div class="sv-n"><b>—</b><small>se ignora</small></div><div class="sv-n"><b>—</b><small></small></div></div>`).join('');
    frame(`<h3>Importar ventas del POS</h3>
      <p class="sv-sub">${esc(S.file)} · ventas del ${esc(range)}</p>
      <div class="sv-sum"><span class="g">● ${fmt(pv.matched.length)} líneas con producto (${fmt(pv.units)} unidades)</span>
        ${pv.machine.lines?`<span class="g">${fmt(pv.machine.lines)} líneas de máquinas de café (${fmt(pv.machine.units)} vasos, solo para cuadrar el numeral)</span>`:''}<span>${fmt(pv.noProduct.lines)} sin producto en Inventarios (se ignoran)</span>
        ${pv.already?`<span>${fmt(pv.already)} ya cargadas</span>`:''}${pv.changed?`<span class="o">${fmt(pv.changed)} con otra cantidad (no se tocan)</span>`:''}
        ${pv.short?`<span class="r">${fmt(pv.short)} productos sin stock suficiente</span>`:''}</div>
      ${pv.products.length?`<div class="sv-t"><div class="sv-h"><span>Producto</span><span>Vendidas</span><span>Stock</span><span>Resultado</span></div>${rows}${pv.products.length>60?`<div class="sv-r"><small>… y ${pv.products.length-60} productos más</small></div>`:''}</div>`
        :'<p class="sv-note">Ninguna línea nueva coincide con un producto de Inventarios. Revisa que los productos tengan el código del POS.</p>'}
      ${pv.machines.length?`<div class="sv-t"><div class="sv-h"><span>Café (solo cuadra el numeral)</span><span>Vasos</span><span>Días</span><span></span></div>${machineRows}</div>`:''}
      ${pv.others.length?`<details class="sv-note"><summary>${fmt(pv.others.length)} códigos sin producto (se ignoran) — revisa si falta algún café</summary><div class="sv-t">${otherRows}${pv.others.length>15?`<div class="sv-r"><small>… y ${pv.others.length-15} más</small></div>`:''}</div></details>`:''}
      <p class="sv-note">Se ignoran las ventas hasta el día del saldo inicial de cada producto (ese conteo ya las incluye). Si el stock no alcanza, se descuenta hasta cero y se avisa la diferencia.</p>
      ${S.message?`<p class="sv-err">${esc(S.message)}</p>`:''}
      <div class="sv-f"><span></span><div class="sv-fa"><button type="button" class="inv-btn" data-sv="close">Cancelar</button><button type="button" class="inv-btn pri" data-sv="apply" ${(pv.matched.length||pv.machine.lines)&&!S.busy?'':'disabled'}>${S.busy?'Descontando…':(pv.units?`Descontar ${fmt(pv.units)} unidades`:'Registrar las ventas')}</button></div></div>`);
    return;
  }
  const r=S.result;
  const shorts=(r.shortfalls||[]).slice(0,12).map(item=>`<div class="sv-r"><div><b>${esc(item.name)}</b><small>${esc(dmy(item.date))} · código ${esc(item.code)}</small></div><div class="sv-n bad"><b>faltaron ${fmt(item.sold-item.applied)}</b><small>de ${fmt(item.sold)} vendidas</small></div></div>`).join('');
  frame(`<h3>Ventas descontadas</h3>
    <p class="sv-sub">${fmt(r.applied_lines)} líneas · ${fmt(r.units_applied)} unidades descontadas del stock.</p>
    <div class="sv-sum">${r.already?`<span>${fmt(r.already)} ya estaban cargadas</span>`:''}${r.machine_lines?`<span class="g">${fmt(r.machine_lines)} líneas de máquinas de café registradas (${fmt(r.machine_units)} vasos)</span>`:''}${r.no_product?`<span>${fmt(r.no_product)} sin producto (ignoradas)</span>`:''}${r.before_opening?`<span>${fmt(r.before_opening)} anteriores al saldo inicial (ignoradas)</span>`:''}${r.no_access?`<span>${fmt(r.no_access)} de otra área (ignoradas)</span>`:''}${(r.changed||[]).length?`<span class="o">${r.changed.length} con otra cantidad (no se tocaron)</span>`:''}</div>
    ${(r.shortfalls||[]).length?`<p class="sv-note">El stock no alcanzó para ${r.shortfalls.length} ${r.shortfalls.length===1?'línea':'líneas'}: se descontó hasta cero. Suele indicar un saldo inicial o una recepción sin cargar.</p><div class="sv-t">${shorts}${r.shortfalls.length>12?`<div class="sv-r"><small>… y ${r.shortfalls.length-12} más</small></div>`:''}</div>`:''}
    <div class="sv-f"><span></span><button type="button" class="inv-btn pri" data-sv="close">Listo</button></div>`);
}

/* ------------------------------------------------------------- acciones */
async function onFile(file){
  if(!file||S.busy)return;
  if(file.size>MAX_BYTES){S.message='El archivo supera los 8 MB.';render();return}
  S.busy=true;S.message='';render();
  try{
    S.file=file.name;
    S.parsed=await readFile(file);
    await loadProducts();
    await loadMachineCodes();
    const dates=S.parsed.lines.map(line=>line.date).sort();
    try{await loadExisting(dates[0],dates[dates.length-1])}catch(_error){S.existing=new Map()}
    buildPreview();
    S.step='preview';
  }catch(error){
    S.message=error?.message||'No se pudo leer el archivo.';
  }finally{S.busy=false;render()}
}
async function apply(){
  if(S.busy||!(S.preview?.matched.length||S.preview?.machine.lines))return;
  S.busy=true;S.message='';render();
  if(!S.requestId)S.requestId=A().uuid();
  try{
    S.result=await A().applySales(S.requestId,companyId(),S.parsed.lines.map(line=>({date:line.date,code:line.code,qty:line.qty})));
    S.step='done';
    S.requestId=null;
    try{window.dispatchEvent(new CustomEvent('inventory:changed'))}catch(_error){}
  }catch(error){
    S.message=error?.message||'No se pudieron descontar las ventas.';
  }finally{S.busy=false;render()}
}
function close(){S.open=false;render()}
function open(){
  if(!A()||!companyId()){alert('Inventarios no está disponible.');return}
  Object.assign(S,{open:true,busy:false,step:'pick',message:'',file:'',parsed:null,preview:null,result:null,requestId:null});
  render();
}

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-sv],[data-act="sales-import"]');
  if(!target)return;
  if(target.dataset.act==='sales-import'){open();return}
  if(!S.open)return;
  const action=target.dataset.sv;
  if(action==='bg'){if(event.target===target&&!S.busy)close();return}
  if(action==='close'&&!S.busy)close();
  if(action==='apply')apply();
});
document.addEventListener('change',event=>{
  if(S.open&&event.target&&event.target.id==='svFile')onFile(event.target.files&&event.target.files[0]);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&S.open&&!S.busy)close()});

window.InventorySales={open,readFile,state:S};
})();
