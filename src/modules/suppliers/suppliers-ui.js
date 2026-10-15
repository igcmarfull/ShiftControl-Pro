(function(){
'use strict';

// Pantalla «Proveedores»: lista, ficha, formulario, logo e importación desde las facturas.
// Los datos viven en SupplierModule (tabla public.suppliers); aquí solo se dibuja y se llama a sus funciones.

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cash=value=>typeof window.money==='function'?window.money(value):'$'+Math.round(Number(value)||0).toLocaleString('es-CL');
const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};
const isAdmin=()=>window.ShiftControlPermissions?.getRole?.()==='ADMIN';
const mobile=()=>window.matchMedia('(max-width:820px)').matches;
const PAY_METHODS=['Transferencia','Efectivo','Cheque','Tarjeta','Otro'];
const CREDIT_PRESETS=[['','Sin definir'],['0','Contado'],['7','7 días'],['15','15 días'],['30','30 días'],['45','45 días'],['60','60 días'],['90','90 días']];
const TONES=['var(--blue)','var(--purple)','var(--green)','var(--orange)','var(--red)','var(--yellow)'];

const U={selected:null,tab:'todos',q:'',sheet:false,ready:false};
let layer=null;

/* ------------------------------------------------------------- cálculos */
function today(){
  return typeof window.invoiceTodayMidnight==='function'?window.invoiceTodayMidnight():(()=>{const d=new Date();d.setHours(0,0,0,0);return d})();
}
const daysLeft=invoice=>Math.ceil((new Date(`${invoice.fechaVencimiento}T00:00:00`)-today())/86400000);
const approved=invoice=>typeof window.invoiceIsApproved==='function'?window.invoiceIsApproved(invoice):true;
function statsOf(supplier){
  const invoices=window.SupplierModule.invoicesOf(supplier);
  const pending=invoices.filter(invoice=>invoice.estado==='pendiente'&&approved(invoice));
  const due=pending.reduce((total,invoice)=>total+Number(invoice.montoTotal||0),0);
  const dated=pending.filter(invoice=>invoice.fechaVencimiento);
  const worst=dated.length?Math.min(...dated.map(daysLeft)):null;
  const prefix=typeof window.invoicePaymentPrefix==='function'?window.invoicePaymentPrefix():'';
  const month=invoices.filter(invoice=>(invoice.fechaEmision||'').startsWith(prefix)).reduce((total,invoice)=>total+Number(invoice.montoTotal||0),0);
  let state=['none','Sin pendientes'];
  if(pending.length){
    if(worst!==null&&worst<0)state=['bad',`Vencida hace ${Math.abs(worst)} día${Math.abs(worst)===1?'':'s'}`];
    else if(worst!==null&&worst<=7)state=['soon',worst===0?'Vence hoy':`Vence en ${worst} día${worst===1?'':'s'}`];
    else state=['ok','Al día'];
  }
  return {invoices,pending,due,month,state,overdue:worst!==null&&worst<0};
}
const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
const toneOf=name=>{let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))>>>0;return TONES[h%TONES.length]};
function logo(supplier,large){
  const url=window.SupplierModule.logoUrl(supplier.logo_path);
  const cls=`su-logo${large?' lg':''}`;
  if(url)return `<span class="${cls}"><img src="${esc(url)}" alt="" decoding="async"></span>`;
  return `<span class="${cls} ini" style="--c:${toneOf(supplier.name)}">${esc(initials(supplier.name))}</span>`;
}
function catColor(category){
  let h=0;for(const c of String(category||''))h=(h*31+c.charCodeAt(0))>>>0;
  return TONES[h%TONES.length];
}
function creditLabel(days){
  if(days===null||days===undefined||days==='')return 'Sin definir';
  return Number(days)===0?'Contado':`${days} días`;
}

