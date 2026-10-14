(function(){
'use strict';

// Inventarios (Tienda, Cigarrillos y Lubricantes): interfaz.
// Los datos viven en tablas propias de Supabase y se leen y escriben solo con
// las funciones de window.InventoryApi. No usa app_state ni el estado principal.

const Api=window.InventoryApi;
if(!Api)return;

const KIND_LABEL={
  opening:'Saldo inicial',receipt:'Recepción',issue:'Salida',waste:'Merma',
  transfer_out:'Traslado (sale)',transfer_in:'Traslado (entra)',adjustment:'Ajuste aprobado',reversal:'Corrección'
};
const KIND_TONE={receipt:'ok',opening:'info',waste:'or',issue:'',transfer_out:'',transfer_in:'',adjustment:'info',reversal:'pu'};
const WASTE_REASONS=['Vencimiento','Daño','Manipulación','Otra causa justificada'];
const ISSUE_REASONS=['Degustación autorizada','Uso interno','Consumo de la estación','Otra causa justificada'];
const POLL_MS=20000;

const S={
  userId:null,companyId:null,role:null,area:null,
  status:'idle',errorMessage:'',
  overview:null,
  view:'home',sub:'products',
  filters:{q:'',cat:'Todas',st:'todos'},
  products:{},receipts:{},reports:{},homeData:null,movs:[],adjs:[],audit:[],
  movFilter:{inv:'todos',kind:''},
  repFrom:'',repTo:'',
  online:true,lastSync:null,
  count:null,
  form:null,
  active:false,pollTimer:null,saveTimer:null
};

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>Number(value||0).toLocaleString('es-CL');
const isAdmin=()=>S.role==='ADMIN';
const invList=()=>S.overview?.inventories||[];
const invByCode=code=>invList().find(item=>item.code===code);
const invById=id=>invList().find(item=>item.id===id);
const todayIso=()=>{
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
};
const fdate=value=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}):'—';
const fshort=value=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString('es-CL',{day:'2-digit',month:'short'}):'—';
const fstamp=value=>{
  if(!value)return '—';
  const date=new Date(value);
  return `${date.toLocaleDateString('es-CL',{day:'2-digit',month:'short'})} ${date.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`;
};
const daysTo=value=>Math.round((new Date(String(value).slice(0,10)+'T00:00:00')-new Date(todayIso()+'T00:00:00'))/86400000);
const plural=(n,one,many)=>`${fmt(n)} ${n===1?one:many}`;
function unitPlural(name){
  const word=String(name||'unidad').trim();
  if(/[aeiou]$/i.test(word))return word+'s';
  return word.replace(/ó/g,'o').replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ú/g,'u')+'es';
}

/* ---------------------------------------------------------------- capas */

let layer=null;
function ensureLayer(){
  if(layer)return layer;
  layer=document.createElement('div');
  layer.className='inv-layer';
  layer.innerHTML='<div class="inv-ov" id="invOv" hidden></div><aside class="inv-drw" id="invDrw" hidden aria-label="Ficha de producto"></aside><div class="inv-mdl" id="invMdl" hidden role="dialog" aria-modal="true"></div><div class="inv-toast" id="invToast" role="status"></div>';
  document.body.appendChild(layer);
  layer.addEventListener('click',onLayerClick);
  layer.addEventListener('input',onLayerInput);
  layer.addEventListener('change',onLayerInput);
  return layer;
}
function showLayer(id){ensureLayer();$('invOv').hidden=false;$(id).hidden=false}
function closeLayers(){
  stopScanner();
  if(!layer)return;
  ['invOv','invDrw','invMdl'].forEach(id=>{const el=$(id);if(el)el.hidden=true});
  S.form=null;
}
function closeModalOnly(){
  stopScanner();
  const modalEl=$('invMdl');
  if(modalEl)modalEl.hidden=true;
  if($('invDrw')?.hidden!==false)$('invOv').hidden=true;
  S.form=null;
}
function toast(text){
  ensureLayer();
  const el=$('invToast');
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),3200);
}
function openModal(title,body,footer){
  ensureLayer();
  $('invMdl').innerHTML=`<div class="inv-xh"><h3>${title}</h3><button class="inv-x" data-act="close" aria-label="Cerrar">×</button></div>${body}${footer?`<div class="inv-foot">${footer}</div>`:''}`;
  showLayer('invMdl');
  const first=$('invMdl').querySelector('input:not([readonly]):not([type=hidden]),select,textarea');
  if(first&&window.matchMedia('(min-width:761px)').matches)first.focus();
}
function confirmBox({title,text,label,danger,onConfirm}){
  openModal(esc(title),`<p class="inv-sub" style="margin:0 0 14px;color:var(--text)">${text}</p><div class="inv-err" id="invFormErr"></div>`,
    `<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn ${danger?'bad':'pri'}" data-act="confirm-ok" id="invConfirmOk">${esc(label||'Confirmar')}</button>`);
  S.form={type:'confirm',onConfirm};
}
function reasonBox({title,text,label,required,okLabel,danger,onConfirm}){
  openModal(esc(title),`<p class="inv-sub" style="margin:0 0 12px;color:var(--text)">${text||''}</p>
    <div class="inv-fld"><label for="invReason">${esc(label)}</label><textarea id="invReason" rows="3"></textarea><div class="inv-err" id="invFormErr"></div></div>`,
    `<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn ${danger?'bad':'pri'}" data-act="reason-ok" id="invReasonOk">${esc(okLabel||'Confirmar')}</button>`);
  S.form={type:'reason',required,onConfirm};
}
function setFormError(text){const el=$('invFormErr');if(el)el.textContent=text||''}
function setBusy(buttonId,busy,label){
  const button=$(buttonId);
  if(!button)return;
  if(busy){button.dataset.label=button.textContent;button.textContent=label||'Guardando…';button.disabled=true}
  else{button.disabled=false;if(button.dataset.label)button.textContent=button.dataset.label}
}

/* ------------------------------------------------------------ errores */

function handleError(error,{form=false}={}){
  const info=Api.classify(error);
  if(info.network){
    S.online=false;
    renderSync();
  }
  if(info.unavailable){
    S.status='unavailable';
    render();
    return info;
  }
  if(form&&$('invFormErr'))setFormError(info.message);
  else toast(info.message);
  return info;
}

/* ------------------------------------------------------------- carga */

async function load(){
  S.status='loading';
  render();
  try{
    const context=Api.context();
    if(!context?.companyId)throw new Api.InventoryError({code:'no_session',message:'No hay una sesión activa.'});
    S.userId=context.userId;
    S.companyId=context.companyId;
    const me=await Api.myRole(S.companyId);
    S.role=me?.role||null;
    S.area=me?.area||null;
    if(!S.role)throw new Api.InventoryError({code:'forbidden',message:'Tu cuenta no tiene acceso a esta empresa.'});
    await refreshOverview();
    S.status='ready';
    S.online=true;
    if(!['home','mov','apr','aud'].includes(S.view)&&!S.view.startsWith('inv:')&&!S.view.startsWith('count:'))S.view='home';
    await loadView(true);
  }catch(error){
    const info=Api.classify(error);
    if(info.unavailable){S.status='unavailable'}
    else{S.status='error';S.errorMessage=info.message;if(info.network)S.online=false}
  }
  render();
}

async function refreshOverview(){
  S.overview=await Api.overview(S.companyId);
  S.lastSync=new Date();
  S.online=true;
}

async function ensureProducts(inventoryId,force){
  if(!force&&S.products[inventoryId])return S.products[inventoryId];
  S.products[inventoryId]=await Api.products(inventoryId);
  return S.products[inventoryId];
}

async function loadView(initial){
  const view=S.view;
  if(!S.overview)return;
  if(view==='home'){
    const visible=invList();
    const [products,movs]=await Promise.all([
      Promise.all(visible.map(item=>ensureProducts(item.id,true))),
      Api.movements(S.companyId,{limit:8})
    ]);
    const month=todayIso().slice(0,8);
    const wastes=await Promise.all(visible.map(item=>Api.reportWaste(item.id,`${month}01`,todayIso())));
    S.homeData={movs,products,wastes};
  }else if(view.startsWith('inv:')){
    const item=invByCode(view.slice(4));
    if(!item){S.view='home';return loadView(initial)}
    await ensureProducts(item.id,true);
    if(S.sub==='receipts')S.receipts[item.id]=await Api.receipts(item.id,50);
    if(S.sub==='reports'){
      if(!S.repFrom){S.repFrom=`${todayIso().slice(0,8)}01`;S.repTo=todayIso()}
      S.reports[item.id]={
        waste:await Api.reportWaste(item.id,S.repFrom,S.repTo),
        shortages:await Api.reportShortages(item.id)
      };
    }
  }else if(view==='mov'){
    S.movs=await Api.movements(S.companyId,{
      inventoryId:S.movFilter.inv==='todos'?null:S.movFilter.inv,kind:S.movFilter.kind||null,limit:150
    });
  }else if(view==='apr'){
    S.adjs=await Api.adjustments(S.companyId,null);
  }else if(view==='aud'&&isAdmin()){
    S.audit=await Api.audit(S.companyId,120);
  }else if(view.startsWith('count:')&&!initial){
    // el conteo se prepara al entrar (openCount)
  }
  S.lastSync=new Date();
  S.online=true;
}

async function go(view,options={}){
  if(S.count&&S.view.startsWith('count:')&&!view.startsWith('count:')){
    await countFlush(true);
  }
  S.view=view;
  if(options.sub)S.sub=options.sub;
  else if(view.startsWith('inv:'))S.sub='products';
  S.filters={q:'',cat:'Todas',st:'todos'};
  closeLayers();
  render();
  try{
    await loadView();
  }catch(error){
    handleError(error);
  }
  render();
  window.scrollTo({top:0});
}

async function refreshSilently(){
  if(!S.active||S.status!=='ready')return;
  if(document.visibilityState==='hidden')return;
  if(S.view.startsWith('count:')||(layer&&(!$('invMdl').hidden||!$('invDrw').hidden)))return;
  try{
    await refreshOverview();
    await loadView();
    render();
  }catch(error){
    const info=Api.classify(error);
    if(info.network){S.online=false;renderSync()}
  }
}

function startPolling(){
  stopPolling();
  S.pollTimer=setInterval(refreshSilently,POLL_MS);
}
function stopPolling(){
  clearInterval(S.pollTimer);
  S.pollTimer=null;
}

/* ------------------------------------------------------ componentes */

function statusPills(product,item){
  const pills=[];
  if(product.status==='out')pills.push('<span class="inv-pill bad">Agotado</span>');
  else if(product.status==='low')pills.push('<span class="inv-pill warn">Bajo mínimo</span>');
  if(product.expiry==='expired')pills.push('<span class="inv-pill bad">Vencido</span>');
  else if(product.expiry==='soon'){
    const days=daysTo(product.next_expiry);
    pills.push(`<span class="inv-pill or">${days<=0?'Vence hoy':`Vence en ${days} d`}</span>`);
  }
  if(!product.active)pills.push('<span class="inv-pill">Inactivo</span>');
  return pills.length?pills.join(' '):'<span class="inv-pill ok">Normal</span>';
}
function gauge(product){
  const ratio=product.min_stock?Math.max(0,Math.min(100,product.stock/(product.min_stock*2)*100)):(product.stock>0?100:0);
  const tone=product.stock<=0?'no':product.stock<product.min_stock?'lo':'';
  return `<span class="inv-gg ${tone}" aria-hidden="true"><i style="width:${ratio}%"></i></span>`;
}
function attrOf(product,key){return (product.attrs&&product.attrs[key])||''}
function tabs(){
  const items=[['home','Panel']];
  invList().filter(item=>item.active).forEach(item=>items.push([`inv:${item.code}`,item.name]));
  items.push(['mov','Movimientos'],['apr','Aprobaciones']);
  if(isAdmin())items.push(['aud','Auditoría']);
  const pending=S.overview?.pending_total||0;
  return `<div class="inv-tabs" role="tablist">${items.map(([key,label])=>`<button role="tab" class="${S.view===key||(S.view.startsWith('count:')&&key==='inv:'+S.view.slice(6))?'on':''}" data-go="${key}">${esc(label)}${key==='apr'&&pending?`<span class="inv-badge">${pending}</span>`:''}</button>`).join('')}</div>`;
}
function head(title,sub,actions,eyebrow){
  return `<div class="inv-head"><div>${eyebrow?`<div class="inv-eb">${esc(eyebrow)}</div>`:''}<h2>${esc(title)}</h2>${sub?`<p class="inv-sub">${sub}</p>`:''}</div><div class="inv-acts">${actions||''}</div></div>`;
}
function syncHtml(){
  const time=S.lastSync?S.lastSync.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  return S.online
    ?`<div class="inv-sync" id="invSync"><i></i><span>Sincronizado${time?` · ${time}`:''}</span></div>`
    :`<div class="inv-sync off" id="invSync"><i></i><span>Sin conexión con el servidor. Lo que ves puede estar desactualizado.</span> <button class="inv-btn sm" data-act="retry">Reintentar</button></div>`;
}
function renderSync(){
  const el=$('invSync');
  if(el)el.outerHTML=syncHtml();
}

