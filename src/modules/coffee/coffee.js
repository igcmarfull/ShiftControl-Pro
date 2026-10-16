(function(){
'use strict';

// Pantalla «Máquinas de café»: anota el numeral de cada turno y lo cuadra contra los vasos vendidos
// en el POS. Los datos viven en Supabase (tablas coffee_*); las ventas llegan por la importación de
// ventas de Inventarios. Aquí solo se dibuja y se llama a las funciones del servidor.

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Number(n||0).toLocaleString('es-CL');
const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const isAdmin=()=>window.ShiftControlPermissions?.getRole?.()==='ADMIN';
const SHIFTS=['A','B','C'];
const SHIFT_HOURS={A:'23:00–07:00',B:'07:00–15:00',C:'15:00–23:00'};
const BUCKET='shiftcontrol-machine-logos';
const URL_TTL=3600;
const MESSAGES={
  forbidden:'No tienes permiso para esto.',already_read:'Ya hay una lectura de ese turno. Solo el administrador la corrige.',
  duplicate_name:'Ya existe una máquina con ese nombre.',duplicate_code:'Un código ya pertenece a otra máquina.',
  invalid_date:'La fecha no puede ser futura.',invalid_numeral:'El numeral no es válido.',invalid_shift:'El turno debe ser A, B o C.'
};

const S={status:'idle',machines:[],codes:[],readings:[],selected:null,rec:null,loading:false,layer:false,form:null,message:'',busy:false};
const urls={};
const pendingUrls=new Set();
let urlTimer=null;
// URLs firmadas del bucket privado de logos, pedidas en lote.
function logoUrl(path){
  if(!path)return null;
  const hit=urls[path];
  if(hit&&hit.exp>Date.now())return hit.url;
  if(!pendingUrls.has(path)){
    pendingUrls.add(path);
    clearTimeout(urlTimer);
    urlTimer=setTimeout(async()=>{
      const paths=[...pendingUrls];
      let rows=[];
      try{rows=(await client().storage.from(BUCKET).createSignedUrls(paths,URL_TTL))?.data||[]}catch(_error){}
      const fresh=Date.now()+(URL_TTL-300)*1000;
      paths.forEach(path=>{
        const row=rows.find(entry=>entry.path===path);
        const url=row&&!row.error?row.signedUrl:null;
        urls[path]={url,exp:url?fresh:Date.now()+60000};
        pendingUrls.delete(path);
      });
      render();
    },60);
  }
  return hit?hit.url:null;
}
const icon=(m,cls)=>{
  const url=logoUrl(m.logo_path);
  return url?`<span class="cf-ic logo ${cls||''}"><img src="${esc(url)}" alt="" decoding="async"></span>`:`<span class="cf-ic ${cls||''}">☕</span>`;
};

function toError(error){
  const raw=String(error?.message||'');
  if(raw.startsWith('inv:')){const code=raw.slice(4);const err=new Error(error.hint||MESSAGES[code]||'No se pudo completar la operación.');err.code=code;return err}
  if(error?.code==='PGRST202'||error?.code==='PGRST205'||error?.code==='42P01'||error?.code==='42883'){const err=new Error('Las máquinas de café todavía no están habilitadas en el servidor.');err.code='unavailable';return err}
  if(/Failed to fetch|NetworkError|Load failed/i.test(raw)||navigator.onLine===false){const err=new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');err.code='network';return err}
  return error instanceof Error?error:new Error('No se pudo completar la operación.');
}
async function rpc(name,args){
  let response;
  try{response=await client().rpc(name,args)}catch(error){throw toError(error)}
  if(response.error)throw toError(response.error);
  return response.data;
}

/* ---------------------------------------------------------------- datos */
function today(){
  const d=new Date();const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
const dmy=iso=>String(iso||'').split('-').reverse().slice(0,2).join('-');
async function load(){
  const company=companyId();
  if(!company){S.status='idle';return}
  S.loading=true;S.message='';render();
  try{
    const [machines,codes]=await Promise.all([
      client().from('coffee_machines').select('*').eq('company_id',company).order('name'),
      client().from('coffee_machine_codes').select('*').eq('company_id',company)
    ]);
    if(machines.error)throw toError(machines.error);
    if(codes.error)throw toError(codes.error);
    S.machines=machines.data||[];
    S.codes=codes.data||[];
    S.status='ready';
    if(!S.machines.some(machine=>machine.id===S.selected))S.selected=(S.machines.find(machine=>machine.active)||S.machines[0]||{}).id||null;
    await loadMachine();
  }catch(error){
    S.status=error.code==='unavailable'?'unavailable':'error';
    S.message=error.message;
  }finally{S.loading=false;render()}
}
async function loadMachine(){
  S.rec=null;S.readings=[];
  if(!S.selected)return;
  const company=companyId();
  const [rec,readings]=await Promise.all([
    rpc('coffee_reconcile',{p_company_id:company,p_machine_id:S.selected,p_from:null,p_to:null}),
    client().from('coffee_readings').select('read_on, shift, numeral, entered_by_name').eq('machine_id',S.selected).order('read_on',{ascending:false}).limit(30)
  ]);
  S.rec=rec;
  S.readings=readings.error?[]:(readings.data||[]);
}
const machine=()=>S.machines.find(item=>item.id===S.selected)||null;

/* -------------------------------------------------------------- dibujo */
const STATUS={ok:['ok','Cuadra'],over:['bad','Fuera de tolerancia'],reset:['warn','El numeral bajó (¿reinicio?)'],pending:['warn','Faltan ventas por cargar']};
function summary(rows,tol){
  const done=rows.filter(row=>row.status==='ok'||row.status==='over');
  return {
    ok:done.filter(row=>row.status==='ok').length,total:done.length,
    over:rows.filter(row=>row.status==='over').length,
    sold:done.reduce((sum,row)=>sum+row.sold,0),
    gap:done.reduce((sum,row)=>sum+row.diff,0)
  };
}
function kpis(rows,m){
  const s=summary(rows,m.tolerance);
  return `<div class="cf-kpis">
    <div class="cf-kpi" style="--c:var(--green)"><i>✓</i><div><b>${s.ok} de ${s.total}</b><span>Tramos que cuadran</span></div></div>
    <div class="cf-kpi" style="--c:var(--orange)"><i>≠</i><div><b>${s.gap>0?'+':''}${fmt(s.gap)}</b><span>Vasos sin vender (suma)</span></div></div>
    <div class="cf-kpi" style="--c:var(--blue)"><i>☕</i><div><b>${fmt(s.sold)}</b><span>Vasos vendidos</span></div></div>
    <div class="cf-kpi" style="--c:var(--red)"><i>!</i><div><b>${s.over}</b><span>Fuera de tolerancia</span></div></div></div>`;
}
// Diferencia por día (numeral − vendidos) con la banda de tolerancia. Solo cuenta lo que se puede cuadrar.
function chartHtml(rows,m){
  const data=rows.filter(row=>row.status==='ok'||row.status==='over').slice(0,21).reverse();
  if(data.length<2)return '';
  const W=720,H=190,L=40,R=12,T=14,B=30;
  const tol=Number(m.tolerance)||0;
  const max=Math.max(5,tol*1.6,...data.map(row=>Math.abs(row.diff)));
  const y=value=>T+(H-T-B)*(1-(value+max)/(2*max));
  const slot=(W-L-R)/data.length;
  const bw=Math.max(6,Math.min(26,slot*0.55));
  const bars=data.map((row,index)=>{
    const cx=L+slot*index+slot/2;
    const top=y(Math.max(row.diff,0)),bottom=y(Math.min(row.diff,0));
    const height=Math.max(2,bottom-top);
    const over=row.status==='over';
    const label=`${dmy(row.read_on)}: avanzó ${fmt(row.advanced)}, vendidos ${fmt(row.sold)}, diferencia ${row.diff>0?'+':''}${fmt(row.diff)}`;
    const text=over?`<text x="${cx}" y="${row.diff>=0?top-5:bottom+13}" text-anchor="middle" class="cf-cv">${row.diff>0?'+':''}${fmt(row.diff)}</text>`:'';
    const every=Math.ceil(data.length/10);
    const tick=index%every===0?`<text x="${cx}" y="${H-10}" text-anchor="middle" class="cf-cx">${dmy(row.read_on)}</text>`:'';
    return `<g><rect x="${cx-slot/2}" y="${T}" width="${slot}" height="${H-T-B}" fill="transparent"><title>${esc(label)}</title></rect><rect x="${cx-bw/2}" y="${top}" width="${bw}" height="${height}" rx="3" class="cf-bar ${over?'bad':'ok'}"><title>${esc(label)}</title></rect>${text}${tick}</g>`;
  }).join('');
  const band=tol?`<rect x="${L}" y="${y(tol)}" width="${W-L-R}" height="${y(-tol)-y(tol)}" class="cf-band"/>`:'';
  return `<div class="cf-chart"><div class="cf-chart-h"><b>Diferencia por día</b><span class="cf-leg"><i class="ok"></i>Cuadra<i class="bad"></i>Fuera de tolerancia<i class="band"></i>Banda: tolerancia ±${tol}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diferencia diaria entre el numeral y los vasos vendidos">${band}
    <line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" class="cf-zero"/>
    <text x="${L-6}" y="${y(0)+4}" text-anchor="end" class="cf-cx">0</text>
    <text x="${L-6}" y="${y(max)+10}" text-anchor="end" class="cf-cx">+${fmt(Math.round(max))}</text>
    <text x="${L-6}" y="${y(-max)}" text-anchor="end" class="cf-cx">−${fmt(Math.round(max))}</text>${bars}</svg>
    <p class="cf-chart-n">Vasos de más (+) o de menos (−) que el numeral respecto de lo vendido. El detalle está en la tabla.</p></div>`;
}
function tableHtml(m){
  const rows=S.rec?.rows||[];
  if(!rows.length)return `<div class="cf-note">Aún no hay lecturas de dos días distintos. Anota el numeral en dos días para ver la primera cuadratura. Las ventas de café se cargan con «Importar ventas» (arriba), con el mismo Excel del POS.</div>`;
  const head='<div class="cf-th"><span>Tramo</span><span>Numeral</span><span>Avanzó</span><span>Vendidos</span><span>Diferencia</span><span>Estado</span></div>';
  return head+rows.slice(0,31).map(row=>{
    const [cls,label]=STATUS[row.status]||['warn',row.status];
    const range=row.days>1?`${dmy(row.prev_on)} → ${dmy(row.read_on)}`:dmy(row.read_on);
    const pending=row.status==='pending'?` · ${row.days_loaded} de ${row.days} días con ventas`:'';
    return `<div class="cf-r"><div><b>${range}</b><small>${row.days} día${row.days===1?'':'s'}</small></div><div data-l="Numeral"><b>${fmt(row.numeral)}</b><small>antes ${fmt(row.prev_numeral)}</small></div><b data-l="Avanzó">${fmt(row.advanced)}</b><b data-l="Vendidos">${fmt(row.sold)}</b><b data-l="Diferencia">${row.diff>0?'+':''}${fmt(row.diff)}</b><span class="cf-st ${cls}">${esc(label)}${pending}</span></div>`;
  }).join('');
}
function formHtml(m){
  const last=S.readings[0];
  const hint=last?`Última lectura: <b>${fmt(last.numeral)}</b> (${dmy(last.read_on)}, turno ${esc(last.shift)}).`:'Aún no hay lecturas de esta máquina.';
  const f=S.form||{date:today(),shift:'A',numeral:''};
  return `<aside class="cf-card cf-side"><div class="cf-f"><h4>Anotar el numeral</h4>
    <label>Día operativo<input type="date" id="cfDate" value="${esc(f.date)}" max="${today()}"></label>
    <label>Turno<select id="cfShift">${SHIFTS.map(shift=>`<option value="${shift}"${f.shift===shift?' selected':''}>Turno ${shift} · ${SHIFT_HOURS[shift]}</option>`).join('')}</select></label>
    <div class="cf-hint">El día operativo empieza a las 23:00 del día anterior. El numeral es el de fin de turno: el A de las 07:00 va con la fecha de ese mismo día.</div>
    <label>Numeral<input id="cfNumeral" inputmode="numeric" placeholder="Ej: 48.944" value="${esc(f.numeral)}" class="cf-big"></label>
    <div class="cf-hint">${hint}</div>
    ${S.message?`<div class="cf-err">${esc(S.message)}</div>`:''}
    <button type="button" class="cf-btn" data-cf="save" ${S.busy?'disabled':''}>${S.busy?'Guardando…':'Guardar lectura'}</button>
    <h4 style="margin-top:6px">Configuración</h4>
    <div class="cf-kp"><div><small>Tolerancia por tramo</small><b>±${m.tolerance} vasos</b></div><div><small>Numeral del día</small><b>El más alto</b></div></div>
    ${isAdmin()?'<button type="button" class="cf-btn ghost" data-cf="config">Configurar máquina</button>':''}</div></aside>`;
}
function render(){
  const root=$('coffeeRoot');
  if(!root)return;
  const head=`<div class="cf-head"><div><h1>Máquinas de café</h1><p>El numeral de cada máquina contra los vasos vendidos en el POS, día a día.</p></div><div class="cf-acts"><button type="button" class="cf-btn ghost" data-act="sales-import">Importar ventas</button>${isAdmin()?'<button type="button" class="cf-btn ghost" data-cf="new">+ Nueva máquina</button>':''}</div></div>`;
  if(S.status==='unavailable'){root.innerHTML=`${head}<div class="cf-note">Las máquinas de café todavía no están habilitadas en el servidor.</div>`;return}
  if(S.status==='error'){root.innerHTML=`${head}<div class="cf-err">${esc(S.message)}</div><button type="button" class="cf-btn" data-cf="reload">Reintentar</button>`;return}
  if(S.status!=='ready'){root.innerHTML=`${head}<div class="cf-note">${S.loading?'Cargando…':'Esperando la sesión…'}</div>`;return}
  if(!S.machines.length){root.innerHTML=`${head}<div class="cf-note">Todavía no hay máquinas. ${isAdmin()?'Crea la primera con «Nueva máquina».':'El administrador debe crearlas.'}</div>`;return}
  const m=machine();
  const tabs=S.machines.filter(item=>item.active||isAdmin()).map(item=>`<button type="button" class="${item.id===S.selected?'on':''}" data-cf="tab" data-id="${esc(item.id)}">${esc(item.name)}${item.active?'':' (inactiva)'}</button>`).join('');
  const codes=S.codes.filter(code=>code.machine_id===m.id).length;
  root.innerHTML=`${head}${S.rec?kpis(S.rec.rows,m):''}
    <div class="cf-main"><div class="cf-card"><div class="cf-h">${icon(m)}<div><h3>${esc(m.name)}</h3><small>${codes} producto${codes===1?'':'s'} del POS</small></div><div class="cf-tabs">${tabs}</div></div><div class="cf-t">${S.loading?'<div class="cf-note">Cargando…</div>':chartHtml(S.rec?.rows||[],m)+tableHtml(m)}</div></div>${formHtml(m)}</div>`;
}

/* ------------------------------------------------------------ acciones */
async function saveReading(){
  const m=machine();
  if(!m||S.busy)return;
  const date=$('cfDate').value,shift=$('cfShift').value;
  const raw=$('cfNumeral').value;
  S.form={date,shift,numeral:raw};
  const digits=raw.replace(/[^\d]/g,'');
  if(!digits){S.message='Escribe el numeral que marca la máquina.';render();return}
  S.busy=true;S.message='';render();
  try{
    await rpc('coffee_save_reading',{p_company_id:companyId(),p_machine_id:m.id,p_read_on:date,p_shift:shift,p_numeral:Number(digits),p_note:null});
    S.form=null;
    await loadMachine();
    toast('Lectura guardada');
  }catch(error){S.message=error.message}
  finally{S.busy=false;render()}
}
function closeLayer(){S.layer=false;const el=$('cfLayer');if(el)el.remove()}
function openConfig(isNew){
  const m=isNew?{id:'',name:'',tolerance:5,active:true}:machine();
  if(!m)return;
  const codes=isNew?[]:S.codes.filter(code=>code.machine_id===m.id).map(code=>code.pos_code);
  closeLayer();
  const layer=document.createElement('div');
  layer.id='cfLayer';layer.className='cf-ov';
  layer.innerHTML=`<div class="cf-modal" role="dialog" aria-label="Configurar máquina"><h3>${isNew?'Nueva máquina':'Configurar '+esc(m.name)}</h3>
    <label>Nombre<input id="cfName" value="${esc(m.name)}" maxlength="60"></label>
    <label>Tolerancia (vasos)<input id="cfTol" type="number" min="0" max="500" value="${esc(m.tolerance)}"><small>Diferencia aceptada entre lo que avanzó el numeral y lo vendido, por tramo.</small></label>
    <label>Códigos del POS que pasan por esta máquina<textarea id="cfCodes" rows="3" placeholder="Un código por línea o separados por coma">${esc(codes.join('\n'))}</textarea><small>Cada venta de estos códigos cuenta como un vaso. No descuentan stock.</small></label>
    ${isNew?'<small>Después de crear la máquina puedes agregarle un logo.</small>':`<div class="cf-logorow">${icon(m,'lg')}<div class="cf-logobtns"><input type="file" id="cfLogoFile" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="cf-btn ghost" data-cf="logo">${m.logo_path?'Cambiar logo':'Subir logo'}</button>${m.logo_path?'<button type="button" class="cf-btn ghost" data-cf="logo-del">Quitar logo</button>':''}</div></div>`}
    ${isNew?'':`<label class="cf-check"><input type="checkbox" id="cfActive"${m.active?' checked':''}> Máquina activa</label>`}
    <div class="cf-err" id="cfModalErr"></div>
    <div class="cf-foot"><button type="button" class="cf-btn ghost" data-cf="cancel">Cancelar</button><button type="button" class="cf-btn" data-cf="config-ok" data-id="${esc(m.id)}">Guardar</button></div></div>`;
  document.body.appendChild(layer);
  S.layer=true;
  $('cfName').focus();
}
async function saveConfig(id){
  const err=$('cfModalErr');
  const name=$('cfName').value.trim();
  if(!name){err.textContent='La máquina necesita un nombre.';return}
  const codes=[...new Set($('cfCodes').value.split(/[\s,;]+/).map(code=>code.trim()).filter(Boolean))].map(code=>({code,cups:1}));
  const payload={name,tolerance:Number($('cfTol').value||0),codes};
  if(id){payload.id=id;payload.active=$('cfActive')?$('cfActive').checked:true}
  try{
    const saved=await rpc('coffee_machine_save',{p_company_id:companyId(),p_machine:payload});
    closeLayer();
    S.selected=saved.id;
    await load();
    toast('Máquina guardada');
  }catch(error){err.textContent=error.message}
}
async function setLogo(path){
  const m=machine();
  const saved=await rpc('coffee_machine_set_logo',{p_machine_id:m.id,p_logo_path:path});
  const old=m.logo_path;
  Object.assign(m,{logo_path:saved.logo_path});
  if(old&&old!==path){try{await client().storage.from(BUCKET).remove([old])}catch(_error){}}
}
async function uploadLogo(file){
  const m=machine();
  const err=$('cfModalErr');
  if(!m||!file)return;
  err.textContent='';
  try{
    if(!window.InvoiceLogos?.processLogo)throw new Error('El procesador de logos no está disponible.');
    const blob=await window.InvoiceLogos.processLogo(file);
    const ext=blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':'webp';
    const id=typeof window.safeRandomUUID==='function'?window.safeRandomUUID():String(Date.now());
    const path=`${m.company_id}/${m.id}/${id}.${ext}`;
    const {error}=await client().storage.from(BUCKET).upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false});
    if(error)throw error;
    await setLogo(path);
    toast('Logo guardado');
    openConfig(false);
    render();
  }catch(error){err.textContent=error?.message||'No se pudo guardar el logo.'}
}
async function removeLogo(){
  const err=$('cfModalErr');
  try{await setLogo(null);toast('Logo quitado');openConfig(false);render()}
  catch(error){err.textContent=error?.message||'No se pudo quitar el logo.'}
}
function onClick(event){
  const target=event.target.closest('[data-cf]');
  if(!target)return;
  const action=target.dataset.cf;
  if(action==='tab'){S.selected=target.dataset.id;S.form=null;S.message='';S.loading=true;render();loadMachine().catch(error=>{S.message=error.message}).finally(()=>{S.loading=false;render()});return}
  if(action==='save')return saveReading();
  if(action==='reload')return load();
  if(action==='config')return openConfig(false);
  if(action==='new')return openConfig(true);
  if(action==='cancel')return closeLayer();
  if(action==='config-ok')return saveConfig(target.dataset.id);
  if(action==='logo')return $('cfLogoFile')?.click();
  if(action==='logo-del')return removeLogo();
}
function init(){
  const section=$('coffee');
  if(!section||section.dataset.cfReady)return;
  section.dataset.cfReady='1';
  let root=$('coffeeRoot');
  if(!root){root=document.createElement('div');root.id='coffeeRoot';section.appendChild(root)}
  root.classList.add('cf-root');
  document.addEventListener('click',event=>{if(event.target.closest('#coffee,.cf-ov'))onClick(event)});
  document.addEventListener('change',event=>{if(event.target&&event.target.id==='cfLogoFile')uploadLogo(event.target.files&&event.target.files[0])});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&S.layer)closeLayer()});
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){render();load()}
    if(!active&&was)closeLayer();
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.CoffeeUI={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