/* ------------------------------------------------------------- dibujo */
function visible(){
  const q=window.SupplierModule.norm(U.q);
  return window.SupplierModule.list().filter(supplier=>{
    const inactive=!supplier.active;
    if(U.tab==='inactivos')return inactive&&matches(supplier,q);
    if(inactive)return false;
    const stats=statsOf(supplier);
    if(U.tab==='deuda'&&!stats.due)return false;
    if(U.tab==='vencidos'&&!stats.overdue)return false;
    return matches(supplier,q);
  });
}
function matches(supplier,q){
  if(!q)return true;
  return [supplier.name,supplier.rut,supplier.seller_name,supplier.category].some(text=>window.SupplierModule.norm(text).includes(q));
}
function counts(){
  const list=window.SupplierModule.list();
  const active=list.filter(item=>item.active);
  return {todos:active.length,deuda:active.filter(item=>statsOf(item).due>0).length,vencidos:active.filter(item=>statsOf(item).overdue).length,inactivos:list.length-active.length};
}
function kpis(){
  const active=window.SupplierModule.active();
  const stats=active.map(statsOf);
  const cell=(color,icon,value,label)=>`<div class="su-kpi" style="--c:${color}"><i>${icon}</i><div><b>${value}</b><span>${label}</span></div></div>`;
  return `<div class="su-kpis">${cell('var(--blue)','▦',active.length,'Proveedores activos')}${cell('var(--orange)','$',cash(stats.reduce((t,x)=>t+x.due,0)),'Por pagar')}${cell('var(--purple)','↗',cash(stats.reduce((t,x)=>t+x.month,0)),'Comprado este mes')}${cell('var(--red)','!',stats.filter(x=>x.overdue).length,'Con facturas vencidas')}</div>`;
}
function rowHtml(supplier){
  const stats=statsOf(supplier);
  const color=catColor(supplier.category);
  return `<button type="button" class="su-row${U.selected===supplier.id?' on':''}" data-su="row" data-id="${esc(supplier.id)}">${logo(supplier)}<div class="su-nm"><strong>${esc(supplier.name)}</strong><small>${esc([supplier.rut,supplier.seller_name].filter(Boolean).join(' · ')||'Sin datos de contacto')}</small></div>${supplier.category?`<span class="su-cat" style="--c:${color}">${esc(supplier.category)}</span>`:'<span></span>'}<div class="su-cr"><small>Crédito</small><b>${esc(creditLabel(supplier.credit_days))}</b></div><div class="su-due"><b>${cash(stats.due)}</b><small>${stats.pending.length?`${stats.pending.length} factura${stats.pending.length===1?'':'s'}`:'Sin pendientes'}</small></div><span class="su-st ${stats.state[0]}">${esc(stats.state[1])}</span></button>`;
}
function waNumber(phone){
  const digits=String(phone||'').replace(/\D/g,'');
  if(!digits)return '';
  return digits.length===9?`56${digits}`:digits;
}
function fichaHtml(supplier){
  const stats=statsOf(supplier);
  const color=catColor(supplier.category);
  const admin=isAdmin();
  const last=stats.invoices.slice().sort((a,b)=>String(b.fechaEmision||'').localeCompare(String(a.fechaEmision||''))).slice(0,3);
  const phone=String(supplier.phone||'').trim();
  const contact=[
    supplier.seller_name?`<div><span><small>Vendedor</small><b>${esc(supplier.seller_name)}</b></span></div>`:'',
    phone?`<div><span><small>Teléfono</small><b>${esc(phone)}</b></span><a href="tel:${esc(phone.replace(/[^\d+]/g,''))}">Llamar</a>${waNumber(phone)?`<a class="wa" href="https://wa.me/${esc(waNumber(phone))}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`:'',
    supplier.email?`<div><span><small>Correo</small><b>${esc(supplier.email)}</b></span><a href="mailto:${esc(supplier.email)}">Escribir</a></div>`:''
  ].join('');
  return `<div class="su-dh"><button type="button" class="su-logobtn"${admin?' data-su="edit" title="Cambiar logo"':' disabled'} data-id="${esc(supplier.id)}">${logo(supplier,true)}</button><div><h2>${esc(supplier.name)}</h2><p>${esc(supplier.rut||'Sin RUT')}</p><div class="su-chips">${supplier.category?`<span class="su-cat" style="--c:${color}">${esc(supplier.category)}</span>`:''}<span class="su-st ${stats.state[0]}">${esc(stats.state[1])}</span>${supplier.active?'':'<span class="su-st none">Inactivo</span>'}</div></div></div>
    <div class="su-sec"><h4>Contacto</h4>${contact?`<div class="su-ct">${contact}</div>`:'<div class="su-note">Sin datos de contacto todavía.</div>'}</div>
    <div class="su-sec"><h4>Condiciones</h4><div class="su-3"><div><small>Crédito</small><b>${esc(creditLabel(supplier.credit_days))}</b></div><div><small>Pago</small><b>${esc(supplier.payment_method||'—')}</b></div><div><small>Categoría</small><b>${esc(supplier.category||'—')}</b></div></div></div>
    <div class="su-sec"><h4>Resumen</h4><div class="su-3"><div><small>Este mes</small><b>${cash(stats.month)}</b></div><div><small>Por pagar</small><b>${cash(stats.due)}</b></div><div><small>Facturas</small><b>${stats.invoices.length}</b></div></div></div>
    <div class="su-sec"><h4>Últimas facturas</h4>${last.length?`<div class="su-inv">${last.map(invoice=>{const meta=typeof window.invoiceStatusMeta==='function'&&typeof window.invoiceDisplayStatus==='function'?window.invoiceStatusMeta(window.invoiceDisplayStatus(invoice)):null;return `<div><span>${esc(invoice.numeroFactura||'—')}<small>${invoice.fechaVencimiento?`vence ${esc(invoice.fechaVencimiento.split('-').reverse().join('-'))}`:'sin vencimiento'}</small></span><b>${cash(invoice.montoTotal)}</b><span class="su-st ${invoice.estado==='pagada'?'ok':'soon'}">${esc(meta?.label||invoice.estado||'')}</span></div>`}).join('')}</div>`:'<div class="su-note">Aún no hay facturas de este proveedor.</div>'}</div>
    ${supplier.notes?`<div class="su-sec"><h4>Notas</h4><div class="su-note">${esc(supplier.notes)}</div></div>`:''}
    <div class="su-acts">${admin?`<button type="button" class="su-btn" data-su="edit" data-id="${esc(supplier.id)}">Editar</button>`:''}<button type="button" class="su-btn pri" data-su="invoice" data-id="${esc(supplier.id)}">Nueva factura</button></div>`;
}
function render(){
  const root=$('suppliersRoot');
  if(!root)return;
  const M=window.SupplierModule;
  const admin=isAdmin();
  let html;
  const head=`<div class="su-head"><div><h1>Proveedores</h1><p>Contacto, condiciones de pago y compras de cada proveedor.</p></div>${admin&&M.state.status==='ready'?'<div class="su-hbtns"><button type="button" class="su-btn" data-su="import">Importar desde facturas</button><button type="button" class="su-btn pri" data-su="new">＋ Nuevo proveedor</button></div>':''}</div>`;
  if(M.state.status==='unavailable'){
    html=`${head}<div class="su-card su-empty"><strong>Proveedores aún no está habilitado</strong><small>Falta aplicar la migración en el servidor. Mientras tanto, Facturas y compras funciona igual que siempre.</small></div>`;
  }else if(M.state.status==='error'){
    html=`${head}<div class="su-card su-empty"><strong>No se pudieron cargar los proveedores</strong><small>${esc(M.state.error?.message||'Inténtalo de nuevo.')}</small><button type="button" class="su-btn pri" data-su="reload">Reintentar</button></div>`;
  }else if(M.state.status!=='ready'&&!M.list().length){
    html=`${head}<div class="su-card su-empty"><small>Cargando proveedores…</small></div>`;
  }else if(!M.list().length){
    html=`${head}<div class="su-card su-empty"><strong>Aún no hay proveedores</strong><small>${admin?'Puedes crearlos a partir de las facturas que ya tienes o agregar uno nuevo.':'El administrador los crea desde esta pantalla.'}</small>${admin?'<div class="su-hbtns"><button type="button" class="su-btn" data-su="import">Importar desde facturas</button><button type="button" class="su-btn pri" data-su="new">＋ Nuevo proveedor</button></div>':''}</div>`;
  }else{
    const list=visible();
    if(!list.some(item=>item.id===U.selected))U.selected=list[0]?.id||null;
    const selected=M.get(U.selected);
    const c=counts();
    const tab=(key,label)=>`<button type="button" class="${U.tab===key?'on':''}" data-su="tab" data-tab="${key}">${label}<em>${c[key]}</em></button>`;
    html=`${head}${kpis()}<div class="su-main"><div class="su-card"><div class="su-tools"><input class="su-search" id="suSearch" type="search" placeholder="Buscar proveedor, RUT o vendedor…" value="${esc(U.q)}" autocomplete="off"><div class="su-tabs">${tab('todos','Todos')}${tab('deuda','Con deuda')}${tab('vencidos','Vencidos')}${c.inactivos?tab('inactivos','Inactivos'):''}</div></div>
      <div class="su-list">${list.length?list.map(rowHtml).join(''):'<div class="su-none">Ningún proveedor coincide con estos filtros.</div>'}</div></div>
      <aside class="su-card su-det${U.sheet&&mobile()?' sheet':''}">${U.sheet&&mobile()?'<button type="button" class="su-back" data-su="close">‹ Volver a proveedores</button>':''}${selected?fichaHtml(selected):'<div class="su-none">Elige un proveedor para ver su ficha.</div>'}</aside></div>`;
  }
  const focus=document.activeElement&&document.activeElement.id==='suSearch';
  const pos=focus?document.activeElement.selectionStart:0;
  root.innerHTML=html;
  if(focus){const input=$('suSearch');if(input){input.focus();try{input.setSelectionRange(pos,pos)}catch(_error){}}}
}