/* ------------------------------------------------------------- vistas */

function viewUnavailable(){
  return `${head('Inventarios','Control de stock de Tienda, Cigarrillos y Lubricantes.')}
    <div class="inv-box"><h3>Aún no está habilitado</h3>
    <p class="inv-sub" style="color:var(--text)">El servidor todavía no tiene las funciones de Inventarios. Esta sección se activará sola cuando se apliquen las migraciones de la base de datos.</p>
    ${isAdmin()||S.role===null?'<p class="inv-sub">Para el administrador: faltan las migraciones <b>20261015000100</b>, <b>20261015000200</b> y <b>20261015000300</b> (ver <code>docs/inventarios.md</code>).</p>':''}
    <div class="inv-acts" style="margin-top:12px"><button class="inv-btn" data-act="reload">Volver a comprobar</button></div></div>`;
}
function viewError(){
  return `${head('Inventarios','')}<div class="inv-box"><h3>No se pudo cargar</h3><p class="inv-sub" style="color:var(--text)">${esc(S.errorMessage||'Ocurrió un problema al cargar los inventarios.')}</p>
    <div class="inv-acts" style="margin-top:12px"><button class="inv-btn pri" data-act="reload">Reintentar</button></div></div>`;
}
function viewSetup(){
  if(isAdmin()){
    return `${head('Inventarios','Control de stock de Tienda, Cigarrillos y Lubricantes.')}
    <div class="inv-box"><h3>Activar Inventarios</h3>
    <p class="inv-sub" style="color:var(--text)">Crea los tres inventarios de la empresa y sus ubicaciones básicas. Después podrás cargar los productos y el saldo inicial.</p>
    <p class="inv-sub">Distribución inicial: <b>Tienda</b> y <b>Cigarrillos</b> para la Jefa de Tienda, <b>Lubricantes</b> para la Jefa de Isla. La puedes cambiar cuando quieras desde el Panel.</p>
    <div class="inv-acts" style="margin-top:12px"><button class="inv-btn pri" data-act="setup">Activar Inventarios</button></div></div>`;
  }
  return `${head('Inventarios','')}<div class="inv-box"><h3>Sin inventarios asignados</h3>
    <p class="inv-sub" style="color:var(--text)">Tu área todavía no tiene inventarios. El administrador los activa y los asigna.</p></div>`;
}

function viewHome(){
  const items=invList();
  const data=S.homeData||{movs:[],products:[],wastes:[]};
  const cards=items.map(item=>{
    const healthy=Math.max(0,item.refs-item.low-item.out);
    const attention=item.low+item.out+item.expired+item.expiring;
    return `<section class="inv-card ${item.code}${item.active?'':' inv-inactive'}">
      <div><h3>${esc(item.name)}</h3><div class="area">Área ${esc(item.area)}${item.active?'':' · desactivado'}</div></div>
      <dl class="inv-kp"><div><dt>Referencias</dt><dd class="inv-num">${fmt(item.refs)}</dd></div>
        <div><dt>${item.control_unit==='cajetilla'?'Cajetillas':'Unidades en stock'}</dt><dd class="inv-num big">${fmt(item.stock_total)}</dd></div>
        <div><dt>Requieren atención</dt><dd class="inv-num ${attention?'w':''}">${fmt(attention)}</dd></div></dl>
      <div class="inv-hb" role="img" aria-label="Estado de las referencias"><i class="a" style="width:${item.refs?healthy/item.refs*100:0}%"></i><i class="b" style="width:${item.refs?item.low/item.refs*100:0}%"></i><i class="c" style="width:${item.refs?item.out/item.refs*100:0}%"></i></div>
      <div class="inv-hl"><span style="--d:var(--green)"><b>${healthy}</b> normales</span><span style="--d:var(--yellow)"><b>${item.low}</b> bajo mínimo</span><span style="--d:var(--red)"><b>${item.out}</b> agotados</span></div>
      ${item.code==='tienda'&&(item.expiring||item.expired)?`<div class="inv-note warn">${item.expired?`${plural(item.expired,'producto vencido','productos vencidos')}. `:''}${item.expiring?`${plural(item.expiring,'producto vence','productos vencen')} en ${item.expiry_alert_days} días o menos.`:''}</div>`:''}
      ${item.active?`<div class="inv-acts"><button class="inv-btn pri" data-go="inv:${item.code}">Abrir</button><button class="inv-btn" data-act="count" data-code="${item.code}">Tomar inventario</button></div>`:''}
    </section>`;
  }).join('');

  const attention=[];
  data.products.forEach((list,index)=>{
    const item=items[index];
    (list||[]).filter(product=>product.active).forEach(product=>{
      if(product.status==='out')attention.push({rank:0,product,item,pill:['bad','Agotado']});
      if(product.expiry==='expired')attention.push({rank:0,product,item,pill:['bad','Vencido']});
      else if(product.expiry==='soon')attention.push({rank:1,product,item,pill:['or',`Vence en ${Math.max(0,daysTo(product.next_expiry))} d`]});
      if(product.status==='low')attention.push({rank:2,product,item,pill:['warn','Bajo mínimo']});
    });
  });
  attention.sort((a,b)=>a.rank-b.rank);
  const attentionHtml=attention.slice(0,8).map(({product,item,pill})=>`<div class="inv-row"><div class="t"><b>${esc(product.name)}</b><span>${esc(item.name)} · stock ${fmt(product.stock)} / mín. ${fmt(product.min_stock)}</span></div><span class="inv-pill ${pill[0]}">${esc(pill[1])}</span></div>`).join('')||'<div class="inv-empty">Sin alertas.</div>';

  const recent=(data.movs||[]).map(movRow).join('')||'<div class="inv-empty">Aún no hay movimientos.</div>';
  const reasons={};
  (data.wastes||[]).forEach(report=>(report?.by_reason||[]).forEach(entry=>{reasons[entry.reason]=(reasons[entry.reason]||0)+Number(entry.qty)}));
  const max=Math.max(1,...Object.values(reasons));
  const total=Object.values(reasons).reduce((a,b)=>a+b,0);
  const wasteHtml=Object.keys(reasons).length
    ?`<div class="inv-bars">${Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([reason,qty])=>`<div class="inv-bar"><span>${esc(reason)}</span><i><b style="width:${qty/max*100}%"></b></i><span class="inv-num r">${fmt(qty)}</span></div>`).join('')}</div>`
    :'<div class="inv-empty">Sin mermas este mes.</div>';

  const pending=S.overview?.pending_total||0;
  const config=isAdmin()?`<div class="inv-box"><h3>Acceso y reglas por inventario <small>solo administrador</small></h3>
      ${items.map(item=>`<div class="inv-row first" style="flex-wrap:wrap"><div class="t" style="min-width:110px"><b>${esc(item.name)}</b></div>
        <select class="inv-sel" data-cfg="area" data-id="${item.id}" aria-label="Área de ${esc(item.name)}"><option value="TIENDA"${item.area==='TIENDA'?' selected':''}>Área TIENDA</option><option value="ISLA"${item.area==='ISLA'?' selected':''}>Área ISLA</option></select>
        <label class="inv-sub" style="display:flex;align-items:center;gap:6px;margin:0">Alerta de vencimiento <input type="number" min="1" max="90" value="${item.expiry_alert_days}" data-cfg="expiry_alert_days" data-id="${item.id}" style="width:64px" aria-label="Días de alerta"> d</label>
        <label class="inv-sub" style="display:flex;align-items:center;gap:6px;margin:0">Ajustes automáticos hasta <input type="number" min="0" value="${item.auto_approve_max_abs}" data-cfg="auto_approve_max_abs" data-id="${item.id}" style="width:64px" aria-label="Umbral de aprobación automática"> u.</label>
        <button class="inv-btn sm" data-act="cfg-save" data-id="${item.id}">Guardar</button></div>`).join('')}
      <p class="inv-sub" style="margin-top:8px;font-size:12px">«Ajustes automáticos hasta 0» significa que toda diferencia de conteo espera tu aprobación. La asignación de área se aplica en el servidor: una jefa solo ve los inventarios de su área.</p></div>`
    :`<div class="inv-box"><h3>Tu acceso</h3><p class="inv-sub" style="color:var(--text)">${items.filter(item=>item.active).map(item=>esc(item.name)).join(' · ')||'Sin inventarios'}</p><p class="inv-sub" style="font-size:12px">Puedes registrar recepciones, mermas, salidas justificadas y conteos. Los ajustes los aprueba el administrador.</p></div>`;

  return `${head('Inventarios',`Hola, ${esc(Api.context()?.displayName||'')}. ${items.length===3?'Ves los tres inventarios.':`Ves ${items.map(item=>esc(item.name)).join(' y ')}.`}`)}${tabs()}${syncHtml()}
    ${pending?`<div class="inv-note warn inv-banner"><span><b>${plural(pending,'ajuste','ajustes')} por revisar.</b> ${isAdmin()?'Esperan tu aprobación.':'Los aprueba el administrador.'}</span><button class="inv-btn sm" data-go="apr">Ver</button></div>`:''}
    <div class="inv-cards">${cards}</div>
    <div class="inv-two"><div class="inv-box"><h3>Requiere atención <small>${attention.length} alertas</small></h3>${attentionHtml}</div>
      <div class="inv-box"><h3>Últimos movimientos <button class="inv-btn sm" data-go="mov">Historial</button></h3>${recent}</div></div>
    <div class="inv-two"><div class="inv-box"><h3>Mermas del mes por motivo <small>${fmt(total)} unidades</small></h3>${wasteHtml}</div>${config}</div>`;
}

function movRow(m){
  return `<div class="inv-row"><div class="t"><b>${esc(m.product_name)}</b><span>${esc(m.created_by_name||'—')} · ${fstamp(m.created_at)}${m.reason?` · ${esc(m.reason)}`:''}${m.note?` · ${esc(m.note)}`:''}</span></div><span class="inv-pill ${KIND_TONE[m.kind]||''}">${KIND_LABEL[m.kind]||m.kind}</span><b class="inv-num ${m.qty>0?'inv-pos':'inv-neg'}" style="min-width:52px;text-align:right">${m.qty>0?'+':''}${fmt(m.qty)}</b></div>`;
}

function filteredProducts(item){
  const list=S.products[item.id]||[];
  const q=S.filters.q.trim().toLowerCase();
  return list.filter(product=>{
    if(S.filters.st==='inactivo')return !product.active&&(!q||matches(product,q));
    if(!product.active)return false;
    if(S.filters.cat!=='Todas'&&product.category!==S.filters.cat)return false;
    if(q&&!matches(product,q))return false;
    switch(S.filters.st){
      case 'bajo':return product.status==='low';
      case 'agotado':return product.status==='out';
      case 'vence':return product.expiry==='soon'||product.expiry==='expired';
      case 'faltantes':return product.status!=='ok';
      default:return true;
    }
  });
}
function matches(product,q){
  return [product.code,product.barcode,product.name,product.brand,product.category,attrOf(product,'variety'),attrOf(product,'viscosity'),attrOf(product,'spec'),product.presentation]
    .join(' ').toLowerCase().includes(q);
}

