(function(){
'use strict';

// Pantalla «Comisiones» (solo administrador): litros vendidos por día (retail, flota y kerosene) y la comisión
// del mes según el contrato. Los datos viven en Supabase (fuel_sales y fuel_contract); el cálculo está en
// fuel-calc.js. Aquí solo se carga, se dibuja y se llama a las funciones del servidor.

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Math.round(Number(n)||0).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const rate=n=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:2});
const rateMoney=n=>'$'+rate(n);
const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const isAdmin=()=>window.ShiftControlPermissions?.getRole?.()==='ADMIN';
const Calc=()=>window.FuelCalc;
const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESSAGES={
  forbidden:'Solo el administrador puede hacer esto.',invalid_date:'La fecha no puede ser futura.',
  invalid_liters:'Los litros deben ser números enteros entre 0 y 2.000.000.',
  invalid_contract:'Revisa los valores del contrato: fechas, tarifas y montos deben ser válidos.',
  invalid_line:'Hay un día del informe con fecha o litros que no se pueden leer.',lines_required:'El informe no trae días para cargar.',
  too_many_lines:'El informe trae demasiados días. Sube un período más corto.'
};

const pad=n=>String(n).padStart(2,'0');
function today(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
const dm=iso=>String(iso||'').split('-').reverse().slice(0,2).join('-');
const dmy=iso=>String(iso||'').split('-').reverse().join('-');
const now=new Date();
const S={status:'idle',contract:null,rows:[],year:now.getFullYear(),month:now.getMonth()+1,loading:false,layer:'',busy:false,message:'',showAll:false,imp:null};

function toError(error){
  const raw=String(error?.message||'');
  if(raw.startsWith('inv:')){const code=raw.slice(4);const err=new Error(error.hint||MESSAGES[code]||'No se pudo completar la operación.');err.code=code;return err}
  if(['PGRST202','PGRST205','42P01','42883'].includes(error?.code)){const err=new Error('Las comisiones todavía no están habilitadas en el servidor.');err.code='unavailable';return err}
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
async function load(){
  const company=companyId();
  if(!company||!client()){S.status='idle';return}
  S.loading=true;S.message='';render();
  try{
    const from=Calc().monthStart(S.year,S.month),to=Calc().monthEnd(S.year,S.month);
    const [contract,rows]=await Promise.all([
      client().from('fuel_contract').select('*').eq('company_id',company).maybeSingle(),
      client().from('fuel_sales').select('sold_on, retail_l, flota_l, kerosene_l').eq('company_id',company).gte('sold_on',from).lte('sold_on',to).order('sold_on')
    ]);
    if(contract.error)throw toError(contract.error);
    if(rows.error)throw toError(rows.error);
    S.contract=contract.data||null;
    S.rows=rows.data||[];
    S.status='ready';
  }catch(error){
    S.status=error.code==='unavailable'?'unavailable':'error';
    S.message=error.message;
  }finally{S.loading=false;render()}
}
const activeContract=()=>S.contract||{...Calc().DEFAULT_CONTRACT,fromDefault:true};
const summary=()=>Calc().monthSummary(activeContract(),S.rows,{year:S.year,month:S.month,today:today()});

/* -------------------------------------------------------------- gráficos */
const compact=()=>window.innerWidth<640;
const niceMax=(v,step)=>Math.max(step,Math.ceil(v/step)*step);
// Paso del eje: el menor «redondo» que deja a lo más ~5 marcas.
const niceStep=max=>[1000,2000,5000,10000,20000,50000,100000,200000,500000,1000000,2000000].find(step=>max/step<=5)||2000000;
function chartCumulative(s){
  const sm=compact();
  const W=sm?340:860,H=sm?250:300,L=sm?50:62,R=sm?10:16,T=14,B=sm?30:34,iw=W-L-R,ih=H-T-B;
  const pivot=s.pivot||0;
  const top=Math.max(pivot*1.1,s.projected?s.projected.retail*1.05:0,s.totals.retail);
  const step=niceStep(top),ymax=niceMax(top,step);
  const X=d=>L+(d-1)/Math.max(1,s.dim-1)*iw,Y=v=>T+ih-(v/ymax)*ih;
  let g='';
  for(let t=0;t<=ymax;t+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L-10}" y="${Y(t)+4}" font-size="11" text-anchor="end" fill="var(--muted)">${t/1000} m³</text>`;
  (sm?[1,10,20,s.dim]:[1,5,10,15,20,25,s.dim]).forEach(d=>{g+=`<text x="${X(d)}" y="${H-10}" font-size="11" text-anchor="middle" fill="var(--muted)">${d}</text>`});
  let cum=0;const pts=S.rows.map(r=>{cum+=Number(r.retail_l)||0;return [Number(r.sold_on.slice(8,10)),cum]});
  let body='';
  if(pivot)body+=`<line x1="${L}" x2="${W-R}" y1="${Y(pivot)}" y2="${Y(pivot)}" stroke="#d9822b" stroke-width="2"/><text x="${L+8}" y="${Y(pivot)-8}" font-size="12" font-weight="700" fill="#d9822b">Pivote ${fmt(pivot/1000)} m³</text>`;
  if(pts.length){
    const line=pts.map((p,i)=>`${i?'L':'M'}${X(p[0])},${Y(p[1])}`).join(' ');
    const area=`M${X(pts[0][0])},${Y(0)} `+pts.map(p=>`L${X(p[0])},${Y(p[1])}`).join(' ')+` L${X(pts[pts.length-1][0])},${Y(0)}Z`;
    const last=pts[pts.length-1];
    body+=`<path d="${area}" fill="var(--blue,#0f4c9c)" opacity=".08"/><path d="${line}" fill="none" stroke="var(--blue,#0f4c9c)" stroke-width="3" stroke-linejoin="round"/>`;
    if(!s.ended&&s.projected&&last[0]<s.dim){
      body+=`<line x1="${X(last[0])}" y1="${Y(last[1])}" x2="${X(s.dim)}" y2="${Y(s.projected.retail)}" stroke="var(--blue,#0f4c9c)" stroke-width="2.5" stroke-dasharray="6 6" opacity=".5"/>`+
        `<circle cx="${X(s.dim)}" cy="${Y(s.projected.retail)}" r="4.5" fill="var(--panel)" stroke="var(--blue,#0f4c9c)" stroke-width="2" opacity=".7"/>`+
        `<text x="${X(s.dim)-10}" y="${Y(s.projected.retail)+(s.projected.retail>=pivot?22:-12)}" font-size="12" text-anchor="end" fill="var(--blue,#0f4c9c)">cierre ≈ ${fmt(s.projected.retail)} L</text>`;
    }
    body+=`<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="5" fill="var(--blue,#0f4c9c)" stroke="var(--panel)" stroke-width="2"/><text x="${X(last[0])+(last[0]>s.dim*.8?-10:8)}" y="${Y(last[1])+(last[0]>s.dim*.8?-12:22)}" font-size="12" font-weight="700" text-anchor="${last[0]>s.dim*.8?'end':'start'}" fill="var(--blue,#0f4c9c)">${fmt(last[1])} L</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Litros retail acumulados del mes contra el pivote del contrato">${g}${body}</svg>`;
}
function chartDaily(s){
  const sm=compact();
  const W=sm?340:860,H=sm?210:230,L=sm?50:62,R=sm?10:16,T=14,B=sm?30:34,iw=W-L-R,ih=H-T-B;
  const peak=Math.max(0,...S.rows.map(r=>(Number(r.retail_l)||0)+(Number(r.flota_l)||0)+(Number(r.kerosene_l)||0)));
  const step=niceStep(peak*1.08),ymax=niceMax(peak*1.08,step);
  const X=d=>L+(d-1)/Math.max(1,s.dim-1)*iw,Y=v=>T+ih-(v/ymax)*ih;
  const bw=Math.max(6,iw/s.dim*0.62);
  let g='';
  for(let t=0;t<=ymax;t+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L-10}" y="${Y(t)+4}" font-size="11" text-anchor="end" fill="var(--muted)">${t/1000} m³</text>`;
  (sm?[1,10,20,s.dim]:[1,5,10,15,20,25,s.dim]).forEach(d=>{g+=`<text x="${X(d)}" y="${H-10}" font-size="11" text-anchor="middle" fill="var(--muted)">${d}</text>`});
  let bars='';
  S.rows.forEach(r=>{
    const d=Number(r.sold_on.slice(8,10)),x=X(d)-bw/2;
    const a=Number(r.retail_l)||0,b=Number(r.flota_l)||0,c=Number(r.kerosene_l)||0;
    bars+=`<rect x="${x}" y="${Y(a)}" width="${bw}" height="${Y(0)-Y(a)}" fill="var(--blue,#0f4c9c)" rx="2"><title>${dm(r.sold_on)} · retail ${fmt(a)} L</title></rect>`+
      `<rect x="${x}" y="${Y(a+b)}" width="${bw}" height="${Y(a)-Y(a+b)}" fill="var(--green,#2f9e44)"><title>${dm(r.sold_on)} · flota ${fmt(b)} L</title></rect>`+
      `<rect x="${x}" y="${Y(a+b+c)}" width="${bw}" height="${Y(a+b)-Y(a+b+c)}" fill="#d9822b" rx="2"><title>${dm(r.sold_on)} · kerosene ${fmt(c)} L</title></rect>`;
  });
  const avg=s.loaded?`<line x1="${L}" x2="${W-R}" y1="${Y(s.avgRetail||0)}" y2="${Y(s.avgRetail||0)}" stroke="#8a94a6" stroke-dasharray="5 5"/>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Litros vendidos por día: retail, flota y kerosene">${g}${bars}${avg}</svg>`;
}

/* ------------------------------------------------------------- pantalla */
function kpis(s){
  const c=activeContract();
  const retailCard=`<div class="fu-k"><small>Litros retail del mes</small><b>${fmt(s.totals.retail)} L</b>`+
    (s.inContract?`<span>${Math.round(s.pct*100)}% del pivote de ${fmt(c.pivot_l)} L · gasolinas y diésel</span><div class="fu-bar"><i style="width:${Math.min(100,s.pct*100)}%"></i></div>`:`<span>Gasolinas y diésel</span>`)+`</div>`;
  if(!s.inContract){
    return `<div class="fu-kp">${retailCard}<div class="fu-k"><small>Comisión</small><b>—</b><span>Este mes está fuera del contrato configurado (${dmy(c.valid_from)} al ${dmy(c.valid_to)}).</span></div>`+
      `<div class="fu-k"><small>Flota</small><b>${fmt(s.totals.flota)} L</b><span>Litros del mes</span></div><div class="fu-k"><small>Kerosene</small><b>${fmt(s.totals.kerosene)} L</b><span>Litros del mes</span></div></div>`;
  }
  const close=s.close;
  const commissionCard=`<div class="fu-k"><small>${s.ended?'Comisión del mes':'Comisión estimada al cierre'}</small><b>${close?money(close.net):'—'}</b>`+
    (close?`<span>+ IVA · ${money(close.gross)} con IVA</span><span class="fu-sub">Retail ${money(close.retail)} · Flota ${money(close.flota)} · Kerosene ${money(close.kerosene)}</span>`:`<span>Carga litros para ver la estimación</span>`)+`</div>`;
  let proj='<span>Sin litros cargados</span>';
  if(s.projected){
    const p=s.projected.retail,pv=c.pivot_l;
    proj=s.ended?`<span>Cierre del mes${p>pv?` · ${fmt(p-pv)} L sobre el pivote`:` · ${fmt(pv-p)} L bajo el pivote`}</span>`:
      `<span>${p>pv?`Pasaría el pivote por ${fmt(p-pv)} L`:`Quedaría ${fmt(pv-p)} L bajo el pivote`} al ritmo de ${fmt(s.avgRetail)} L por día</span>`;
  }
  const projCard=`<div class="fu-k"><small>${s.ended?'Litros del mes':'Proyección retail'}</small><b>${s.projected?fmt(s.projected.retail):'—'} L</b>${proj}</div>`;
  const fk=`<div class="fu-k"><small>Flota y kerosene</small><div class="fu-two"><span>Flota</span><div><b>${fmt(s.totals.flota)} L</b><em>${money(s.now.flota)}</em></div></div><div class="fu-two"><span>Kerosene</span><div><b>${fmt(s.totals.kerosene)} L</b><em>${money(s.now.kerosene)}</em></div></div><span class="fu-sub">Fuera del pivote · ${rateMoney(c.flota_rate)} y ${rateMoney(c.kero_rate)} por litro + IVA</span></div>`;
  return `<div class="fu-kp">${retailCard}${commissionCard}${projCard}${fk}</div>`;
}
function howWeAre(s){
  const c=activeContract();
  if(!s.inContract)return `<div class="fu-card"><h3>Contrato</h3><div class="fu-sub2">Este mes está fuera del período configurado.</div><div class="fu-note">El contrato vigente va del ${dmy(c.valid_from)} al ${dmy(c.valid_to)}. Si hay un contrato nuevo, cámbialo en «Contrato».</div></div>`;
  const low=s.tramo==='low';
  const rows=`<div class="fu-tr ${low?'on':''}"><span><b>Hasta ${fmt(c.pivot_l/1000)} m³</b>${low?' <span class="fu-pill">estamos aquí</span>':''}<br><small>fijo ${money(c.low_fixed)} + ${rateMoney(c.low_rate)} por litro</small></span><b>${rateMoney(c.low_rate)}/L</b></div>`+
    `<div class="fu-tr ${low?'':'on'}"><span><b>Sobre ${fmt(c.pivot_l/1000)} m³</b>${low?'':' <span class="fu-pill">estamos aquí</span>'}<br><small>fijo ${money(c.high_fixed)} + ${rateMoney(c.high_rate)} por litro sobre el pivote</small></span><b>${rateMoney(c.high_rate)}/L</b></div>`;
  const left=low?`<div class="fu-tr"><span>Faltan para el pivote</span><b>${fmt(s.toPivot)} L</b></div>`:`<div class="fu-tr"><span>Sobre el pivote</span><b>${fmt(s.totals.retail-c.pivot_l)} L</b></div>`;
  const pace=low&&!s.ended?`<div class="fu-tr"><span>Ritmo diario necesario</span><b>${s.neededPerDay==null?'—':fmt(s.neededPerDay)+' L por día'}</b></div>`:'';
  const now=`<div class="fu-tr"><span>Comisión con lo cargado</span><b>${money(s.now.net)}</b></div>`;
  const gain=s.rateGain!=null&&s.rateGain>0?Math.round(s.rateGain*100):null;
  const tip=low?`Cada litro retail sobre los ${fmt(c.pivot_l/1000)} m³ paga <b>${rateMoney(c.high_rate)}</b> en vez de ${rateMoney(c.low_rate)}${gain?`: el ${gain}% más`:''}.`:`Ya pasaste el pivote: cada litro retail extra paga <b>${rateMoney(c.high_rate)}</b>.`;
  return `<div class="fu-card"><h3>Cómo vamos</h3><div class="fu-sub2">Tramo del contrato en el que está el mes</div>${rows}${left}${pace}${now}<div class="fu-note">${tip}</div></div>`;
}
function daysCard(){
  const rows=[...S.rows].reverse();
  const shown=S.showAll?rows:rows.slice(0,6);
  const head=`<div class="fu-r h"><span>Día</span><span>Retail</span><span>Flota</span><span>Kero</span></div>`;
  const body=shown.map(r=>`<button type="button" class="fu-r" data-fu="edit" data-date="${esc(r.sold_on)}"><span>${dm(r.sold_on)}</span><span>${fmt(r.retail_l)}</span><span>${fmt(r.flota_l)}</span><span>${fmt(r.kerosene_l)}</span></button>`).join('');
  const more=rows.length>6?`<button type="button" class="fu-more" data-fu="more">${S.showAll?'Ver menos':`Ver todo el mes (${rows.length} días)`}</button>`:'';
  return `<div class="fu-card"><h3>Días cargados</h3><div class="fu-sub2">Toca un día para corregirlo</div><div class="fu-g">${rows.length?head+body:'<div class="fu-empty">Todavía no hay días cargados.</div>'}</div>${more}</div>`;
}
function render(){
  const root=$('fuelRoot');
  if(!root)return;
  const years=[...new Set([now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1,S.year])].sort();
  const head=`<div class="fu-top"><div><h1>Comisiones</h1><p>Litros vendidos y comisión del mes, según el contrato${S.contract?` vigente (${dmy(S.contract.valid_from)} al ${dmy(S.contract.valid_to)})`:''}.</p></div>`+
    `<div class="fu-acts"><div class="fu-sels"><select class="fu-sel" data-fu="month" aria-label="Mes">${MONTHS.map((name,i)=>`<option value="${i+1}"${i+1===S.month?' selected':''}>${name}</option>`).join('')}</select>`+
    `<select class="fu-sel" data-fu="year" aria-label="Año">${years.map(y=>`<option${y===S.year?' selected':''}>${y}</option>`).join('')}</select>`+
    `<button type="button" class="fu-btn fu-contract" data-fu="contract" aria-label="Contrato" title="Contrato"><svg class="fu-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/></svg><span class="fu-lbl">Contrato</span></button></div>`+
    `<div class="fu-btns"><button type="button" class="fu-btn" data-fu="import">Importar informe</button><button type="button" class="fu-btn pri" data-fu="load">+ Cargar litros</button></div></div></div>`;
  if(S.status==='unavailable'){root.innerHTML=`${head}<div class="fu-card"><div class="fu-note">${esc(S.message)}</div></div>`;return}
  if(S.status==='error'){root.innerHTML=`${head}<div class="fu-card"><div class="fu-err">${esc(S.message)}</div><button type="button" class="fu-btn" data-fu="reload">Reintentar</button></div>`;return}
  if(S.status!=='ready'){root.innerHTML=`${head}<div class="fu-card"><div class="fu-note">${S.loading?'Cargando…':'Sin datos.'}</div></div>`;return}
  if(!window.FuelCalc){root.innerHTML=`${head}<div class="fu-card"><div class="fu-err">No se cargó el cálculo de comisiones.</div></div>`;return}
  const s=summary();
  const warn=[];
  if(S.contract==null)warn.push('No hay un contrato guardado: se usan los valores del addendum C-3602-04. Revísalos en «Contrato».');
  if(s.missing.length)warn.push(`Faltan ${s.missing.length} día${s.missing.length===1?'':'s'} por cargar (${s.missing.slice(0,8).map(d=>pad(d)).join(', ')}${s.missing.length>8?'…':''}). La proyección los toma como un día promedio.`);
  const empty=!s.loaded?`<div class="fu-card"><div class="fu-note">Todavía no hay litros cargados en ${MONTHS[S.month-1].toLowerCase()} de ${S.year}. Usa «+ Cargar litros».</div></div>`:'';
  root.innerHTML=`${head}${warn.map(w=>`<div class="fu-warn">${esc(w)}</div>`).join('')}${kpis(s)}${empty}`+
    (s.loaded?`<div class="fu-main"><div class="fu-card"><h3>Avance hacia los ${s.pivot?fmt(s.pivot/1000):'450'} m³</h3><div class="fu-sub2">Litros retail acumulados del mes contra el pivote del contrato</div>${chartCumulative(s)}`+
      `<div class="fu-leg"><span><i style="background:var(--blue,#0f4c9c)"></i>Acumulado real</span>${s.ended?'':'<span><i style="background:var(--blue,#0f4c9c);opacity:.45"></i>Proyección al ritmo actual</span>'}${s.pivot?'<span><i style="background:#d9822b"></i>Pivote</span>':''}</div></div>${howWeAre(s)}</div>`+
      `<div class="fu-main two"><div class="fu-card"><h3>Litros por día</h3><div class="fu-sub2">Retail, flota y kerosene</div>${chartDaily(s)}<div class="fu-leg"><span><i style="background:var(--blue,#0f4c9c)"></i>Retail</span><span><i style="background:var(--green,#2f9e44)"></i>Flota</span><span><i style="background:#d9822b"></i>Kerosene</span><span><i style="background:#8a94a6;height:2px"></i>Promedio retail</span></div></div>${daysCard()}</div>`:'');
}

/* ------------------------------------------------------------- formularios */
const digits=value=>String(value||'').replace(/[^\d]/g,'');
const numberText=n=>n===''||n==null?'':fmt(n);
function layerShell(inner){
  closeLayer();
  const layer=document.createElement('div');
  layer.className='fu-ov';layer.id='fuLayer';
  layer.innerHTML=inner;
  document.body.appendChild(layer);
  S.layer='open';
  return layer;
}
function closeLayer(){S.layer='';S.imp=null;$('fuLayer')?.remove()}
function openLoad(date){
  const day=date||today();
  const row=S.rows.find(r=>r.sold_on===day);
  const layer=layerShell(`<div class="fu-mod" role="dialog" aria-label="Cargar litros"><h3>Cargar litros</h3><p>Anota los litros de un día. Si ya hay datos de esa fecha, se reemplazan.</p>
    <label class="fu-f">Día<input type="date" id="fuDate" value="${esc(day)}" max="${today()}"></label>
    <label class="fu-f">Litros retail (gasolinas y diésel)<input id="fuRetail" inputmode="numeric" placeholder="0" value="${numberText(row?.retail_l)}" class="big"></label>
    <label class="fu-f">Litros flota<input id="fuFlota" inputmode="numeric" placeholder="0" value="${numberText(row?.flota_l)}"></label>
    <label class="fu-f">Litros kerosene<input id="fuKero" inputmode="numeric" placeholder="0" value="${numberText(row?.kerosene_l)}"></label>
    <div class="fu-sum"><span>Total del día</span><b id="fuTotal">0 L</b></div>
    <div class="fu-err" id="fuErr"></div>
    <div class="fu-mf"><button type="button" class="fu-btn" data-fu="cancel">Cancelar</button><button type="button" class="fu-btn pri" data-fu="save" id="fuSave">Guardar</button></div></div>`);
  updateTotal();
  layer.querySelector('#fuRetail').focus();
}
function updateTotal(){
  const total=['fuRetail','fuFlota','fuKero'].reduce((sum,id)=>sum+Number(digits($(id)?.value)||0),0);
  const el=$('fuTotal');if(el)el.textContent=`${fmt(total)} L`;
}
async function saveLoad(){
  if(S.busy)return;
  const date=$('fuDate').value;
  const err=$('fuErr');
  if(!date){err.textContent='Elige el día.';return}
  S.busy=true;$('fuSave').disabled=true;err.textContent='';
  try{
    await rpc('fuel_sales_save',{p_company_id:companyId(),p_sold_on:date,p_retail:Number(digits($('fuRetail').value)||0),p_flota:Number(digits($('fuFlota').value)||0),p_kerosene:Number(digits($('fuKero').value)||0)});
    const [y,m]=date.split('-').map(Number);
    closeLayer();
    S.year=y;S.month=m;
    await load();
    toast(`Litros del ${dm(date)} guardados`);
  }catch(error){err.textContent=error.message;const b=$('fuSave');if(b)b.disabled=false}
  finally{S.busy=false}
}
function openContract(){
  const c=activeContract();
  const f=(id,label,value,hint)=>`<label class="fu-f">${label}<input id="${id}" inputmode="decimal" value="${esc(value)}">${hint?`<small>${hint}</small>`:''}</label>`;
  layerShell(`<div class="fu-mod wide" role="dialog" aria-label="Contrato"><h3>Contrato</h3><p>Valores del contrato de operación (montos netos, más IVA). Cámbialos cuando haya un contrato o addendum nuevo.</p>
    <div class="fu-grid"><label class="fu-f">Vigente desde<input type="date" id="fcFrom" value="${esc(c.valid_from)}"></label><label class="fu-f">Vigente hasta<input type="date" id="fcTo" value="${esc(c.valid_to)}"></label></div>
    <div class="fu-grid">${f('fcPivot','Pivote mensual (litros retail)',fmt(c.pivot_l))}${f('fcIva','IVA (%)',rate(c.iva_pct))}</div>
    <h4>Hasta el pivote</h4><div class="fu-grid">${f('fcLowRate','Tarifa por litro ($)',rate(c.low_rate))}${f('fcLowFixed','Comisión fija ($)',fmt(c.low_fixed))}</div>
    <h4>Sobre el pivote</h4><div class="fu-grid">${f('fcHighRate','Tarifa por litro sobre el pivote ($)',rate(c.high_rate))}${f('fcHighFixed','Comisión fija ($)',fmt(c.high_fixed))}</div>
    <h4>Fuera del pivote</h4><div class="fu-grid">${f('fcFlota','Flota, por litro ($)',rate(c.flota_rate))}${f('fcKero','Kerosene, por litro ($)',rate(c.kero_rate))}</div>
    <div class="fu-err" id="fuErr"></div>
    <div class="fu-mf"><button type="button" class="fu-btn" data-fu="cancel">Cancelar</button><button type="button" class="fu-btn pri" data-fu="contract-ok" id="fuSave">Guardar contrato</button></div></div>`);
}
const decimal=value=>{const t=String(value||'').trim().replace(/\s/g,'').replace(/\$/g,'');if(!t)return NaN;const clean=t.includes(',')?t.replace(/\./g,'').replace(',','.'):(/^\d{1,3}(\.\d{3})+$/.test(t)?t.replace(/\./g,''):t);return Number(clean)};
async function saveContract(){
  if(S.busy)return;
  const err=$('fuErr');
  const p={valid_from:$('fcFrom').value,valid_to:$('fcTo').value,pivot_l:decimal($('fcPivot').value),iva_pct:decimal($('fcIva').value),
    low_rate:decimal($('fcLowRate').value),low_fixed:decimal($('fcLowFixed').value),high_rate:decimal($('fcHighRate').value),
    high_fixed:decimal($('fcHighFixed').value),flota_rate:decimal($('fcFlota').value),kero_rate:decimal($('fcKero').value)};
  if(!p.valid_from||!p.valid_to||Object.entries(p).some(([k,v])=>!k.startsWith('valid_')&&!Number.isFinite(v))){err.textContent='Completa todos los valores con números.';return}
  if(p.valid_to<p.valid_from){err.textContent='La vigencia termina antes de empezar.';return}
  if(!(p.pivot_l>0)){err.textContent='El pivote debe ser mayor que cero.';return}
  S.busy=true;$('fuSave').disabled=true;err.textContent='';
  try{
    await rpc('fuel_contract_save',{p_company_id:companyId(),p_contract:p});
    closeLayer();
    await load();
    toast('Contrato guardado');
  }catch(error){err.textContent=error.message;const b=$('fuSave');if(b)b.disabled=false}
  finally{S.busy=false}
}

/* -------------------------------------------------------- importar informes */
const SHEETJS_URL='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const MAX_BYTES=8*1024*1024;
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
const KIND_LABEL={flota:'Tarjeta flota',general:'General (retail y kerosene)'};
function openImport(){
  layerShell(`<div class="fu-mod wide" role="dialog" aria-label="Importar informe"><h3>Importar informe</h3><p>Sube el «Resumen de venta combustible» del POS: el de <b>Tarjeta flota</b>, el <b>general</b> (retail y kerosene) o los dos juntos. El general debe sacarse solo con los tipos <b>General</b> y <b>Descuento</b>. Los días que ya existen se reemplazan solo en las columnas que trae cada informe.</p>
    <label class="fu-drop" id="fuDrop"><input type="file" id="fuFile" accept=".xlsx,.xls" multiple><b>Elegir archivos</b><span>.xlsx del POS · puedes elegir los dos a la vez</span></label>
    <div id="fuImpBody"></div>
    <div class="fu-err" id="fuErr"></div>
    <div class="fu-mf"><button type="button" class="fu-btn" data-fu="cancel">Cancelar</button><button type="button" class="fu-btn pri" data-fu="import-ok" id="fuSave" disabled>Importar</button></div></div>`);
  S.imp={reports:[],rows:[],existing:[],error:''};
}
async function readFiles(fileList){
  const imp=S.imp;
  if(!imp)return;
  imp.error='';imp.reports=[];imp.rows=[];imp.existing=[];
  const files=[...fileList];
  const body=$('fuImpBody');
  if(body)body.innerHTML='<div class="fu-note">Leyendo…</div>';
  try{
    const XLSX=await loadLib();
    const reports=[];
    for(const file of files){
      if(file.size>MAX_BYTES)throw new Error(`«${file.name}» pesa demasiado (máximo 8 MB).`);
      const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:true,defval:null});
      const report=window.FuelImport.parseReport(rows);
      if(!report.ok)throw new Error(`«${file.name}»: ${report.error}`);
      report.name=file.name;
      reports.push(report);
    }
    const merged=window.FuelImport.mergeReports(reports);
    if(!merged.ok)throw new Error(merged.error);
    if(merged.rows.some(r=>r.date>today()))throw new Error('El informe trae fechas futuras. Revisa el archivo.');
    imp.reports=reports;imp.rows=merged.rows;
    const from=merged.rows[0].date,to=merged.rows[merged.rows.length-1].date;
    const existing=await client().from('fuel_sales').select('sold_on, retail_l, flota_l, kerosene_l').eq('company_id',companyId()).gte('sold_on',from).lte('sold_on',to);
    if(existing.error)throw toError(existing.error);
    imp.existing=existing.data||[];
  }catch(error){
    imp.error=error.message;imp.reports=[];imp.rows=[];
  }
  renderImport();
}
function renderImport(){
  const imp=S.imp;
  const body=$('fuImpBody'),btn=$('fuSave'),err=$('fuErr');
  if(!imp||!body)return;
  if(err)err.textContent=imp.error||'';
  if(!imp.rows.length){body.innerHTML='';if(btn){btn.disabled=true;btn.textContent='Importar'}return}
  const by=new Map(imp.existing.map(r=>[r.sold_on,r]));
  const cols=[['retail','retail_l','Retail'],['flota','flota_l','Flota'],['kerosene','kerosene_l','Kerosene']];
  let created=0,changed=0,same=0;
  const lines=imp.rows.map(row=>{
    const old=by.get(row.date);
    let state='new';
    if(old){state=cols.some(([k,db])=>k in row&&Number(old[db])!==row[k])?'chg':'same'}
    if(state==='new')created++;else if(state==='chg')changed++;else same++;
    const cell=([k,db])=>k in row?`<span${old&&Number(old[db])!==row[k]?' class="chg"':''}>${fmt(row[k])}${old&&Number(old[db])!==row[k]?`<em>antes ${fmt(old[db])}</em>`:''}</span>`:'<span class="na">—</span>';
    return `<div class="fu-r5"><span>${dm(row.date)}</span>${cols.map(cell).join('')}<span class="st ${state}">${state==='new'?'Nuevo':state==='chg'?'Cambia':'Igual'}</span></div>`;
  }).join('');
  const sum=k=>imp.rows.reduce((t,r)=>t+(r[k]||0),0);
  const badges=imp.reports.map(r=>`<span class="fu-pill">${esc(KIND_LABEL[r.kind])} · ${dm(r.from)} al ${dm(r.to)} · ${Object.keys(r.days).length} días</span>`).join(' ');
  const totals=cols.filter(([k])=>imp.rows.some(r=>k in r)).map(([k,,label])=>`${label} <b>${fmt(sum(k))} L</b>`).join(' · ');
  const warns=imp.reports.flatMap(r=>r.warnings||[]).map(w=>`<div class="fu-warn">${esc(w)}</div>`).join('');
  body.innerHTML=`<div class="fu-imp-badges">${badges}</div>${warns}<div class="fu-imp-tot">${totals}</div>`+
    `<div class="fu-g fu-imp"><div class="fu-r5 h"><span>Día</span><span>Retail</span><span>Flota</span><span>Kerosene</span><span></span></div><div class="fu-imp-rows">${lines}</div></div>`+
    `<div class="fu-hint">${created} nuevo${created===1?'':'s'} · ${changed} que cambia${changed===1?'':'n'} · ${same} igual${same===1?'':'es'}. Los litros se redondean al litro por día.</div>`;
  if(btn){btn.disabled=false;btn.textContent=`Importar ${imp.rows.length} día${imp.rows.length===1?'':'s'}`}
}
async function applyImport(){
  const imp=S.imp;
  if(S.busy||!imp||!imp.rows.length)return;
  S.busy=true;const btn=$('fuSave'),err=$('fuErr');
  if(btn)btn.disabled=true;if(err)err.textContent='';
  try{
    const payload=imp.rows.map(r=>{const o={date:r.date};['retail','flota','kerosene'].forEach(k=>{if(k in r)o[k]=r[k]});return o});
    const result=await rpc('fuel_sales_import',{p_company_id:companyId(),p_rows:payload});
    const last=imp.rows[imp.rows.length-1].date;
    const [y,m]=last.split('-').map(Number);
    closeLayer();
    S.imp=null;S.year=y;S.month=m;S.showAll=false;
    await load();
    toast(`${result?.days||payload.length} días importados`);
  }catch(error){if(err)err.textContent=error.message;if(btn)btn.disabled=false}
  finally{S.busy=false}
}

/* --------------------------------------------------------------- eventos */
function onClick(event){
  const target=event.target.closest('[data-fu]');
  if(event.target.classList?.contains('fu-ov')){closeLayer();return}
  if(!target)return;
  const action=target.dataset.fu;
  if(action==='load')return openLoad();
  if(action==='edit')return openLoad(target.dataset.date);
  if(action==='contract')return openContract();
  if(action==='import')return openImport();
  if(action==='import-ok')return applyImport();
  if(action==='cancel')return closeLayer();
  if(action==='save')return saveLoad();
  if(action==='contract-ok')return saveContract();
  if(action==='more'){S.showAll=!S.showAll;return render()}
  if(action==='reload')return load();
}
function onChange(event){
  const el=event.target;
  if(!el)return;
  if(el.dataset?.fu==='month'||el.dataset?.fu==='year'){
    const month=Number(document.querySelector('#fuel select[data-fu=month]')?.value)||S.month;
    const year=Number(document.querySelector('#fuel select[data-fu=year]')?.value)||S.year;
    S.month=month;S.year=year;S.showAll=false;load();
    return;
  }
  if(el.id==='fuFile'){readFiles(el.files);return}
  if(el.id==='fuDate'){
    const row=S.rows.find(r=>r.sold_on===el.value);
    $('fuRetail').value=numberText(row?.retail_l);$('fuFlota').value=numberText(row?.flota_l);$('fuKero').value=numberText(row?.kerosene_l);
    updateTotal();
  }
}
function onInput(event){
  const el=event.target;
  if(['fuRetail','fuFlota','fuKero'].includes(el?.id)){
    const d=digits(el.value);
    el.value=d?fmt(Number(d)):'';
    updateTotal();
  }
}
function init(){
  const section=$('fuel');
  if(!section||section.dataset.fuReady)return;
  section.dataset.fuReady='1';
  let root=$('fuelRoot');
  if(!root){root=document.createElement('div');root.id='fuelRoot';section.appendChild(root)}
  root.classList.add('fu-root');
  document.addEventListener('click',event=>{if(event.target.closest('#fuel,.fu-ov'))onClick(event)});
  document.addEventListener('change',event=>{if(event.target.closest('#fuel,.fu-ov'))onChange(event)});
  document.addEventListener('input',event=>{if(event.target.closest('.fu-ov'))onInput(event)});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&S.layer)closeLayer();
    if(event.key==='Enter'&&S.layer&&event.target.closest('.fu-ov')&&event.target.tagName==='INPUT'&&event.target.type!=='date'){
      event.preventDefault();$('fuSave')?.click();
    }
  });
  let lastCompact=compact();
  window.addEventListener('resize',()=>{const c=compact();if(c!==lastCompact){lastCompact=c;if(section.classList.contains('active')&&S.status==='ready')render()}});
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){render();if(isAdmin())load()}
    if(!active&&was)closeLayer();
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.FuelUI={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