/* ------------------------------------------------------------- capas */
function closeLayer(){
  if(layer){layer.remove();layer=null}
  document.body.classList.remove('su-lock');
}
function openLayer(title,body,footer){
  closeLayer();
  layer=document.createElement('div');
  layer.className='su-ov';
  layer.innerHTML=`<div class="su-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="su-mh"><h3>${esc(title)}</h3><button type="button" class="su-x" data-su="x" aria-label="Cerrar">×</button></div><div class="su-mb">${body}</div><div class="su-err" id="suErr"></div><div class="su-mf">${footer||''}</div></div>`;
  layer.addEventListener('click',event=>{if(event.target===layer)closeLayer()});
  document.body.appendChild(layer);
  document.body.classList.add('su-lock');
  return layer;
}
const setErr=text=>{const el=$('suErr');if(el)el.textContent=text||''};
const val=id=>($(id)?.value||'').trim();
const field=(label,control,hint)=>`<div class="su-f"><label>${label}</label>${control}${hint?`<span class="su-hint">${hint}</span>`:''}</div>`;

function categoriesList(){
  const set=new Set(window.SupplierModule.list().map(item=>item.category).filter(Boolean));
  (window.InvoiceModule?.getAll?.()||[]).forEach(invoice=>{if(invoice.categoria)set.add(invoice.categoria)});
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function openForm(id){
  const supplier=id?window.SupplierModule.get(id):null;
  const p=supplier||{};
  const credit=p.credit_days===null||p.credit_days===undefined?'':String(p.credit_days);
  const logoBlock=supplier
    ?field('Logo',`<div class="su-logorow">${logo(supplier,true)}<div class="su-logobtns"><button type="button" class="su-btn sm" data-su="logo" id="suLogoBtn">${supplier.logo_path?'Cambiar logo':'Subir logo'}</button>${supplier.logo_path?'<button type="button" class="su-btn sm bad" data-su="logo-del" id="suLogoDel">Quitar</button>':''}<input type="file" id="suLogoFile" accept="image/jpeg,image/png,image/webp" hidden></div></div>`,'Se recorta y se comprime sola. El logo se guarda al instante.')
    :field('Logo','<div class="su-hint">Guarda el proveedor y luego podrás agregar su logo.</div>');
  openLayer(supplier?`Editar proveedor`:'Nuevo proveedor',`
    <input type="hidden" id="suId" value="${esc(supplier?.id||'')}">
    ${logoBlock}
    <div class="su-g2">${field('Nombre *',`<input id="suName" value="${esc(p.name||'')}" maxlength="120" autocomplete="off">`)}${field('RUT',`<input id="suRut" value="${esc(p.rut||'')}" maxlength="20" placeholder="76.123.456-7" autocomplete="off">`)}</div>
    <div class="su-g2">${field('Categoría habitual',`<input id="suCat" list="suCats" value="${esc(p.category||'')}" maxlength="60" autocomplete="off"><datalist id="suCats">${categoriesList().map(name=>`<option value="${esc(name)}">`).join('')}</datalist>`)}${field('Vendedor',`<input id="suSeller" value="${esc(p.seller_name||'')}" maxlength="120" autocomplete="off">`)}</div>
    <div class="su-g2">${field('Teléfono',`<input id="suPhone" value="${esc(p.phone||'')}" maxlength="40" inputmode="tel" placeholder="+56 9 1234 5678" autocomplete="off">`)}${field('Correo',`<input id="suMail" type="email" value="${esc(p.email||'')}" maxlength="160" autocomplete="off">`)}</div>
    <div class="su-g2">${field('Crédito',`<select id="suCredit">${CREDIT_PRESETS.map(([value,label])=>`<option value="${value}"${value===credit?' selected':''}>${label}</option>`).join('')}${credit&&!CREDIT_PRESETS.some(([value])=>value===credit)?`<option value="${esc(credit)}" selected>${esc(credit)} días</option>`:''}</select>`,'Se usa para calcular el vencimiento de las facturas.')}${field('Forma de pago',`<select id="suMethod"><option value="">Sin definir</option>${PAY_METHODS.map(name=>`<option${name===p.payment_method?' selected':''}>${name}</option>`).join('')}</select>`)}</div>
    ${field('Notas',`<textarea id="suNotes" rows="3" maxlength="1000" placeholder="Ej. Reparte martes y viernes. Pedir antes de las 12:00.">${esc(p.notes||'')}</textarea>`)}`,
    `${supplier?`<button type="button" class="su-btn ${supplier.active?'bad':''} left" data-su="toggle" data-id="${esc(supplier.id)}">${supplier.active?'Desactivar':'Activar'}</button>`:''}<button type="button" class="su-btn" data-su="x">Cancelar</button><button type="button" class="su-btn pri" data-su="save" id="suSave">Guardar</button>`);
  const input=$('suLogoFile');
  if(input)input.addEventListener('change',onLogoPicked);
  setTimeout(()=>$('suName')?.focus(),30);
}
async function submitForm(){
  const M=window.SupplierModule;
  const id=val('suId');
  const fields={
    name:val('suName'),rut:val('suRut'),category:val('suCat'),seller_name:val('suSeller'),phone:val('suPhone'),
    email:val('suMail'),credit_days:val('suCredit')===''?null:Number(val('suCredit')),payment_method:val('suMethod'),notes:val('suNotes')
  };
  if(!fields.name)return setErr('El proveedor necesita un nombre.');
  if(id){
    fields.id=id;
    fields.expected_version=M.get(id)?.version;
  }
  setErr('');
  const button=$('suSave');
  if(button){button.disabled=true;button.textContent='Guardando…'}
  try{
    const saved=await M.save(fields);
    closeLayer();
    U.selected=saved.id;
    render();
    toast(id?'Proveedor actualizado.':'Proveedor creado.');
  }catch(error){
    if(button){button.disabled=false;button.textContent='Guardar'}
    setErr(error.message||'No se pudo guardar.');
    if(error.code==='version_conflict'){await M.load({force:true});render()}
  }
}
async function onLogoPicked(event){
  const file=event.target.files&&event.target.files[0];
  event.target.value='';
  const M=window.SupplierModule;
  const id=val('suId');
  const supplier=M.get(id);
  if(!file||!supplier)return;
  if(typeof window.InvoiceLogos?.processLogo!=='function')return setErr('No se pudo preparar la imagen.');
  setErr('');
  const button=$('suLogoBtn');
  if(button){button.disabled=true;button.textContent='Subiendo…'}
  try{
    const blob=await window.InvoiceLogos.processLogo(file);
    const path=await M.uploadLogo(supplier,blob);
    const before=supplier.logo_path;
    try{await M.setLogo(supplier.id,path,supplier.version)}
    catch(error){M.removeLogoFiles([path]);throw error}
    if(before)M.removeLogoFiles([before]);
    openForm(id);
    render();
    toast('Logo guardado.');
  }catch(error){
    if(button){button.disabled=false;button.textContent=supplier.logo_path?'Cambiar logo':'Subir logo'}
    setErr(error.message||'No se pudo guardar el logo.');
  }
}
async function removeLogo(){
  const M=window.SupplierModule;
  const id=val('suId');
  const supplier=M.get(id);
  if(!supplier||!supplier.logo_path)return;
  setErr('');
  try{
    const before=supplier.logo_path;
    await M.setLogo(supplier.id,null,supplier.version);
    M.removeLogoFiles([before]);
    openForm(id);
    render();
    toast('Logo quitado.');
  }catch(error){setErr(error.message||'No se pudo quitar el logo.')}
}
async function toggleActive(id){
  const M=window.SupplierModule;
  const supplier=M.get(id);
  if(!supplier)return;
  const next=!supplier.active;
  if(!next&&!confirm(`¿Desactivar a ${supplier.name}? Dejará de ofrecerse al crear facturas; sus facturas se conservan.`))return;
  try{
    await M.setActive(supplier.id,next,supplier.version);
    closeLayer();
    render();
    toast(next?'Proveedor activado.':'Proveedor desactivado.');
  }catch(error){setErr(error.message||'No se pudo cambiar el estado.')}
}

/* ------------------------------------------------------ importar facturas */
function importCandidates(){
  const M=window.SupplierModule;
  const map=new Map();
  (window.InvoiceModule?.getAll?.()||[]).forEach(invoice=>{
    const name=String(invoice.proveedor||'').trim();
    if(!name||M.forInvoice(invoice))return;
    const key=M.rutKey(invoice.rutProveedor)||`n:${M.norm(name)}`;
    const row=map.get(key)||{name,rut:String(invoice.rutProveedor||'').trim(),count:0,cats:{}};
    row.count+=1;
    if(!row.rut&&invoice.rutProveedor)row.rut=String(invoice.rutProveedor).trim();
    if(invoice.categoria)row.cats[invoice.categoria]=(row.cats[invoice.categoria]||0)+1;
    map.set(key,row);
  });
  return [...map.values()].map(row=>({name:row.name,rut:row.rut,count:row.count,category:Object.entries(row.cats).sort((a,b)=>b[1]-a[1])[0]?.[0]||''})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));
}
function openImport(){
  const list=importCandidates();
  if(!list.length){
    openLayer('Importar desde facturas',`<div class="su-note">Todos los proveedores de tus facturas ya están en esta lista.</div>`,'<button type="button" class="su-btn pri" data-su="x">Entendido</button>');
    return;
  }
  openLayer('Importar desde facturas',`<p class="su-hint" style="margin:0 0 12px">Se crearán estos ${list.length} proveedor${list.length===1?'':'es'} con el nombre, el RUT y la categoría más usada de sus facturas. Las facturas no se modifican.</p>
    <div class="su-imp">${list.map(row=>`<div><span class="su-logo ini" style="--c:${toneOf(row.name)}">${esc(initials(row.name))}</span><div class="su-nm"><strong>${esc(row.name)}</strong><small>${esc(row.rut||'Sin RUT')}${row.category?` · ${esc(row.category)}`:''}</small></div><small>${row.count} factura${row.count===1?'':'s'}</small></div>`).join('')}</div>`,
    `<button type="button" class="su-btn" data-su="x">Cancelar</button><button type="button" class="su-btn pri" data-su="do-import" id="suImp">Crear ${list.length}</button>`);
  layer.dataset.items=JSON.stringify(list.map(({name,rut,category})=>({name,rut,category})));
}
async function doImport(){
  const items=JSON.parse(layer?.dataset.items||'[]');
  const button=$('suImp');
  if(button){button.disabled=true;button.textContent='Creando…'}
  try{
    const result=await window.SupplierModule.importMany(items);
    closeLayer();
    render();
    toast(`${result.created} proveedor${result.created===1?'':'es'} creado${result.created===1?'':'s'}${result.skipped?` · ${result.skipped} ya existían`:''}.`);
  }catch(error){
    if(button){button.disabled=false;button.textContent=`Crear ${items.length}`}
    setErr(error.message||'No se pudo importar.');
  }
}

