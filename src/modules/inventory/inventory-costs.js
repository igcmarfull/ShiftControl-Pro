/* Costos de compra y margen por producto (Inventarios, solo administrador).
   Carga las líneas de una factura de proveedor (producto neto, flete e impuesto específico, sin IVA), calcula el
   costo real por unidad y lo compara con el precio de venta promedio del POS (con IVA → se divide por 1,19). */
(function(){
'use strict';

const IVA=1.19;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Number(n||0).toLocaleString('es-CL');
const money=n=>{const v=Math.round(Number(n||0));return (v<0?'-':'')+'$'+Math.abs(v).toLocaleString('es-CL')};
const pct=n=>(Math.round(n*10)/10).toLocaleString('es-CL')+'%';
const A=()=>window.InventoryApi;
const ui=()=>window.InventoryUI?.state||{};
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const dmy=iso=>String(iso||'').slice(0,10).split('-').reverse().join('-');
const todayIso=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const norm=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

const S={open:false,busy:false,tab:'costs',code:'',inv:null,rows:[],products:[],message:'',q:'',only:'all',
  hist:{},histOpen:null,form:null,notice:''};

/* ------------------------------------------------------------ cálculo */
// Margen sobre el precio de venta neto (sin IVA) contra el costo real por unidad.
function margin(row){
  const price=Number(row.price_gross);
  if(!(price>0)||row.unit_total==null)return null;
  const net=price/IVA;
  const cost=Number(row.unit_total);
  return {net,cost,amount:net-cost,pct:(net-cost)/net*100};
}
function lineUnit(line,product){
  const factor=line.unit==='purchase'&&product?Number(product.receive_factor)||1:1;
  const qty=Number(line.qty)*factor;
  const net=Number(line.net)||0;
  const freight=Number(line.freight)||0;
  const tax=Number(line.tax)||0;
  if(!(qty>0)||!(net>0))return null;
  return {qty,total:(net+freight+tax)/qty,net:net/qty,freight:freight/qty,tax:tax/qty};
}
// Reparte un flete total entre las líneas según su neto; la última absorbe el redondeo.
function prorate(freight,lines){
  const withNet=lines.filter(line=>Number(line.net)>0);
  const sum=withNet.reduce((total,line)=>total+Number(line.net),0);
  const out=new Map();
  if(!(freight>0)||!sum)return out;
  let left=Math.round(freight);
  withNet.forEach((line,index)=>{
    const part=index===withNet.length-1?left:Math.round(freight*Number(line.net)/sum);
    out.set(line,part);left-=part;
  });
  return out;
}

/* ------------------------------------------------------------ datos */
async function loadRows(){
  S.busy=true;S.message='';render();
  try{
    S.rows=await A().costsOverview(companyId(),S.inv.id)||[];
  }catch(error){
    S.message=error?.message||'No se pudieron leer los costos.';
  }finally{S.busy=false;render()}
}
async function loadProducts(){
  try{S.products=(await A().products(S.inv.id)||[]).filter(product=>product.active)}catch(_error){S.products=[]}
}

/* ------------------------------------------------------------ pantalla */
function root(){
  let element=document.getElementById('invCostsRoot');
  if(!element){element=document.createElement('div');element.id='invCostsRoot';document.body.appendChild(element)}
  return element;
}
function frame(inner){
  root().innerHTML=`<div class="ct-ov" data-ct="bg"><div class="ct-m" role="dialog" aria-label="Costos de ${esc(S.inv.name)}">${inner}</div></div>`;
}
function head(){
  const withCost=S.rows.filter(row=>row.unit_total!=null).length;
  return `<div class="ct-top"><div><h3>Costos · ${esc(S.inv.name)}</h3><p class="ct-sub">Costo real por unidad, sin IVA: producto neto + flete + impuesto específico. El margen compara con el precio de venta del POS sin IVA.</p></div><button type="button" class="inv-btn sm" data-ct="close" aria-label="Cerrar">×</button></div>
    <div class="ct-tabs"><button type="button" class="ct-tab ${S.tab==='costs'?'on':''}" data-ct="tab:costs">Costos y margen${S.rows.length?` <b>${withCost}/${S.rows.length}</b>`:''}</button><button type="button" class="ct-tab ${S.tab==='load'?'on':''}" data-ct="tab:load">Cargar factura</button></div>
    ${S.notice?`<p class="ct-ok">${esc(S.notice)}</p>`:''}${S.message?`<p class="ct-err">${esc(S.message)}</p>`:''}`;
}
function costCell(row){
  if(row.unit_total==null)return '<span class="ct-none">Sin costo</span>';
  const parts=[`neto ${money(row.unit_net)}`];
  if(Number(row.unit_freight)>0)parts.push(`flete ${money(row.unit_freight)}`);
  if(Number(row.unit_tax)>0)parts.push(`imp. ${money(row.unit_tax)}`);
  const prev=row.prev_unit_total!=null?Number(row.prev_unit_total):null;
  const delta=prev?((Number(row.unit_total)-prev)/prev*100):null;
  const arrow=delta==null||Math.abs(delta)<0.05?'':`<small class="ct-d ${delta>0?'up':'dn'}">${delta>0?'▲':'▼'} ${pct(Math.abs(delta))} vs. compra anterior</small>`;
  return `<b>${money(row.unit_total)}</b><small>${esc(parts.join(' + '))}</small>${arrow}`;
}
function marginCell(row){
  const m=margin(row);
  if(row.price_gross==null)return '<span class="ct-none">Sin ventas (60 días)</span>';
  if(!m)return `<b>${money(Number(row.price_gross)/IVA)}</b><small>precio neto · falta el costo</small>`;
  return `<b class="${m.amount<0?'neg':''}">${money(m.amount)} <i>${pct(m.pct)}</i></b><small>precio neto ${money(m.net)}</small>`;
}
function historyHtml(productId){
  const list=S.hist[productId];
  if(!list)return '<div class="ct-hist"><small>Cargando…</small></div>';
  if(!list.length)return '<div class="ct-hist"><small>Sin compras registradas.</small></div>';
  return `<div class="ct-hist">${list.map(item=>`<div class="ct-hr ${item.voided_at?'void':''}"><span>${dmy(item.bought_on)}</span><span>${esc(item.supplier)} · ${esc(item.document_no)}</span><span>${fmt(item.qty_base)} u.</span><span>${money(item.unit_total)} /u.</span>${item.voided_at?`<em>anulada${item.void_reason?`: ${esc(item.void_reason)}`:''}</em>`:`<button type="button" class="ct-lnk" data-ct="void:${item.id}">Anular</button>`}</div>`).join('')}</div>`;
}
function costsTab(){
  const q=norm(S.q);
  let rows=S.rows.filter(row=>!q||norm(`${row.name} ${row.presentation} ${row.code} ${row.category}`).includes(q));
  if(S.only==='nocost')rows=rows.filter(row=>row.unit_total==null);
  if(S.only==='neg')rows=rows.filter(row=>{const m=margin(row);return m&&m.amount<0});
  const avg=(()=>{const list=S.rows.map(margin).filter(Boolean);return list.length?list.reduce((s,m)=>s+m.pct,0)/list.length:null})();
  const noCost=S.rows.filter(row=>row.unit_total==null).length;
  const negative=S.rows.filter(row=>{const m=margin(row);return m&&m.amount<0}).length;
  const body=rows.map(row=>`<div class="ct-r"><div class="ct-p"><b>${esc(row.name)}</b><small>${esc([row.presentation,row.code].filter(Boolean).join(' · '))}</small></div>
      <div class="ct-n">${costCell(row)}</div><div class="ct-n">${marginCell(row)}</div>
      <div class="ct-n"><small>${row.bought_on?`${dmy(row.bought_on)}<br>${esc(row.supplier)}`:'—'}</small><button type="button" class="ct-lnk" data-ct="hist:${row.product_id}">${S.histOpen===row.product_id?'Ocultar':'Historial'}</button></div></div>${S.histOpen===row.product_id?historyHtml(row.product_id):''}`).join('');
  return `<div class="ct-sum"><span>${fmt(S.rows.length-noCost)} de ${fmt(S.rows.length)} con costo</span>${avg!=null?`<span class="g">Margen promedio ${pct(avg)}</span>`:''}${negative?`<span class="r">${fmt(negative)} con margen negativo</span>`:''}</div>
    <div class="ct-tools"><input type="search" id="ctQ" placeholder="Buscar producto o código" value="${esc(S.q)}" autocomplete="off"><select id="ctOnly" aria-label="Filtrar"><option value="all">Todos</option><option value="nocost"${S.only==='nocost'?' selected':''}>Sin costo (${noCost})</option><option value="neg"${S.only==='neg'?' selected':''}>Margen negativo (${negative})</option></select></div>
    <div class="ct-t"><div class="ct-h"><span>Producto</span><span>Costo real por unidad</span><span>Margen</span><span>Última compra</span></div>${body||`<p class="ct-empty">${S.busy?'Cargando…':'No hay productos que coincidan.'}</p>`}</div>
    <p class="ct-note">Precio de venta: promedio ponderado de los últimos 60 días del POS. Margen = precio neto − costo real, y el % es sobre el precio neto.</p>`;
}

function newLine(){return {pid:'',qty:'',unit:'base',net:'',freight:'',tax:''}}
function loadTab(){
  const form=S.form;
  const suppliers=[...new Set([...S.rows.map(row=>row.supplier),...(window.InvoiceModule?.getAll?.()||[]).map(entry=>entry.proveedor)].filter(Boolean))];
  const lines=form.lines.map((line,index)=>{
    const product=S.products.find(entry=>entry.id===line.pid);
    const purchase=product&&product.receive_unit;
    const unit=lineUnit(line,product);
    return `<div class="ct-ln"><select data-cl="${index}:pid" aria-label="Producto"><option value="">Producto…</option>${S.products.map(entry=>`<option value="${entry.id}"${entry.id===line.pid?' selected':''}>${esc(entry.name)}${entry.presentation?` · ${esc(entry.presentation)}`:''}</option>`).join('')}</select>
      <label class="ct-f1 ct-q"><span>Cantidad</span><input type="number" min="1" step="1" inputmode="numeric" placeholder="Cant." data-cl="${index}:qty" value="${esc(line.qty)}" aria-label="Cantidad"></label>
      <label class="ct-f1 ct-u"><span>Unidad</span><select data-cl="${index}:unit" aria-label="Unidad"${purchase?'':' disabled'}><option value="base"${line.unit==='base'?' selected':''}>${esc(product?(product.control_unit||'unidad'):'Unidades')}</option>${purchase?`<option value="purchase"${line.unit==='purchase'?' selected':''}>${esc(product.receive_unit)} (×${fmt(product.receive_factor)})</option>`:''}</select></label>
      <label class="ct-f1 ct-nt"><span>Neto $</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="Neto $" data-cl="${index}:net" value="${esc(line.net)}" aria-label="Monto neto"></label>
      <label class="ct-f1 ct-fr"><span>Flete $</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="Flete $" data-cl="${index}:freight" value="${esc(line.freight)}" aria-label="Flete"></label>
      <label class="ct-f1 ct-tx"><span>Impuesto $</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="Imp. $" data-cl="${index}:tax" value="${esc(line.tax)}" aria-label="Impuesto específico"></label>
      <button type="button" class="inv-btn sm ct-del" data-ct="line-del:${index}" aria-label="Quitar línea"${form.lines.length<2?' disabled':''}>×</button>
      <div class="ct-res" id="ctRes-${index}">${unit?`${fmt(unit.qty)} u. → <b>${money(unit.total)}</b> por unidad`:''}</div></div>`;
  }).join('');
  return `<div class="ct-g"><label>Proveedor<input id="ctSupplier" list="ctSuppliers" autocomplete="off" value="${esc(form.supplier)}"><datalist id="ctSuppliers">${suppliers.map(name=>`<option value="${esc(name)}">`).join('')}</datalist></label>
      <label>N.º de factura<input id="ctDoc" autocomplete="off" placeholder="Ej.: 97817001" value="${esc(form.doc)}"></label>
      <label>Fecha de la factura<input id="ctDate" type="date" max="${todayIso()}" value="${esc(form.date)}"></label>
      <label>Flete total (opcional)<input id="ctFreight" type="number" min="0" step="1" inputmode="numeric" placeholder="Se reparte según el neto" value="${esc(form.freight)}"></label></div>
    <p class="ct-note">Todos los montos van <b>sin IVA</b>. El «Neto» es el valor de la línea de la factura (ya descontado). Si la factura trae flete o impuesto específico (ILA, tabaco) escríbelo en su columna; el flete total de arriba se reparte solo entre las líneas que no tengan flete propio.</p>
    <div class="ct-lh"><span>Producto</span><span>Cant.</span><span>Unidad</span><span>Neto</span><span>Flete</span><span>Impuesto</span><span></span></div>
    <div id="ctLines">${lines}</div>
    <button type="button" class="inv-btn sm" data-ct="line-add">+ Agregar producto</button>
    <div class="ct-f"><span class="ct-tot" id="ctTotals">${totalsHtml()}</span><div class="ct-fa"><button type="button" class="inv-btn" data-ct="tab:costs">Cancelar</button><button type="button" class="inv-btn pri" data-ct="save"${S.busy?' disabled':''}>${S.busy?'Guardando…':'Guardar costos'}</button></div></div>`;
}
function totalsHtml(){
  const lines=S.form.lines.filter(line=>line.pid&&Number(line.net)>0);
  const split=prorate(Number(S.form.freight)||0,lines.filter(line=>line.freight===''));
  const sum=lines.reduce((t,line)=>({net:t.net+Number(line.net),fr:t.fr+(line.freight===''?(split.get(line)||0):Number(line.freight)||0),tax:t.tax+(Number(line.tax)||0)}),{net:0,fr:0,tax:0});
  return lines.length?`${plural(lines.length)} · neto ${money(sum.net)} + flete ${money(sum.fr)} + imp. ${money(sum.tax)} = <b>${money(sum.net+sum.fr+sum.tax)}</b> (sin IVA)`:'';
}
const plural=n=>`${n} ${n===1?'línea':'líneas'}`;

function render(){
  if(!S.open){root().innerHTML='';return}
  frame(`${head()}${S.tab==='load'&&S.form?loadTab():costsTab()}`);
}

/* ------------------------------------------------------------ acciones */
async function showHistory(productId){
  if(S.histOpen===productId){S.histOpen=null;render();return}
  S.histOpen=productId;render();
  try{S.hist[productId]=await A().costHistory(companyId(),productId)||[]}catch(error){S.hist[productId]=[];S.message=error?.message||'No se pudo leer el historial.'}
  render();
}
async function voidCost(costId){
  const reason=window.prompt('Motivo para anular esta compra (por ejemplo, «monto mal digitado»):');
  if(reason==null)return;
  if(!reason.trim()){S.message='Escribe el motivo para anular.';render();return}
  S.busy=true;S.message='';render();
  try{
    await A().voidCost(companyId(),costId,reason.trim());
    S.hist={};S.notice='Compra anulada.';
    S.rows=await A().costsOverview(companyId(),S.inv.id)||[];
    if(S.histOpen){S.hist[S.histOpen]=await A().costHistory(companyId(),S.histOpen)||[]}
  }catch(error){S.message=error?.message||'No se pudo anular.'}
  finally{S.busy=false;render()}
}
async function openLoad(){
  S.tab='load';S.notice='';S.message='';
  S.form={supplier:'',doc:'',date:todayIso(),freight:'',lines:[newLine()]};
  render();
  await loadProducts();
  render();
}
async function save(){
  const form=S.form;
  if(!form||S.busy)return;
  form.supplier=document.getElementById('ctSupplier')?.value.trim()||form.supplier;
  const lines=form.lines.filter(line=>line.pid||line.qty||line.net);
  if(!form.supplier){S.message='Indica el proveedor.';render();return}
  if(!form.doc.trim()){S.message='Indica el número de factura.';render();return}
  if(!lines.length){S.message='Agrega al menos un producto.';render();return}
  const bad=lines.find(line=>!line.pid||!(Number(line.qty)>0)||!(Number(line.net)>0));
  if(bad){S.message='Cada línea necesita producto, cantidad y monto neto.';render();return}
  const split=prorate(Number(form.freight)||0,lines.filter(line=>line.freight===''));
  S.busy=true;S.message='';render();
  try{
    const result=await A().registerCosts(companyId(),S.inv.id,
      {supplier:form.supplier,document_no:form.doc.trim(),bought_on:form.date||null},
      lines.map(line=>({product_id:line.pid,qty:Number(line.qty),unit:line.unit,net:Number(line.net),
        freight:line.freight===''?(split.get(line)||0):Number(line.freight),tax:Number(line.tax)||0})));
    S.tab='costs';S.form=null;S.hist={};S.histOpen=null;
    S.notice=`Costos guardados: ${plural(result.lines)} de la factura ${result.document_no}.`;
    S.busy=false;
    await loadRows();
  }catch(error){
    S.busy=false;
    S.message=error?.message||'No se pudieron guardar los costos.';
    render();
  }
}
function close(){S.open=false;render()}
async function open(code){
  const item=(ui().overview?.inventories||[]).find(entry=>entry.code===code);
  if(!A()||!companyId()||!item||ui().role!=='ADMIN'){alert('Los costos solo están disponibles para el administrador.');return}
  Object.assign(S,{open:true,busy:false,tab:'costs',code,inv:item,rows:[],message:'',notice:'',q:'',only:'all',hist:{},histOpen:null,form:null});
  await loadRows();
}

document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-act="costs"]');
  if(trigger){open(trigger.dataset.code);return}
  const target=event.target.closest('[data-ct]');
  if(!target||!S.open)return;
  const [action,arg]=target.dataset.ct.split(':');
  if(action==='bg'){if(event.target===target&&!S.busy)close();return}
  if(S.busy&&action!=='bg')return;
  if(action==='close')close();
  else if(action==='tab'){
    if(arg==='load')openLoad();
    else{S.tab='costs';S.form=null;S.message='';render()}
  }
  else if(action==='hist')showHistory(arg);
  else if(action==='void')voidCost(arg);
  else if(action==='line-add'){S.form.lines.push(newLine());render()}
  else if(action==='line-del'){S.form.lines.splice(Number(arg),1);render()}
  else if(action==='save')save();
});
document.addEventListener('input',event=>{
  if(!S.open)return;
  const target=event.target;
  if(target.id==='ctQ'){
    S.q=target.value;
    const pos=target.selectionStart;
    render();
    const field=document.getElementById('ctQ');
    if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch(_error){}}
    return;
  }
  const form=S.form;
  if(!form||S.tab!=='load')return;
  if(target.id==='ctSupplier')form.supplier=target.value;
  else if(target.id==='ctDoc')form.doc=target.value;
  else if(target.id==='ctDate')form.date=target.value;
  else if(target.id==='ctFreight'){form.freight=target.value;const holder=document.getElementById('ctTotals');if(holder)holder.innerHTML=totalsHtml()}
  else if(target.dataset.cl){
    const [index,key]=target.dataset.cl.split(':');
    const line=form.lines[Number(index)];
    line[key]=target.value;
    if(key==='pid'){line.unit='base';render();return}
    if(key==='unit'){render();return}
    const product=S.products.find(entry=>entry.id===line.pid);
    const unit=lineUnit(line,product);
    const holder=document.getElementById(`ctRes-${index}`);
    if(holder)holder.innerHTML=unit?`${fmt(unit.qty)} u. → <b>${money(unit.total)}</b> por unidad`:'';
    const totals=document.getElementById('ctTotals');
    if(totals)totals.innerHTML=totalsHtml();
  }
});
document.addEventListener('change',event=>{
  if(S.open&&event.target&&event.target.id==='ctOnly'){S.only=event.target.value;render()}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&S.open&&!S.busy)close()});

window.InventoryCosts={open,margin,lineUnit,prorate,state:S};
})();