function listHtml(item){
  const rows=filteredProducts(item);
  const columns={
    tienda:['Código','Producto','Categoría','Ubicación','Stock','Mín.','Próx. vencimiento','Estado'],
    cigarrillos:['Código','Producto','Presentación','Stock','Cartones','Mín.','Estado'],
    lubricantes:['SKU','Producto','Viscosidad','Presentación','Ubicación','Stock','Mín.','Estado']
  }[item.code];
  const stockCell=product=>`<div class="inv-sc"><span class="inv-stk inv-num">${fmt(product.stock)}</span>${gauge(product)}</div>`;
  const cells=product=>{
    const lot=(product.stock_detail||[]).find(row=>row.expires_on);
    if(item.code==='tienda')return [esc(product.code),`<span class="nm">${esc(product.name)}</span><div class="mt">${esc([product.brand,product.presentation].filter(Boolean).join(' · '))}</div>`,esc(product.category),esc(product.default_location||'—'),stockCell(product),fmt(product.min_stock),product.next_expiry?`${fshort(product.next_expiry)} <span class="inv-dim">(${esc(lot?.lot_code||'')})</span>`:'—',statusPills(product,item)];
    if(item.code==='cigarrillos'){
      const factor=product.receive_factor||1;
      return [esc(product.code),`<span class="nm">${esc(product.brand)} ${esc(attrOf(product,'variety')||product.name)}</span>`,esc(product.presentation),stockCell(product),product.receive_unit?`<span class="inv-dim inv-num">${Math.floor(product.stock/factor)} + ${product.stock%factor}</span>`:'—',fmt(product.min_stock),statusPills(product,item)];
    }
    return [esc(product.code),`<span class="nm">${esc(product.brand)} ${esc(product.name.replace(product.brand,'').trim())}</span><div class="mt">${esc(attrOf(product,'spec'))}</div>`,esc(attrOf(product,'viscosity')||'—'),`<b>${esc(product.presentation)}</b>`,esc(product.default_location||'—'),stockCell(product),fmt(product.min_stock),statusPills(product,item)];
  };
  const body=rows.map(product=>`<tr class="go${product.active?'':' inv-inactive'}" data-open="${product.id}">${cells(product).map((html,index)=>{
    const label=columns[index];
    const cls=[index===0?'hid':index===1?'ttl':'',label==='Ubicación'?'nw':label==='Categoría'?'cat':label==='Estado'?'est':'',(label==='Mín.'||label==='Cartones')?'r':''].filter(Boolean).join(' ');
    return `<td data-l="${label}" class="${cls}">${html}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="inv-tw"><table><thead><tr>${columns.map(label=>`<th class="${label==='Mín.'||label==='Cartones'?'r':''}">${label}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="9" class="inv-empty">${(S.products[item.id]||[]).length?'Sin resultados con estos filtros.':'Aún no hay productos en este inventario.'}</td></tr>`}</tbody></table></div>`;
}
function renderList(){
  const item=invByCode(S.view.slice(4));
  const holder=$('invList');
  if(item&&holder)holder.innerHTML=listHtml(item);
  const chips=$('invChips');
  if(chips&&item)chips.innerHTML=chipsHtml(item);
}
function chipsHtml(item){
  if(item.code!=='tienda')return '';
  const list=(S.products[item.id]||[]).filter(product=>product.active);
  const cats=['Todas',...new Set(list.map(product=>product.category).filter(Boolean))];
  const count=key=>key==='Todas'?list.length:list.filter(product=>product.category===key).length;
  return cats.map(key=>`<button class="inv-chip ${S.filters.cat===key?'on':''}" data-cat="${esc(key)}">${esc(key)}<b>${count(key)}</b></button>`).join('');
}

function viewInventory(){
  const item=invByCode(S.view.slice(4));
  if(!item)return viewHome();
  const products=(S.products[item.id]||[]).filter(product=>product.active);
  const subTabs=`<div class="inv-chips" style="margin-bottom:14px">${[['products','Productos'],['receipts','Recepciones'],['reports','Reportes']].map(([key,label])=>`<button class="inv-chip ${S.sub===key?'on':''}" data-sub="${key}">${label}</button>`).join('')}</div>`;
  const actions=`<button class="inv-btn" data-act="receive" data-code="${item.code}">Recepción</button><button class="inv-btn pri" data-act="count" data-code="${item.code}">Tomar inventario</button>${isAdmin()?`<button class="inv-btn" data-act="product-new" data-code="${item.code}">+ Producto</button><button class="inv-btn" data-act="opening" data-code="${item.code}">Saldo inicial</button>`:''}`;
  let content='';
  if(S.sub==='products'){
    content=`<div class="inv-tools"><label class="inv-search"><span class="inv-dim">⌕</span><input id="invQ" type="search" placeholder="${item.code==='cigarrillos'?'Buscar marca, variedad o código':item.code==='lubricantes'?'Buscar marca, viscosidad o SKU':'Buscar producto, código o código de barras'}" value="${esc(S.filters.q)}" autocomplete="off"></label>
      ${scannerSupported()?'<button class="inv-btn" data-act="scan-search" aria-label="Escanear código de barras">Escanear</button>':''}
      <select class="inv-sel" id="invSt" aria-label="Filtrar por estado"><option value="todos">Todos los estados</option><option value="bajo"${S.filters.st==='bajo'?' selected':''}>Stock bajo</option><option value="agotado"${S.filters.st==='agotado'?' selected':''}>Agotados</option>${item.code==='tienda'?`<option value="vence"${S.filters.st==='vence'?' selected':''}>Por vencer</option>`:''}<option value="inactivo"${S.filters.st==='inactivo'?' selected':''}>Inactivos</option></select></div>
      <div class="inv-chips" id="invChips">${chipsHtml(item)}</div>
      ${item.code==='lubricantes'?'<div class="inv-note" style="margin-bottom:12px">Cada presentación es un producto distinto: un 5W-30 de 1 L y uno de 4 L tienen SKU y stock separados y nunca se suman.</div>':''}
      ${item.code==='cigarrillos'?'<div class="inv-note" style="margin-bottom:12px">El stock se controla en cajetillas. Las recepciones por cartón se convierten con el factor de cada producto.</div>':''}
      <div id="invList">${listHtml(item)}</div>`;
  }else if(S.sub==='receipts'){
    content=receiptsHtml(item);
  }else{
    content=reportsHtml(item);
  }
  return `${head(item.name,`${fmt(products.length)} referencias activas · área ${esc(item.area)}${item.active?'':' · inventario desactivado'}`,actions,'Inventarios')}${tabs()}${syncHtml()}${subTabs}${content}`;
}

function receiptsHtml(item){
  const list=S.receipts[item.id]||[];
  if(!list.length)return '<div class="inv-box"><div class="inv-empty">Aún no hay recepciones. Una factura no implica que la mercadería llegó: registra aquí lo que realmente se recibe.</div></div>';
  return list.map(receipt=>`<div class="inv-box" style="margin-bottom:12px"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:flex-start">
    <div><b>${esc(receipt.supplier)}</b> · ${esc(receipt.document_no)}${receipt.invoice_ref?` <span class="inv-pill info">Factura ${esc(receipt.invoice_ref)}</span>`:''}
    <div class="inv-sub">Recibida el ${fdate(receipt.received_on)} por ${esc(receipt.received_by_name||'—')}${receipt.notes?` · ${esc(receipt.notes)}`:''}</div></div>
    <div class="inv-acts"><span class="inv-pill ${receipt.status==='voided'?'bad':'ok'}">${receipt.status==='voided'?'Anulada':'Confirmada'}</span>${isAdmin()&&receipt.status==='confirmed'?`<button class="inv-btn sm bad" data-act="void-receipt" data-id="${receipt.id}">Anular</button>`:''}</div></div>
    <div style="margin-top:8px">${(receipt.lines||[]).map(line=>`<div class="inv-row"><div class="t"><b>${esc(line.product_name)}</b><span>${esc(line.product_code)}${line.input_unit==='purchase'?` · ${fmt(line.qty_input)} × ${fmt(line.factor)}`:''}${line.lot_code?` · lote ${esc(line.lot_code)} vence ${fdate(line.expires_on)}`:''}</span></div><b class="inv-num inv-pos">+${fmt(line.qty_base)}</b></div>`).join('')}</div>
    ${receipt.void_reason?`<div class="inv-note bad" style="margin-top:8px">Anulada: ${esc(receipt.void_reason)}</div>`:''}</div>`).join('');
}

function reportsHtml(item){
  const report=S.reports[item.id];
  if(!report)return '<div class="inv-empty">Cargando reportes…</div>';
  const shortages=report.shortages||[];
  const waste=report.waste||{by_reason:[],by_product:[],total:0};
  const expiring=item.code==='tienda'?(S.products[item.id]||[]).flatMap(product=>(product.stock_detail||[]).filter(row=>row.expires_on).map(row=>({product,row}))).filter(entry=>daysTo(entry.row.expires_on)<=Math.max(item.expiry_alert_days,30)).sort((a,b)=>a.row.expires_on<b.row.expires_on?-1:1):[];
  const max=Math.max(1,...waste.by_reason.map(entry=>Number(entry.qty)));
  return `<div class="inv-two"><div class="inv-box"><h3>Faltantes para reponer <small>${shortages.length} productos</small> <button class="inv-btn sm" data-act="csv-shortages">CSV</button></h3>
    ${shortages.length?shortages.map(entry=>`<div class="inv-row"><div class="t"><b>${esc(entry.name)}</b><span>${esc(entry.code)} · stock ${fmt(entry.stock)} / mín. ${fmt(entry.min_stock)}</span></div><span class="inv-pill ${entry.status==='out'?'bad':'warn'}">Faltan ${fmt(entry.missing)}</span></div>`).join(''):'<div class="inv-empty">Nada por reponer.</div>'}</div>
    <div class="inv-box"><h3>Mermas por motivo <small>${fmt(waste.total)} unidades</small> <button class="inv-btn sm" data-act="csv-waste">CSV</button></h3>
    <div class="inv-acts" style="margin-bottom:10px"><label class="inv-sub" style="margin:0">Desde <input type="date" id="invRepFrom" value="${esc(S.repFrom)}"></label><label class="inv-sub" style="margin:0">Hasta <input type="date" id="invRepTo" value="${esc(S.repTo)}"></label><button class="inv-btn sm" data-act="rep-apply">Aplicar</button></div>
    ${waste.by_reason.length?`<div class="inv-bars">${waste.by_reason.map(entry=>`<div class="inv-bar"><span>${esc(entry.reason)}</span><i><b style="width:${Number(entry.qty)/max*100}%"></b></i><span class="inv-num r">${fmt(entry.qty)}</span></div>`).join('')}</div>
      <div style="margin-top:10px">${waste.by_product.slice(0,8).map(entry=>`<div class="inv-row"><div class="t"><b>${esc(entry.name)}</b><span>${esc(entry.code)}</span></div><b class="inv-num inv-neg">${fmt(entry.qty)}</b></div>`).join('')}</div>`:'<div class="inv-empty">Sin mermas en el período.</div>'}</div></div>
    ${item.code==='tienda'?`<div class="inv-box"><h3>Vencimientos próximos (FEFO) <small>${expiring.length} lotes</small> <button class="inv-btn sm" data-act="csv-expiry">CSV</button></h3>
      ${expiring.length?expiring.map(({product,row})=>{const days=daysTo(row.expires_on);return `<div class="inv-row"><div class="t"><b>${esc(product.name)}</b><span>lote ${esc(row.lot_code)} · ${esc(row.location)} · ${fmt(row.qty)} unidades</span></div><span class="inv-pill ${days<0?'bad':days<=item.expiry_alert_days?'or':''}">${days<0?`Vencido hace ${-days} d`:days===0?'Vence hoy':`Vence en ${days} d`}</span></div>`}).join(''):'<div class="inv-empty">Sin lotes por vencer.</div>'}</div>`:''}`;
}

function viewMovements(){
  const filters=[['todos','Todos'],...invList().map(item=>[item.id,item.name])];
  const kinds=[['','Todos'],['receipt','Recepciones'],['waste','Mermas'],['issue','Salidas'],['adjustment','Ajustes'],['reversal','Correcciones']];
  const rows=S.movs.map(m=>{
    const reversed=m.reversed;
    return `<tr class="${reversed?'inv-void':''}"><td data-l="Fecha" class="inv-dim hid nw">${fstamp(m.created_at)}</td><td data-l="Tipo"><span class="inv-pill ${KIND_TONE[m.kind]||''}">${KIND_LABEL[m.kind]||m.kind}</span></td>
    <td data-l="Producto" class="ttl"><span class="nm">${esc(m.product_name)}</span><div class="mt">${esc(m.product_code)} · ${esc(invById(m.inventory_id)?.name||'')} · ${esc(m.location||'')}${m.lot_code?` · lote ${esc(m.lot_code)}`:''}</div></td>
    <td data-l="Cantidad" class="r inv-num ${m.qty>0?'inv-pos':'inv-neg'}">${m.qty>0?'+':''}${fmt(m.qty)}</td><td data-l="Usuario">${esc(m.created_by_name||'—')}<div class="mt inv-dim">${fstamp(m.created_at)}</div></td>
    <td data-l="Motivo">${esc([m.reason,m.note,m.reference].filter(Boolean).join(' · '))}${m.reverses_id?' <span class="inv-pill pu">corrección</span>':''}</td>
    <td>${isAdmin()&&!reversed&&!['reversal','opening','receipt'].includes(m.kind)?`<button class="inv-btn sm" data-act="reverse" data-id="${m.id}">Corregir</button>`:reversed?'<span class="inv-dim" style="font-size:12px">corregido</span>':''}</td></tr>`;
  }).join('');
  return `${head('Movimientos','Historial completo. Los movimientos no se editan ni se borran: se corrigen con un movimiento compensatorio.')}${tabs()}${syncHtml()}
    <div class="inv-chips">${filters.map(([key,label])=>`<button class="inv-chip ${S.movFilter.inv===key?'on':''}" data-minv="${key}">${esc(label)}</button>`).join('')}</div>
    <div class="inv-chips">${kinds.map(([key,label])=>`<button class="inv-chip ${S.movFilter.kind===key?'on':''}" data-mkind="${key}">${label}</button>`).join('')}</div>
    <div class="inv-tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th class="r">Cantidad</th><th>Usuario</th><th>Motivo / referencia</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="inv-empty">Sin movimientos.</td></tr>'}</tbody></table></div>`;
}

function viewApprovals(){
  const list=S.adjs;
  const pending=list.filter(entry=>entry.status==='pending');
  const done=list.filter(entry=>entry.status!=='pending');
  const card=entry=>{
    const delta=entry.delta;
    const changed=entry.current_stock!==entry.expected_qty;
    return `<div class="inv-box" style="margin-bottom:12px"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:flex-start">
      <div><b>${esc(entry.product_name)}</b><div class="inv-sub">${esc(entry.inventory)} · ${esc(entry.product_code)} · ${esc(entry.requested_by_name||'—')} · ${fstamp(entry.requested_at)}</div></div>
      <span class="inv-pill ${entry.status==='approved'?'ok':entry.status==='rejected'?'bad':'warn'}">${{approved:'Aprobado',rejected:'Rechazado',pending:'Pendiente'}[entry.status]}</span></div>
      <div class="inv-g2" style="margin:12px 0;max-width:440px"><div><div class="inv-sub">Sistema → contado</div><b class="inv-num" style="font-size:18px">${fmt(entry.expected_qty)} → ${fmt(entry.counted_qty)}</b></div><div><div class="inv-sub">Diferencia</div><b class="inv-num ${delta<0?'inv-neg':'inv-pos'}" style="font-size:18px">${delta>0?'+':''}${fmt(delta)}</b></div></div>
      <div class="inv-note">“${esc(entry.note||'')}”</div>
      ${entry.status==='pending'&&changed?`<div class="inv-note warn" style="margin-top:8px">El stock cambió desde el conteo (ahora ${fmt(entry.current_stock)}). Al aprobar se aplica la diferencia (${delta>0?'+':''}${fmt(delta)}) sobre el stock actual.</div>`:''}
      ${entry.status==='pending'?(isAdmin()?`<div class="inv-acts" style="margin-top:12px"><button class="inv-btn ok" data-act="adj-approve" data-id="${entry.id}">Aprobar ajuste</button><button class="inv-btn bad" data-act="adj-reject" data-id="${entry.id}">Rechazar</button></div>`:'<p class="inv-sub" style="margin-top:10px">Solo el administrador aprueba los ajustes.</p>')
      :`<div class="inv-sub" style="margin-top:8px">Revisado por ${esc(entry.reviewed_by_name||'—')} · ${fstamp(entry.reviewed_at)}${entry.review_note?` · ${esc(entry.review_note)}`:''}</div>`}</div>`;
  };
  return `${head('Aprobaciones','Los conteos con diferencia no cambian el stock hasta que el administrador los aprueba.')}${tabs()}${syncHtml()}
    ${pending.length?pending.map(card).join(''):'<div class="inv-box"><div class="inv-empty">No hay ajustes pendientes.</div></div>'}
    ${done.length?`<h3 style="margin:22px 0 10px;font-size:14px">Revisados</h3>${done.slice(0,30).map(card).join('')}`:''}`;
}

function viewAudit(){
  const rows=S.audit.map(entry=>`<tr><td data-l="Fecha" class="nw inv-dim">${fstamp(entry.at)}</td><td data-l="Usuario" class="ttl">${esc(entry.user_name||'—')}</td><td data-l="Acción"><span class="inv-pill info">${esc(entry.action)}</span></td><td data-l="Detalle" class="inv-dim">${esc(JSON.stringify(entry.details||{}).slice(0,140))}</td></tr>`).join('');
  return `${head('Auditoría','Quién hizo qué y cuándo. Solo el administrador la consulta y no se puede borrar.')}${tabs()}${syncHtml()}
    <div class="inv-tw"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="inv-empty">Sin registros.</td></tr>'}</tbody></table></div>`;
}

/* ----------------------------------------------------------- conteo */

const draftKey=()=>`inv.count.${S.userId}.${S.count?.id}`;
function saveDraft(){
  if(!S.count)return;
  try{
    const dirty={};
    Object.keys(S.count.dirty).forEach(id=>{dirty[id]=S.count.values[id]});
    localStorage.setItem(draftKey(),JSON.stringify(dirty));
  }catch(_error){}
}
function loadDraft(count){
  try{
    return JSON.parse(localStorage.getItem(`inv.count.${S.userId}.${count.id}`)||'null')||{};
  }catch(_error){return {}}
}
function clearDraft(){
  try{localStorage.removeItem(draftKey())}catch(_error){}
}

async function openCount(code){
  const item=invByCode(code);
  if(!item)return;
  S.view=`count:${code}`;
  S.filters={q:'',cat:'Todas',st:'todos'};
  S.count={loading:true,inventoryId:item.id,code,values:{},dirty:{},conflicts:{},others:{},since:null,review:false,saveState:'',filter:'all'};
  closeLayers();
  render();
  try{
    const [products,count]=await Promise.all([ensureProducts(item.id,true),Api.countStart(item.id)]);
    const values={};
    const others={};
    (count.lines||[]).forEach(line=>{
      values[line.product_id]={qty:String(line.counted_qty),note:line.note||''};
      if(line.counted_by&&line.counted_by!==Api.context()?.displayName)others[line.product_id]=line.counted_by;
    });
    S.count={id:count.id,loading:false,inventoryId:item.id,code,values,dirty:{},conflicts:{},others,since:new Date().toISOString(),review:false,saveState:'',filter:'all'};
    const draft=loadDraft(count);
    Object.entries(draft).forEach(([productId,value])=>{S.count.values[productId]=value;S.count.dirty[productId]=true});
    if(Object.keys(draft).length)S.count.saveState='Recuperamos conteos guardados en este dispositivo.';
    S.online=true;
    if(S.count.dirty&&Object.keys(S.count.dirty).length)scheduleSave(300);
  }catch(error){
    S.view=`inv:${code}`;
    handleError(error);
    S.count=null;
  }
  render();
}

function scheduleSave(delay=1500){
  clearTimeout(S.saveTimer);
  S.saveTimer=setTimeout(()=>countFlush(false),delay);
}

async function countFlush(final){
  clearTimeout(S.saveTimer);
  const count=S.count;
  if(!count||count.loading||!count.id)return true;
  const ids=Object.keys(count.dirty);
  if(!ids.length)return true;
  const lines=ids.map(id=>{
    const value=count.values[id]||{};
    return {product_id:id,counted_qty:value.qty===''||value.qty==null?null:Number(value.qty),note:value.note||null,since:count.since};
  });
  count.saveState='Guardando…';
  updateSaveState();
  try{
    const result=await Api.countSave(count.id,lines);
    count.since=result.server_time||new Date().toISOString();
    ids.forEach(id=>delete count.dirty[id]);
    (result.conflicts||[]).forEach(conflict=>{
      count.conflicts[conflict.product_id]=conflict;
    });
    count.saveState=(result.conflicts||[]).length?'Algunos productos ya fueron contados por otra persona.':'Guardado';
    S.online=true;
    saveDraft();
    if(!Object.keys(count.dirty).length)clearDraft();
    if((result.conflicts||[]).length&&!final)render();
    else updateSaveState();
    return true;
  }catch(error){
    const info=Api.classify(error);
    saveDraft();
    count.saveState=info.network?'Sin conexión: tus conteos están guardados en este dispositivo y se subirán al reconectar.':info.message;
    if(info.network){S.online=false;scheduleSave(8000)}
    updateSaveState();
    return false;
  }
}
function updateSaveState(){
  const el=$('invSaveState');
  if(el)el.textContent=S.count?.saveState||'';
}

function countStats(){
  const list=(S.products[S.count.inventoryId]||[]).filter(product=>product.active);
  const done=list.filter(product=>S.count.values[product.id]&&S.count.values[product.id].qty!=='').length;
  return {list,done};
}

function viewCount(){
  const count=S.count;
  const item=invByCode(S.view.slice(6));
  if(!count||count.loading||!item)return `${head('Toma de inventario','')}<div class="inv-empty">Preparando el conteo…</div>`;
  const {list,done}=countStats();
  if(count.review)return viewCountReview(item,list);
  const q=S.filters.q.trim().toLowerCase();
  const rows=list.filter(product=>{
    if(q&&!matches(product,q))return false;
    const counted=count.values[product.id]&&count.values[product.id].qty!=='';
    return count.filter==='all'||(count.filter==='pending'&&!counted)||(count.filter==='done'&&counted);
  });
  const conflictCount=Object.keys(count.conflicts).length;
  return `${head(`Toma de inventario · ${item.name}`,'Cuenta lo que ves en el estante. El stock del sistema se muestra solo al revisar.',`<button class="inv-btn" data-go="inv:${item.code}">Salir del conteo</button>`,'Inventarios')}${syncHtml()}
    <div class="inv-tools"><label class="inv-search"><span class="inv-dim">⌕</span><input id="invQ" type="search" placeholder="Buscar producto o código" value="${esc(S.filters.q)}" autocomplete="off"></label>
      ${scannerSupported()?'<button class="inv-btn" data-act="scan-count" aria-label="Escanear código de barras">Escanear</button>':''}</div>
    <div class="inv-chips">${[['all','Todos'],['pending','Pendientes'],['done','Contados']].map(([key,label])=>`<button class="inv-chip ${count.filter===key?'on':''}" data-cfilter="${key}">${label}</button>`).join('')}</div>
    <div style="margin:4px 0 14px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span id="invProgText">${done} de ${list.length} contados</span><span id="invSaveState">${esc(count.saveState||'')}</span></div><div class="inv-prog"><b id="invProgBar" style="width:${list.length?done/list.length*100:0}%"></b></div></div>
    ${conflictCount?`<div class="inv-note warn" style="margin-bottom:12px">Otra persona ya contó ${plural(conflictCount,'producto','productos')} mientras tú trabajabas. Revisa las filas marcadas y elige qué valor conservar.</div>`:''}
    ${rows.map(product=>countRow(product)).join('')||'<div class="inv-empty">Sin resultados.</div>'}
    <div class="inv-sticky"><button class="inv-btn" data-act="count-save">Guardar parcial</button><button class="inv-btn pri" data-act="count-review"${done?'':' disabled'} id="invReviewBtn">Revisar diferencias</button></div>`;
}
function countRow(product){
  const count=S.count;
  const value=count.values[product.id];
  const counted=value&&value.qty!=='';
  const conflict=count.conflicts[product.id];
  return `<div class="inv-crow ${counted?'done':''} ${conflict?'conflict':''}" data-row="${product.id}"><div class="nmc"><b>${esc(product.name)}</b><span>${esc(product.code)}${product.default_location?` · ${esc(product.default_location)}`:''}${product.control_unit==='cajetilla'?' · en cajetillas':''}${count.others[product.id]?` · contó ${esc(count.others[product.id])}`:''}</span>
    ${conflict?`<div class="inv-err" style="margin-top:6px">${esc(conflict.counted_by||'Otra persona')} contó <b>${fmt(conflict.counted_qty)}</b> a las ${fstamp(conflict.counted_at)}. <button class="inv-btn sm" data-act="conflict-take" data-id="${product.id}">Usar ese valor</button> <button class="inv-btn sm" data-act="conflict-keep" data-id="${product.id}">Mantener el mío</button></div>`:''}</div>
    <div class="inv-cnt"><button data-step="${product.id}:-1" aria-label="Restar uno a ${esc(product.name)}">−</button><input inputmode="numeric" pattern="[0-9]*" data-cnt="${product.id}" value="${esc(value?value.qty:'')}" placeholder="—" aria-label="Cantidad contada de ${esc(product.name)}"><button data-step="${product.id}:1" aria-label="Sumar uno a ${esc(product.name)}">+</button></div></div>`;
}
function viewCountReview(item,list){
  const rows=list.filter(product=>S.count.values[product.id]&&S.count.values[product.id].qty!=='');
  const missing=S.count.missing||[];
  return `${head(`Revisar conteo · ${item.name}`,`${plural(rows.length,'producto contado','productos contados')}. Revisa las diferencias antes de enviar.`,'','Inventarios')}${syncHtml()}
    <div class="inv-note" style="margin-bottom:12px">Enviar el conteo <b>no modifica el stock</b>: cada diferencia queda como ajuste pendiente de aprobación del administrador${item.auto_approve_max_abs>0?` (las de hasta ${item.auto_approve_max_abs} unidades se aplican solas)`:''}.</div>
    ${rows.map(product=>{
      const value=S.count.values[product.id];
      const diff=Number(value.qty)-product.stock;
      const flagged=missing.includes(product.id);
      return `<div class="inv-box" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(product.name)}</b><div class="inv-sub">Sistema ${fmt(product.stock)} · Contado ${fmt(value.qty)}</div></div><span class="inv-pill ${diff===0?'ok':'warn'}">${diff===0?'Exacto':`${diff>0?'+':''}${fmt(diff)}`}</span></div>
      ${diff!==0?`<div class="inv-fld" style="margin:10px 0 0"><label for="n-${product.id}">Observación (obligatoria)</label><input id="n-${product.id}" data-note="${product.id}" value="${esc(value.note||'')}" placeholder="Qué pasó con esta diferencia">${flagged?'<div class="inv-err">Falta la observación.</div>':''}</div>`:''}</div>`;
    }).join('')}
    <div class="inv-err" id="invFormErr" style="margin:8px 0"></div>
    <div class="inv-sticky"><button class="inv-btn" data-act="count-back">Volver al conteo</button><button class="inv-btn pri" data-act="count-send">Enviar conteo</button></div>`;
}

async function reviewCount(){
  const ok=await countFlush(false);
  if(!ok&&!S.online){toast('Sin conexión: no se puede revisar el conteo todavía.');return}
  try{
    await ensureProducts(S.count.inventoryId,true);
    S.count.review=true;
    S.count.missing=[];
    render();
    window.scrollTo({top:0});
  }catch(error){handleError(error)}
}

function sendCount(){
  const {list}=countStats();
  const rows=list.filter(product=>S.count.values[product.id]&&S.count.values[product.id].qty!=='');
  const missing=[];
  rows.forEach(product=>{
    const input=document.querySelector(`[data-note="${product.id}"]`);
    if(input)S.count.values[product.id].note=input.value.trim();
    const diff=Number(S.count.values[product.id].qty)-product.stock;
    if(diff!==0&&!S.count.values[product.id].note)missing.push(product.id);
    if(diff!==0)S.count.dirty[product.id]=true;
  });
  if(missing.length){
    S.count.missing=missing;
    render();
    const el=$('invFormErr');
    if(el)el.textContent='Escribe la observación en los productos con diferencia.';
    return;
  }
  const diffs=rows.filter(product=>Number(S.count.values[product.id].qty)!==product.stock).length;
  confirmBox({
    title:'Enviar conteo',
    text:`Vas a enviar ${plural(rows.length,'producto contado','productos contados')}: ${diffs?`${plural(diffs,'diferencia queda','diferencias quedan')} pendiente${diffs===1?'':'s'} de aprobación. `:'sin diferencias. '}El stock no cambia hasta que el administrador apruebe.`,
    label:'Enviar conteo',
    onConfirm:async()=>{
      S.count.requestId=S.count.requestId||Api.uuid();
      setBusy('invConfirmOk',true,'Enviando…');
      try{
        const flushed=await countFlush(true);
        if(!flushed)throw new Api.InventoryError({code:'network',network:true,message:'Sin conexión: el conteo está guardado en este dispositivo. Reintenta al volver.'});
        const result=await Api.countSubmit(S.count.requestId,S.count.id);
        clearDraft();
        const code=S.count.code;
        S.count=null;
        closeLayers();
        await refreshOverview();
        S.view=`inv:${code}`;
        S.sub='products';
        await loadView();
        render();
        toast(`Conteo enviado: ${result.exact} exactos, ${result.pending} por aprobar${result.auto_approved?`, ${result.auto_approved} aplicados automáticamente`:''}. El stock no cambió.`);
      }catch(error){
        const info=Api.classify(error);
        setBusy('invConfirmOk',false);
        if(info.code==='note_required'&&info.detail?.products){
          closeLayers();
          S.count.missing=info.detail.products.map(entry=>entry.product_id);
          S.count.requestId=null;
          render();
          toast(info.message);
        }else{
          if(!info.network)S.count.requestId=null;
          handleError(info,{form:true});
        }
      }
    }
  });
}

/* ------------------------------------------------ cámara (opcional) */

let scanStream=null;
let scanTimer=null;
const scannerSupported=()=>Boolean(window.BarcodeDetector&&navigator.mediaDevices?.getUserMedia);
function stopScanner(){
  clearInterval(scanTimer);
  scanTimer=null;
  if(scanStream){scanStream.getTracks().forEach(track=>track.stop());scanStream=null}
}
async function openScanner(onCode){
  if(!scannerSupported()){toast('Este dispositivo no permite leer códigos con la cámara.');return}
  openModal('Escanear código de barras','<video id="invCam" class="inv-cam" playsinline muted></video><p class="inv-sub" style="margin-top:8px">Apunta la cámara al código de barras del producto.</p><div class="inv-err" id="invFormErr"></div>',
    '<button class="inv-btn" data-act="close">Cancelar</button>');
  S.form={type:'scanner'};
  try{
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video=$('invCam');
    if(!video){stopScanner();return}
    video.srcObject=scanStream;
    await video.play().catch(()=>{});
    const detector=new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code']});
    scanTimer=setInterval(async()=>{
      try{
        const found=await detector.detect(video);
        if(found&&found.length){
          const value=found[0].rawValue;
          closeModalOnly();
          onCode(value);
        }
      }catch(_error){}
    },300);
  }catch(_error){
    setFormError('No se pudo abrir la cámara. Puedes buscar el producto escribiendo su código.');
  }
}

/* ------------------------------------------------------------ ficha */

async function openProduct(productId){
  let product=null;
  let item=null;
  invList().some(entry=>{
    const found=(S.products[entry.id]||[]).find(row=>row.id===productId);
    if(found){product=found;item=entry}
    return Boolean(found);
  });
  if(!product)return;
  ensureLayer();
  renderDrawer(product,item,null);
  showLayer('invDrw');
  try{
    const movs=await Api.movements(S.companyId,{productId,limit:15});
    renderDrawer(product,item,movs);
  }catch(error){handleError(error)}
}
function renderDrawer(product,item,movs){
  const admin=isAdmin();
  const lots=(product.stock_detail||[]).filter(row=>row.lot_id);
  const places=(product.stock_detail||[]).reduce((map,row)=>{map[row.location]=(map[row.location]||0)+row.qty;return map},{});
  const extra={
    tienda:`<div><dt>Marca</dt><dd>${esc(product.brand||'—')}</dd></div><div><dt>Categoría</dt><dd>${esc(product.category||'—')}</dd></div><div><dt>Control de vencimiento</dt><dd>${product.tracks_expiry?'Sí':'No'}</dd></div>`,
    cigarrillos:`<div><dt>Marca</dt><dd>${esc(product.brand||'—')}</dd></div><div><dt>Variedad</dt><dd>${esc(attrOf(product,'variety')||'—')}</dd></div><div><dt>Recepción</dt><dd>${product.receive_unit?`1 ${esc(product.receive_unit)} = ${fmt(product.receive_factor)} cajetillas`:'Solo cajetillas'}</dd></div>`,
    lubricantes:`<div><dt>Marca</dt><dd>${esc(product.brand||'—')}</dd></div><div><dt>Viscosidad</dt><dd>${esc(attrOf(product,'viscosity')||'—')}</dd></div><div><dt>Especificación</dt><dd>${esc(attrOf(product,'spec')||'—')}</dd></div>`
  }[item.code];
  $('invDrw').innerHTML=`<div class="inv-xh"><div><span class="inv-pill ${item.code==='cigarrillos'?'pu':item.code==='lubricantes'?'info':'ok'}">${esc(item.name)}</span><h3 style="margin:8px 0 0;font-size:20px">${esc(product.name)}</h3></div><button class="inv-x" data-act="close" aria-label="Cerrar">×</button></div>
    <div class="inv-hero" style="--inv-ac:${item.code==='cigarrillos'?'var(--purple)':item.code==='lubricantes'?'var(--blue)':'var(--cyan)'}"><div style="display:flex;gap:12px;align-items:flex-end;justify-content:space-between"><div><span class="inv-big inv-num">${fmt(product.stock)}</span><div class="inv-sub">${esc(unitPlural(product.control_unit))} · calculado de los movimientos</div></div><div style="text-align:right">${statusPills(product,item)}<div class="inv-sub" style="margin-top:6px">Mínimo <b class="inv-num" style="color:var(--text)">${fmt(product.min_stock)}</b></div></div></div>${gauge(product)}<div class="lg"><span>0</span><span>mínimo</span><span>${fmt(product.min_stock*2)}+</span></div></div>
    <dl class="inv-dl"><div><dt>Código interno</dt><dd>${esc(product.code)}</dd></div><div><dt>Código de barras</dt><dd class="inv-num">${esc(product.barcode||'—')}</dd></div>${extra}<div><dt>Presentación</dt><dd>${esc(product.presentation||'—')}</dd></div><div><dt>Unidad de control</dt><dd>${esc(product.control_unit)}</dd></div><div><dt>Ubicación</dt><dd>${esc(product.default_location||'—')}</dd></div><div><dt>Estado</dt><dd>${product.active?'Activo':'Inactivo'}</dd></div><div><dt>Creado</dt><dd>${fdate(product.created_at)}${product.created_by_name?` · ${esc(product.created_by_name)}`:''}</dd></div></dl>
    ${Object.keys(places).length>1?`<h4 style="margin:0 0 6px">Stock por ubicación</h4>${Object.entries(places).map(([name,qty])=>`<div class="inv-lotrow"><div class="t"><b>${esc(name)}</b></div><b class="inv-num">${fmt(qty)}</b></div>`).join('')}`:''}
    <div class="inv-acts" style="margin:14px 0 16px">${product.active?`${item.code==='tienda'?`<button class="inv-btn" data-act="waste" data-id="${product.id}">Registrar merma</button>`:''}<button class="inv-btn" data-act="issue" data-id="${product.id}">Salida justificada</button><button class="inv-btn" data-act="transfer" data-id="${product.id}"${item.locations.filter(row=>row.active).length<2?' disabled title="Necesita al menos dos ubicaciones"':''}>Trasladar</button>`:''}
      ${admin?`<button class="inv-btn" data-act="product-edit" data-id="${product.id}">Editar</button><button class="inv-btn ${product.active?'bad':''}" data-act="product-toggle" data-id="${product.id}">${product.active?'Desactivar':'Activar'}</button>`:''}</div>
    ${lots.length?`<h4 style="margin:0 0 6px">Lotes · FEFO: sale primero lo que vence antes</h4>${lots.map((row,index)=>{const days=daysTo(row.expires_on);return `<div class="inv-lotrow"><div class="t"><b>${esc(row.lot_code)}</b><span>Vence ${fdate(row.expires_on)} · ${esc(row.location)}</span></div>${index===0?'<span class="inv-pill info">Salir primero</span>':''}${days<0?'<span class="inv-pill bad">Vencido</span>':days<=item.expiry_alert_days?`<span class="inv-pill or">${days} d</span>`:''}<b class="inv-num">${fmt(row.qty)}</b></div>`}).join('')}`:''}
    <h4 style="margin:16px 0 6px">Últimos movimientos</h4>${movs===null?'<div class="inv-sub">Cargando…</div>':movs.map(movRow).join('')||'<div class="inv-sub">Sin movimientos.</div>'}`;
}

/* -------------------------------------------------------- formularios */

const field=(label,control,hint)=>`<div class="inv-fld"><label>${label}</label>${control}${hint?`<div class="hint">${hint}</div>`:''}</div>`;
const optionsHtml=(list,selected,empty)=>`${empty?`<option value="">${esc(empty)}</option>`:''}${list.map(entry=>`<option value="${esc(entry.value)}"${String(entry.value)===String(selected)?' selected':''}>${esc(entry.label)}</option>`).join('')}`;

function productById(inventoryId,productId){
  return (S.products[inventoryId]||[]).find(product=>product.id===productId);
}
function findProduct(productId){
  for(const item of invList()){
    const product=productById(item.id,productId);
    if(product)return {product,item};
  }
  return {product:null,item:null};
}

/* Recepción */
function openReceive(code){
  const item=invByCode(code);
  if(!item)return;
  S.form={type:'receive',inventoryId:item.id,requestId:Api.uuid(),lines:[{pid:'',qty:'',unit:'base',loc:'',lot:'',exp:''}],busy:false};
  const invoices=(window.InvoiceModule?.getAll?.()||[]).filter(entry=>entry.numeroFactura).slice(0,60);
  const suppliers=[...new Set([...(S.receipts[item.id]||[]).map(receipt=>receipt.supplier),...invoices.map(entry=>entry.proveedor)].filter(Boolean))];
  openModal(`Recepción de mercadería · ${esc(item.name)}`,`
    <div class="inv-g2">${field('Proveedor',`<input id="recSupplier" list="recSuppliers" autocomplete="off"><datalist id="recSuppliers">${suppliers.map(name=>`<option value="${esc(name)}">`).join('')}</datalist>`)}
      ${field('Fecha de recepción',`<input id="recDate" type="date" value="${todayIso()}" max="${todayIso()}">`)}</div>
    <div class="inv-g2">${field('N.º de factura o documento',`<input id="recDoc" autocomplete="off" placeholder="Ej.: F-1190">`)}
      ${field('Responsable',`<input value="${esc(Api.context()?.displayName||'')}" readonly>`)}</div>
    ${field('Factura vinculada (opcional)',`<select id="recInvoice"><option value="">Sin factura vinculada</option>${invoices.map(entry=>`<option value="${esc(entry.numeroFactura)}" data-supplier="${esc(entry.proveedor||'')}">${esc(entry.numeroFactura)} · ${esc(entry.proveedor||'')}${entry.aprobacion==='pendiente_aprobacion'?' · pendiente de aprobación':''}</option>`).join('')}</select>`,
      'Recibir mercadería no aprueba ni paga la factura, y una factura ingresada no significa que todo llegó: son registros distintos.')}
    <div class="inv-fld"><label>Productos recibidos</label><div id="recLines"></div><button class="inv-btn sm" data-act="rec-add" style="justify-self:start">+ Agregar producto</button></div>
    ${field('Observaciones','<textarea id="recNotes" rows="2"></textarea>')}
    <div class="inv-err" id="invFormErr"></div>`,
    '<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn pri" data-act="rec-ok" id="invRecOk">Confirmar recepción</button>');
  renderRecLines();
}
function renderRecLines(){
  const form=S.form;
  if(!form||form.type!=='receive')return;
  const products=(S.products[form.inventoryId]||[]).filter(product=>product.active);
  const item=invById(form.inventoryId);
  const locations=item.locations.filter(row=>row.active);
  const holder=$('recLines');
  if(!holder)return;
  holder.innerHTML=form.lines.map((line,index)=>{
    const product=products.find(entry=>entry.id===line.pid);
    const purchase=product&&product.receive_unit;
    const factor=product?product.receive_factor:1;
    const baseQty=Number(line.qty||0)*(line.unit==='purchase'?factor:1);
    return `<div class="inv-line"><select data-rl="${index}:pid" aria-label="Producto"><option value="">Producto…</option>${products.map(entry=>`<option value="${entry.id}"${entry.id===line.pid?' selected':''}>${esc(entry.name)}${entry.presentation?` · ${esc(entry.presentation)}`:''}</option>`).join('')}</select>
      <input type="number" min="1" step="1" inputmode="numeric" placeholder="Cant." data-rl="${index}:qty" value="${esc(line.qty)}" aria-label="Cantidad">
      <select data-rl="${index}:unit" aria-label="Unidad"${purchase?'':' disabled'}><option value="base"${line.unit==='base'?' selected':''}>${esc(product?unitPlural(product.control_unit):'Unidades')}</option>${purchase?`<option value="purchase"${line.unit==='purchase'?' selected':''}>${esc(unitPlural(product.receive_unit))}</option>`:''}</select>
      <button class="inv-btn sm" data-act="rec-del" data-i="${index}" aria-label="Quitar línea"${form.lines.length<2?' disabled':''}>×</button></div>
      ${product&&line.unit==='purchase'&&line.qty?`<div class="inv-conv" id="recConv-${index}">${fmt(line.qty)} ${esc(unitPlural(product.receive_unit))} × ${fmt(factor)} = ${fmt(baseQty)} ${esc(unitPlural(product.control_unit))}</div>`:`<div id="recConv-${index}"></div>`}
      ${product&&product.tracks_expiry?`<div class="inv-line lot"><input data-rl="${index}:lot" value="${esc(line.lot)}" placeholder="Lote (opcional)" aria-label="Lote"><input type="date" data-rl="${index}:exp" value="${esc(line.exp)}" aria-label="Vencimiento"></div>`:''}
      ${product&&locations.length>1?`<div class="inv-line lot"><select data-rl="${index}:loc" aria-label="Ubicación">${optionsHtml(locations.map(row=>({value:row.id,label:row.name})),line.loc||product.default_location_id,'Ubicación predeterminada')}</select></div>`:''}`;
  }).join('');
}
async function submitReceive(){
  const form=S.form;
  if(!form||form.busy)return;
  const supplier=$('recSupplier').value.trim();
  const doc=$('recDoc').value.trim();
  if(!supplier)return setFormError('Indica el proveedor.');
  if(!doc)return setFormError('Indica el número de factura o documento.');
  const lines=form.lines.filter(line=>line.pid&&Number(line.qty)>0);
  if(!lines.length)return setFormError('Agrega al menos un producto con cantidad.');
  const products=S.products[form.inventoryId]||[];
  for(const line of lines){
    const product=products.find(entry=>entry.id===line.pid);
    if(product?.tracks_expiry&&!line.exp)return setFormError(`${product.name} necesita fecha de vencimiento.`);
  }
  setFormError('');
  form.busy=true;
  setBusy('invRecOk',true,'Registrando…');
  try{
    const result=await Api.receive(form.requestId,form.inventoryId,{
      supplier,document_no:doc,received_on:$('recDate').value||null,
      invoice_ref:$('recInvoice').value||null,notes:$('recNotes').value.trim()||null
    },lines.map(line=>({product_id:line.pid,qty:Number(line.qty),unit:line.unit,location_id:line.loc||null,lot_code:line.lot||null,expires_on:line.exp||null})));
    closeLayers();
    await afterWrite();
    toast(result.replayed?'La recepción ya estaba registrada.':`Recepción registrada: ${plural(result.lines,'producto','productos')}.`);
  }catch(error){
    form.busy=false;
    setBusy('invRecOk',false);
    const info=handleError(error,{form:true});
    if(!info.network)form.requestId=Api.uuid();
  }
}

/* Salidas, mermas y traslados */
function openMovementForm(kind,productId){
  const {product,item}=findProduct(productId);
  if(!product)return;
  const locations=item.locations.filter(row=>row.active);
  const reasons=kind==='waste'?WASTE_REASONS:ISSUE_REASONS;
  const lots=(product.stock_detail||[]).filter(row=>row.lot_id);
  S.form={type:'movement',kind,productId,requestId:Api.uuid(),busy:false,inventoryId:item.id};
  const title={waste:'Registrar merma',issue:'Salida justificada',transfer:'Trasladar'}[kind];
  const body=kind==='transfer'
    ?`${field('Desde',`<select id="mvFrom">${optionsHtml(locations.map(row=>({value:row.id,label:row.name})),product.default_location_id)}</select>`)}
      ${field('Hasta',`<select id="mvTo">${optionsHtml(locations.map(row=>({value:row.id,label:row.name})),'')}</select>`)}
      <div class="inv-g2">${field('Cantidad','<input id="mvQty" type="number" min="1" step="1" inputmode="numeric">')}${field('Observación','<input id="mvNote">')}</div>`
    :`<div class="inv-g2">${field('Cantidad','<input id="mvQty" type="number" min="1" step="1" inputmode="numeric" placeholder="0">',`Disponible: ${fmt(product.stock)}`)}${field('Motivo',`<select id="mvReason">${reasons.map(reason=>`<option>${esc(reason)}</option>`).join('')}</select>`)}</div>
      ${lots.length?field('Lote',`<select id="mvLot"><option value="">Automático (FEFO: primero el que vence antes)</option>${lots.map(row=>`<option value="${row.lot_id}">${esc(row.lot_code)} · vence ${fdate(row.expires_on)} · ${fmt(row.qty)} u.</option>`).join('')}</select>`):''}
      ${locations.length>1?field('Ubicación',`<select id="mvLoc"><option value="">Cualquiera (la predeterminada primero)</option>${locations.map(row=>`<option value="${row.id}">${esc(row.name)}</option>`).join('')}</select>`):''}
      ${field('Observación'+(kind==='issue'?' (obligatoria)':''),'<textarea id="mvNote" rows="2" placeholder="Qué ocurrió y quién lo autorizó"></textarea>')}`;
  openModal(`${title} · ${esc(product.name)}`,`${body}<div class="inv-err" id="invFormErr"></div>`,
    '<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn pri" data-act="mv-ok" id="invMvOk">Confirmar</button>');
}
async function submitMovement(){
  const form=S.form;
  if(!form||form.busy)return;
  const qty=Number($('mvQty').value);
  if(!(qty>0))return setFormError('Ingresa una cantidad mayor que cero.');
  const note=$('mvNote')?$('mvNote').value.trim():'';
  if(form.kind==='issue'&&!note)return setFormError('Explica la justificación en la observación.');
  if(form.kind!=='transfer'&&$('mvReason').value==='Otra causa justificada'&&!note)return setFormError('Explica la causa en la observación.');
  setFormError('');
  form.busy=true;
  setBusy('invMvOk',true,'Registrando…');
  try{
    if(form.kind==='transfer'){
      await Api.transfer(form.requestId,{productId:form.productId,from:$('mvFrom').value,to:$('mvTo').value,qty,note});
    }else{
      await Api.issue(form.requestId,{
        productId:form.productId,kind:form.kind==='waste'?'waste':'issue',qty,reason:$('mvReason').value,note,
        locationId:$('mvLoc')?$('mvLoc').value||null:null,lotId:$('mvLot')?$('mvLot').value||null:null
      });
    }
    closeLayers();
    await afterWrite();
    toast({waste:'Merma registrada.',issue:'Salida registrada.',transfer:'Traslado registrado.'}[form.kind]);
  }catch(error){
    form.busy=false;
    setBusy('invMvOk',false);
    const info=handleError(error,{form:true});
    if(!info.network)form.requestId=Api.uuid();
  }
}

/* Producto (administrador) */
function openProductForm(code,productId){
  const item=invByCode(code);
  if(!item)return;
  const product=productId?productById(item.id,productId):null;
  const locations=item.locations.filter(row=>row.active);
  S.form={type:'product',inventoryId:item.id,productId,version:product?.version,busy:false};
  const cats=[...new Set((S.products[item.id]||[]).map(entry=>entry.category).filter(Boolean))];
  const p=product||{};
  const specific=item.code==='cigarrillos'
    ?`<div class="inv-g2">${field('Variedad',`<input id="pfVariety" value="${esc(attrOf(p,'variety'))}">`)}${field('Cajetillas por cartón',`<input id="pfFactor" type="number" min="1" step="1" value="${esc(p.receive_factor||10)}">`,'Se usa al recibir por cartón.')}</div><input type="hidden" id="pfRecvUnit" value="cartón">`
    :item.code==='lubricantes'
      ?`<div class="inv-g2">${field('Viscosidad',`<input id="pfVisc" value="${esc(attrOf(p,'viscosity'))}" placeholder="5W-30">`)}${field('Especificación técnica',`<input id="pfSpec" value="${esc(attrOf(p,'spec'))}" placeholder="API SP · ACEA C3">`)}</div>`
      :`${field('Control de vencimiento',`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pfExpiry"${p.tracks_expiry?' checked':''} style="min-height:auto"> Registrar lotes y fechas de vencimiento</label>`)}`;
  openModal(product?`Editar producto · ${esc(product.name)}`:`Nuevo producto · ${esc(item.name)}`,`
    <div class="inv-g2">${field(item.code==='lubricantes'?'SKU':'Código interno',`<input id="pfCode" value="${esc(p.code||'')}" autocomplete="off">`)}${field('Código de barras',`<input id="pfBarcode" inputmode="numeric" value="${esc(p.barcode||'')}" placeholder="Opcional">`)}</div>
    ${field('Descripción',`<input id="pfName" value="${esc(p.name||'')}">`)}
    <div class="inv-g2">${field('Marca',`<input id="pfBrand" value="${esc(p.brand||'')}">`)}${field('Presentación',`<input id="pfPres" value="${esc(p.presentation||'')}" placeholder="${item.code==='lubricantes'?'1 L, 4 L, 5 L':item.code==='cigarrillos'?'Cajetilla 20':'Botella 500 ml'}">`,product&&'No se puede cambiar si el producto ya tiene movimientos.')}</div>
    ${item.code==='tienda'?field('Categoría',`<input id="pfCat" list="pfCats" value="${esc(p.category||'')}" autocomplete="off"><datalist id="pfCats">${cats.map(name=>`<option value="${esc(name)}">`).join('')}</datalist>`):''}
    ${specific}
    <div class="inv-g2">${field('Ubicación predeterminada',`<select id="pfLoc">${optionsHtml(locations.map(row=>({value:row.id,label:row.name})),p.default_location_id,'Sin ubicación')}</select>`)}${field('Stock mínimo',`<input id="pfMin" type="number" min="0" step="1" value="${esc(p.min_stock??0)}">`)}</div>
    <div class="inv-err" id="invFormErr"></div>`,
    '<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn pri" data-act="pf-ok" id="invPfOk">Guardar</button>');
}
async function submitProduct(){
  const form=S.form;
  if(!form||form.busy)return;
  const item=invById(form.inventoryId);
  const payload={
    code:$('pfCode').value.trim(),barcode:$('pfBarcode').value.trim(),name:$('pfName').value.trim(),brand:$('pfBrand').value.trim(),
    presentation:$('pfPres').value.trim(),default_location_id:$('pfLoc').value||null,min_stock:Number($('pfMin').value||0),
    category:$('pfCat')?$('pfCat').value.trim():item.name
  };
  if(item.code==='cigarrillos'){
    payload.receive_unit='cartón';
    payload.receive_factor=Number($('pfFactor').value||10);
    payload.attrs={variety:$('pfVariety').value.trim()};
  }else if(item.code==='lubricantes'){
    payload.attrs={viscosity:$('pfVisc').value.trim(),spec:$('pfSpec').value.trim()};
  }else{
    payload.tracks_expiry=$('pfExpiry').checked;
  }
  if(!payload.code)return setFormError('El producto necesita un código.');
  if(!payload.name)return setFormError('El producto necesita una descripción.');
  if(form.productId){payload.id=form.productId;payload.expected_version=form.version}
  setFormError('');
  form.busy=true;
  setBusy('invPfOk',true);
  try{
    await Api.saveProduct(form.inventoryId,payload);
    closeLayers();
    await afterWrite();
    toast(form.productId?'Producto actualizado.':'Producto creado con stock 0. Registra una recepción o el saldo inicial.');
  }catch(error){
    form.busy=false;
    setBusy('invPfOk',false);
    const info=handleError(error,{form:true});
    if(info.code==='version_conflict'){await ensureProducts(form.inventoryId,true).catch(()=>{});render()}
  }
}

/* Saldo inicial (administrador) */
function openOpening(code){
  const item=invByCode(code);
  if(!item)return;
  const products=(S.products[item.id]||[]).filter(product=>product.active);
  S.form={type:'opening',inventoryId:item.id,requestId:Api.uuid(),busy:false};
  openModal(`Saldo inicial · ${esc(item.name)}`,`<div class="inv-note warn" style="margin-bottom:12px">Úsalo al poner en marcha el inventario, con lo que cuentes físicamente. Cada cantidad entra como un movimiento «Saldo inicial» y queda en la auditoría. Para correcciones posteriores usa conteos y ajustes.</div>
    ${products.length?products.map(product=>`<div class="inv-line" style="grid-template-columns:1fr 90px${product.tracks_expiry?' 150px':''}"><div><b>${esc(product.name)}</b><div class="inv-sub" style="font-size:12px">${esc(product.code)} · stock actual ${fmt(product.stock)}</div></div><input type="number" min="0" step="1" inputmode="numeric" data-op="${product.id}" placeholder="Cant." aria-label="Saldo inicial de ${esc(product.name)}">${product.tracks_expiry?`<input type="date" data-opexp="${product.id}" aria-label="Vencimiento de ${esc(product.name)}">`:''}</div>`).join(''):'<div class="inv-empty">Primero crea los productos.</div>'}
    <div class="inv-err" id="invFormErr"></div>`,
    '<button class="inv-btn" data-act="close">Cancelar</button><button class="inv-btn pri" data-act="op-ok" id="invOpOk">Registrar saldo inicial</button>');
}
async function submitOpening(){
  const form=S.form;
  if(!form||form.busy)return;
  const products=S.products[form.inventoryId]||[];
  const lines=[];
  for(const input of document.querySelectorAll('[data-op]')){
    const qty=Number(input.value);
    if(!(qty>0))continue;
    const product=products.find(entry=>entry.id===input.dataset.op);
    const expiry=document.querySelector(`[data-opexp="${input.dataset.op}"]`)?.value||null;
    if(product?.tracks_expiry&&!expiry)return setFormError(`${product.name} necesita fecha de vencimiento.`);
    lines.push({product_id:input.dataset.op,qty,expires_on:expiry});
  }
  if(!lines.length)return setFormError('Ingresa al menos una cantidad.');
  confirmBox({
    title:'Registrar saldo inicial',
    text:`Se registrarán ${plural(lines.length,'producto','productos')} con su saldo inicial. Esta acción queda en la auditoría.`,
    label:'Registrar',
    onConfirm:async()=>{
      setBusy('invConfirmOk',true,'Registrando…');
      try{
        await Api.opening(form.requestId,form.inventoryId,lines);
        closeLayers();
        await afterWrite();
        toast('Saldo inicial registrado.');
      }catch(error){
        setBusy('invConfirmOk',false);
        const info=handleError(error,{form:true});
        if(!info.network)form.requestId=Api.uuid();
      }
    }
  });
}

async function afterWrite(){
  try{
    await refreshOverview();
    if(S.view.startsWith('inv:')){
      const item=invByCode(S.view.slice(4));
      if(item){
        S.products[item.id]=await Api.products(item.id);
        if(S.sub==='receipts')S.receipts[item.id]=await Api.receipts(item.id,50);
        if(S.sub==='reports')await loadView();
      }
    }else{
      await loadView();
    }
  }catch(error){
    handleError(error);
  }
  render();
}

/* ------------------------------------------------------------- CSV */

function downloadCsv(name,rows){
  const text=rows.map(row=>row.map(cell=>{
    const value=String(cell??'');
    return /[",\n;]/.test(value)?`"${value.replace(/"/g,'""')}"`:value;
  }).join(';')).join('\n');
  const blob=new Blob(['﻿'+text],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=name;
  document.body.appendChild(link);
  link.click();
  setTimeout(()=>{URL.revokeObjectURL(link.href);link.remove()},500);
}

/* ------------------------------------------------------------ eventos */

async function onRootClick(event){
  const target=event.target.closest('[data-go],[data-act],[data-open],[data-cat],[data-sub],[data-minv],[data-mkind],[data-cfilter],[data-step]');
  if(!target)return;
  const data=target.dataset;
  if(data.go){go(data.go);return}
  if(data.sub){S.sub=data.sub;S.filters={q:'',cat:'Todas',st:'todos'};render();try{await loadView()}catch(error){handleError(error)}render();return}
  if(data.open){openProduct(data.open);return}
  if(data.cat!==undefined){S.filters.cat=data.cat;renderList();return}
  if(data.minv){S.movFilter.inv=data.minv;await go('mov');return}
  if(data.mkind!==undefined){S.movFilter.kind=data.mkind;await go('mov');return}
  if(data.cfilter){S.count.filter=data.cfilter;render();return}
  if(data.step){
    const [productId,delta]=data.step.split(':');
    const current=Number(S.count.values[productId]?.qty||0);
    setCount(productId,String(Math.max(0,current+Number(delta))));
    render();
    return;
  }
  const code=data.code;
  switch(data.act){
    case 'reload':load();break;
    case 'retry':S.online=true;renderSync();refreshSilently();break;
    case 'setup':confirmBox({title:'Activar Inventarios',text:'Se crearán Tienda, Cigarrillos y Lubricantes con sus ubicaciones básicas. No se modifica ningún dato existente.',label:'Activar',onConfirm:async()=>{
      setBusy('invConfirmOk',true,'Activando…');
      try{await Api.setup(S.companyId);closeLayers();await refreshOverview();S.view='home';await loadView();render();toast('Inventarios activados.')}
      catch(error){setBusy('invConfirmOk',false);handleError(error,{form:true})}
    }});break;
    case 'count':openCount(code);break;
    case 'receive':openReceive(code);break;
    case 'product-new':openProductForm(code,null);break;
    case 'opening':openOpening(code);break;
    case 'cfg-save':{
      const id=data.id;
      const value=name=>document.querySelector(`[data-cfg="${name}"][data-id="${id}"]`).value;
      try{
        await Api.updateInventory(id,{area:value('area'),expiry_alert_days:Number(value('expiry_alert_days')),auto_approve_max_abs:Number(value('auto_approve_max_abs'))});
        await refreshOverview();await loadView();render();toast('Configuración guardada.');
      }catch(error){handleError(error)}
      break;
    }
    case 'count-save':{const ok=await countFlush(false);toast(ok?'Conteo guardado. Puedes continuarlo después.':'Sin conexión: tus conteos están guardados en este dispositivo.');break}
    case 'count-review':reviewCount();break;
    case 'count-back':S.count.review=false;render();break;
    case 'count-send':sendCount();break;
    case 'conflict-take':{
      const conflict=S.count.conflicts[data.id];
      S.count.values[data.id]={qty:String(conflict.counted_qty),note:S.count.values[data.id]?.note||''};
      delete S.count.conflicts[data.id];delete S.count.dirty[data.id];
      saveDraft();render();break;
    }
    case 'conflict-keep':{
      delete S.count.conflicts[data.id];
      S.count.dirty[data.id]=true;
      S.count.since=new Date(Date.now()+1000).toISOString();
      await countFlush(false);render();break;
    }
    case 'scan-search':openScanner(value=>{S.filters.q=value;renderList();const input=$('invQ');if(input)input.value=value});break;
    case 'scan-count':openScanner(value=>{
      const product=(S.products[S.count.inventoryId]||[]).find(entry=>entry.barcode===value||entry.code===value);
      if(!product){toast('Ese código no está en este inventario.');return}
      S.filters.q='';S.count.filter='all';render();
      const input=document.querySelector(`[data-cnt="${product.id}"]`);
      if(input){input.scrollIntoView({block:'center'});input.focus();input.select()}
    });break;
    case 'adj-approve':confirmBox({title:'Aprobar ajuste',text:'El stock cambiará con un movimiento trazable a tu nombre.',label:'Aprobar',onConfirm:()=>reviewAdjustment(data.id,true,'')});break;
    case 'adj-reject':reasonBox({title:'Rechazar ajuste',text:'El stock no cambia.',label:'Motivo del rechazo',required:true,okLabel:'Rechazar',danger:true,onConfirm:note=>reviewAdjustment(data.id,false,note)});break;
    case 'reverse':reasonBox({title:'Corregir movimiento',text:'Se creará un movimiento de signo contrario. El original se conserva en el historial.',label:'Motivo de la corrección',required:true,okLabel:'Corregir',onConfirm:async note=>{
      S.reqReverse=S.reqReverse||Api.uuid();
      try{await Api.reverse(S.reqReverse,data.id,note);S.reqReverse=null;closeLayers();await refreshOverview();await loadView();render();toast('Corrección registrada.')}
      catch(error){const info=handleError(error,{form:true});if(!info.network)S.reqReverse=null}
    }});break;
    case 'void-receipt':reasonBox({title:'Anular recepción',text:'Se revierte el stock de todas sus líneas con movimientos compensatorios. Si parte de esa mercadería ya se usó, no se puede anular.',label:'Motivo de la anulación',required:true,okLabel:'Anular',danger:true,onConfirm:async note=>{
      S.reqVoid=S.reqVoid||Api.uuid();
      try{await Api.voidReceipt(S.reqVoid,data.id,note);S.reqVoid=null;closeLayers();await afterWrite();toast('Recepción anulada.')}
      catch(error){const info=handleError(error,{form:true});if(!info.network)S.reqVoid=null}
    }});break;
    case 'rep-apply':{
      const from=$('invRepFrom').value;const to=$('invRepTo').value;
      if(from&&to&&from<=to){S.repFrom=from;S.repTo=to;try{await loadView()}catch(error){handleError(error)}render()}
      else toast('Revisa las fechas del período.');
      break;
    }
    case 'csv-shortages':{
      const item=invByCode(S.view.slice(4));const rows=S.reports[item.id]?.shortages||[];
      downloadCsv(`faltantes-${item.code}-${todayIso()}.csv`,[['Código','Producto','Categoría','Stock','Mínimo','Faltan'],...rows.map(r=>[r.code,r.name,r.category,r.stock,r.min_stock,r.missing])]);break;
    }
    case 'csv-waste':{
      const item=invByCode(S.view.slice(4));const report=S.reports[item.id]?.waste;if(!report)break;
      downloadCsv(`mermas-${item.code}-${S.repFrom}-${S.repTo}.csv`,[['Motivo','Unidades','Eventos'],...report.by_reason.map(r=>[r.reason,r.qty,r.events]),[],['Código','Producto','Unidades'],...report.by_product.map(r=>[r.code,r.name,r.qty])]);break;
    }
    case 'csv-expiry':{
      const item=invByCode(S.view.slice(4));
      const rows=(S.products[item.id]||[]).flatMap(product=>(product.stock_detail||[]).filter(row=>row.expires_on).map(row=>[product.code,product.name,row.lot_code,row.expires_on,row.location,row.qty]));
      downloadCsv(`vencimientos-${item.code}-${todayIso()}.csv`,[['Código','Producto','Lote','Vence','Ubicación','Cantidad'],...rows]);break;
    }
    default:break;
  }
}

async function reviewAdjustment(id,approve,note){
  S.reqReview=S.reqReview||{};
  const requestId=S.reqReview[id]=S.reqReview[id]||Api.uuid();
  try{
    await Api.review(requestId,id,approve,note);
    delete S.reqReview[id];
    closeLayers();
    await refreshOverview();
    S.adjs=await Api.adjustments(S.companyId,null);
    render();
    toast(approve?'Ajuste aprobado. El stock se actualizó con un movimiento.':'Ajuste rechazado. El stock no cambió.');
  }catch(error){
    const info=handleError(error,{form:true});
    if(!info.network)delete S.reqReview[id];
    if(info.code==='already_reviewed'||info.code==='insufficient_stock'){
      try{S.adjs=await Api.adjustments(S.companyId,null)}catch(_error){}
      render();
    }
  }
}

function setCount(productId,value){
  const count=S.count;
  const previous=count.values[productId]||{qty:'',note:''};
  count.values[productId]={...previous,qty:value};
  count.dirty[productId]=true;
  delete count.conflicts[productId];
  saveDraft();
  scheduleSave();
}

function onRootInput(event){
  const target=event.target;
  if(target.id==='invQ'){
    S.filters.q=target.value;
    if(S.view.startsWith('count:'))render();
    else renderList();
    const input=$('invQ');
    if(input){input.focus();try{input.setSelectionRange(input.value.length,input.value.length)}catch(_error){}}
    return;
  }
  if(target.id==='invSt'){S.filters.st=target.value;renderList();return}
  if(target.dataset.cnt){
    const cleaned=target.value.replace(/\D/g,'');
    if(cleaned!==target.value)target.value=cleaned;
    setCount(target.dataset.cnt,cleaned);
    const row=target.closest('.inv-crow');
    if(row)row.classList.toggle('done',cleaned!=='');
    const {list,done}=countStats();
    const bar=$('invProgBar');if(bar)bar.style.width=`${list.length?done/list.length*100:0}%`;
    const text=$('invProgText');if(text)text.textContent=`${done} de ${list.length} contados`;
    const review=$('invReviewBtn');if(review)review.disabled=!done;
    return;
  }
  if(target.dataset.note&&S.count){
    S.count.values[target.dataset.note]={...(S.count.values[target.dataset.note]||{qty:''}),note:target.value};
    S.count.dirty[target.dataset.note]=true;
    saveDraft();
  }
}

function onLayerClick(event){
  const target=event.target.closest('[data-act],[data-open],.inv-ov');
  if(!target)return;
  if(target.classList.contains('inv-ov')){closeLayers();return}
  const data=target.dataset;
  switch(data.act){
    case 'close':closeLayers();break;
    case 'confirm-ok':S.form?.onConfirm?.();break;
    case 'reason-ok':{
      const note=($('invReason').value||'').trim();
      if(S.form.required&&!note){setFormError('Escribe el motivo.');break}
      S.form.onConfirm(note);
      break;
    }
    case 'rec-add':S.form.lines.push({pid:'',qty:'',unit:'base',loc:'',lot:'',exp:''});renderRecLines();break;
    case 'rec-del':S.form.lines.splice(Number(data.i),1);renderRecLines();break;
    case 'rec-ok':submitReceive();break;
    case 'mv-ok':submitMovement();break;
    case 'pf-ok':submitProduct();break;
    case 'op-ok':submitOpening();break;
    case 'waste':case 'issue':case 'transfer':closeLayers();openMovementForm(data.act,data.id);break;
    case 'product-edit':{
      const {item}=findProduct(data.id);closeLayers();openProductForm(item.code,data.id);break;
    }
    case 'product-toggle':{
      const {product}=findProduct(data.id);
      const activate=!product.active;
      confirmBox({title:activate?'Activar producto':'Desactivar producto',text:activate?'El producto volverá a aparecer en los listados y conteos.':'Dejará de aparecer en listados y conteos. Conserva todo su historial. Solo se puede desactivar con stock 0.',label:activate?'Activar':'Desactivar',danger:!activate,onConfirm:async()=>{
        setBusy('invConfirmOk',true);
        try{await Api.setProductActive(product.id,activate,product.version);closeLayers();await afterWrite();toast(activate?'Producto activado.':'Producto desactivado.')}
        catch(error){setBusy('invConfirmOk',false);handleError(error,{form:true})}
      }});
      break;
    }
    default:break;
  }
}

function onLayerInput(event){
  const target=event.target;
  const form=S.form;
  if(target.dataset.rl&&form?.type==='receive'){
    const [index,key]=target.dataset.rl.split(':');
    const line=form.lines[Number(index)];
    line[key]=target.value;
    if(key==='pid'){line.unit='base';line.loc='';line.lot='';line.exp=''}
    if(key==='pid'||key==='unit')renderRecLines();
    else if(key==='qty'){
      const product=(S.products[form.inventoryId]||[]).find(entry=>entry.id===line.pid);
      const holder=$(`recConv-${index}`);
      if(holder)holder.innerHTML=product&&line.unit==='purchase'&&line.qty?`<div class="inv-conv">${fmt(line.qty)} ${esc(unitPlural(product.receive_unit))} × ${fmt(product.receive_factor)} = ${fmt(Number(line.qty)*product.receive_factor)} ${esc(unitPlural(product.control_unit))}</div>`:'';
    }
    return;
  }
  if(target.id==='recInvoice'&&form?.type==='receive'){
    const option=target.selectedOptions[0];
    if(option&&option.value){
      if(!$('recDoc').value)$('recDoc').value=option.value;
      if(!$('recSupplier').value)$('recSupplier').value=option.dataset.supplier||'';
    }
  }
}

function onConnectionChange(){
  if(navigator.onLine&&S.active){
    S.online=true;
    refreshSilently();
    if(S.count&&Object.keys(S.count.dirty).length)scheduleSave(300);
  }else if(!navigator.onLine){
    S.online=false;
    renderSync();
  }
}

/* ------------------------------------------------------------- render */

function render(){
  const root=$('inventoryRoot');
  if(!root)return;
  root.dataset.inv=S.view.startsWith('inv:')?S.view.slice(4):S.view.startsWith('count:')?S.view.slice(6):'';
  let html;
  if(S.status==='loading'&&!S.overview)html=`${head('Inventarios','')}<div class="inv-empty">Cargando inventarios…</div>`;
  else if(S.status==='unavailable')html=viewUnavailable();
  else if(S.status==='error')html=viewError();
  else if(!invList().length)html=viewSetup();
  else if(S.view==='home')html=viewHome();
  else if(S.view.startsWith('inv:'))html=viewInventory();
  else if(S.view.startsWith('count:'))html=viewCount();
  else if(S.view==='mov')html=viewMovements();
  else if(S.view==='apr')html=viewApprovals();
  else if(S.view==='aud'&&isAdmin())html=viewAudit();
  else html=viewHome();
  const focusedId=document.activeElement?.id;
  const caret=document.activeElement?.selectionStart;
  root.innerHTML=html;
  if(focusedId==='invQ'){
    const input=$('invQ');
    if(input){input.focus();try{input.setSelectionRange(caret,caret)}catch(_error){}}
  }
}

function resetState(){
  stopPolling();
  clearTimeout(S.saveTimer);
  Object.assign(S,{
    role:null,area:null,status:'idle',overview:null,view:'home',sub:'products',products:{},receipts:{},reports:{},
    homeData:null,movs:[],adjs:[],audit:[],count:null,form:null,online:true,lastSync:null,filters:{q:'',cat:'Todas',st:'todos'},
    movFilter:{inv:'todos',kind:''}
  });
  closeLayers();
}

function onShow(){
  const context=Api.context();
  if(!context)return;
  if(S.userId&&S.userId!==context.userId)resetState();
  ensureLayer();
  S.active=true;
  startPolling();
  load();
}
function onHide(){
  S.active=false;
  stopPolling();
  if(S.count)countFlush(true);
  closeLayers();
}

function init(){
  const section=$('inventory');
  if(!section||section.dataset.invReady)return;
  section.dataset.invReady='1';
  let root=$('inventoryRoot');
  if(!root){
    root=document.createElement('div');
    root.id='inventoryRoot';
    section.appendChild(root);
  }
  root.classList.add('inv-root');
  root.addEventListener('click',onRootClick);
  root.addEventListener('input',onRootInput);
  root.addEventListener('change',onRootInput);
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!S.active)onShow();
    else if(!active&&S.active)onHide();
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  window.addEventListener('online',onConnectionChange);
  window.addEventListener('offline',onConnectionChange);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSilently()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer&&!$('invOv').hidden)closeLayers()});
  sync();
}

window.InventoryUI={init,onShow,onHide,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