/* ------------------------------------------------------------- eventos */
async function onClick(event){
  const target=event.target.closest('[data-su]');
  if(!target)return;
  const action=target.dataset.su;
  const id=target.dataset.id;
  if(action==='row'){U.selected=id;U.sheet=mobile();render();if(U.sheet)window.scrollTo(0,0);return}
  if(action==='close'){U.sheet=false;render();return}
  if(action==='tab'){U.tab=target.dataset.tab;render();return}
  if(action==='new')return openForm(null);
  if(action==='edit')return openForm(id);
  if(action==='import')return openImport();
  if(action==='reload'){await window.SupplierModule.load({force:true});render();return}
  if(action==='invoice'){
    if(typeof window.showView==='function')window.showView('invoices');
    if(typeof window.openInvoiceModalForSupplier==='function')window.openInvoiceModalForSupplier(id);
    else if(typeof window.openInvoiceModal==='function')window.openInvoiceModal();
    return;
  }
  if(action==='x')return closeLayer();
  if(action==='save')return submitForm();
  if(action==='toggle')return toggleActive(id);
  if(action==='logo')return $('suLogoFile')?.click();
  if(action==='logo-del')return removeLogo();
  if(action==='do-import')return doImport();
}
function init(){
  const section=$('suppliers');
  if(!section||section.dataset.suReady)return;
  section.dataset.suReady='1';
  let root=$('suppliersRoot');
  if(!root){root=document.createElement('div');root.id='suppliersRoot';section.appendChild(root)}
  root.classList.add('su-root');
  document.addEventListener('click',event=>{
    if(!event.target.closest('#suppliers,.su-ov'))return;
    onClick(event);
  });
  root.addEventListener('input',event=>{
    if(event.target.id==='suSearch'){U.q=event.target.value;render()}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer)closeLayer()});
  window.addEventListener('suppliers:changed',()=>{if(section.classList.contains('active'))render()});
  window.addEventListener('suppliers:logos',()=>{if(section.classList.contains('active'))render()});
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){
      render();
      window.SupplierModule.load({force:true}).then(()=>render());
    }
    if(!active&&was){U.sheet=false;closeLayer()}
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}

window.SupplierUI={init,render,openForm,state:U};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
