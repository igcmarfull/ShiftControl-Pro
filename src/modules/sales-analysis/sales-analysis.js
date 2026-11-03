(function(){
'use strict';

// Pantalla «Análisis de ventas» (solo administrador): se sube el «Reporte de Transacciones Realizadas» del POS (Excel) y se
// buscan patrones: una operadora que le vende mucho a un mismo cliente, montos redondos, ventas anuladas y ventas fuera del
// turno planificado. El archivo se lee en el navegador y no se guarda: sin base de datos, sin tocar ventas ni inventario.
// Lo que sí se recuerda en este navegador (localStorage) es la sensibilidad de las alertas y qué trabajador es cada nombre del POS.
// El cálculo está en sales-analysis-calc.js.

const SHEETJS_URL='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const MAX_BYTES=8*1024*1024;
const PREFS_KEY='shiftcontrol.salesAnalysis.prefs';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Math.round(Number(n)||0).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const pct=n=>Math.round(Number(n)||0)+' %';
const dmy=iso=>String(iso||'').split('-').reverse().join('-');
const Calc=()=>window.SalesAnalysisCalc;
const LEVEL={high:'Alta',mid:'Media',info:'Para mirar'};
const KIND={concentracion:'Cliente repetido',redondos:'Montos redondos','mismo-dia':'Mismo día',anulada:'Anulada',turno:'Fuera de turno'};
const OPTION_FIELDS=[
  ['minRepeat','Ventas al mismo cliente','Avisa cuando una operadora le vende este número de veces o más al mismo cliente.',1,50],
  ['share','Concentración (%)','Avisa cuando un cliente es este porcentaje o más de lo que vendió una operadora.',5,100],
  ['roundPct','Montos redondos (%)','Avisa cuando este porcentaje o más de las ventas de una operadora son múltiplos de $10.000.',10,100]
];

const S={fileName:'',parsed:null,result:null,error:'',busy:false,over:false,optionsOpen:false,level:'',operator:'',
  opts:{},map:{},ignored:[]};

function loadPrefs(){
  try{
    const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');
    S.opts=prefs.opts&&typeof prefs.opts==='object'?prefs.opts:{};
    S.map=prefs.map&&typeof prefs.map==='object'?prefs.map:{};
    S.ignored=Array.isArray(prefs.ignored)?prefs.ignored.filter(item=>item&&item.key):[];
  }catch(_){S.opts={};S.map={};S.ignored=[]}
}
function savePrefs(){
  try{localStorage.setItem(PREFS_KEY,JSON.stringify({opts:S.opts,map:S.map,ignored:S.ignored}))}catch(_){}
}
const optionValue=key=>S.opts[key]??Calc().DEFAULTS[key];

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

/* ------------------------------------------------------------ datos de la app */
const appState=()=>window.ShiftControlState?.get?.()||window.state||{};
const activeEmployees=()=>{
  const list=typeof window.EmployeeModule?.getAll==='function'?window.EmployeeModule.getAll():(appState().employees||[]);
  return list.filter(employee=>employee.active!==false);
};
function operatorKeys(){return [...new Set(S.parsed.transactions.map(t=>t.operatorKey))]}
function operatorName(key){return S.parsed.transactions.find(t=>t.operatorKey===key)?.operator||key}
/* Qué trabajador es cada nombre del POS: lo elegido a mano, si no la coincidencia automática. */
function operatorMap(){
  const employees=activeEmployees();
  const map={};
  operatorKeys().forEach(key=>{
    const chosen=S.map[key];
    if(chosen==='')return;
    const employee=chosen?employees.find(item=>item.id===chosen):Calc().suggestEmployee(operatorName(key),employees);
    if(employee)map[key]=employee;
  });
  return map;
}

function recompute(){
  if(!S.parsed)return;
  const options={};
  OPTION_FIELDS.forEach(([key])=>{options[key]=Number(optionValue(key))});
  const schedule=window.ShiftSchedule;
  S.result=Calc().analyze(S.parsed.transactions,{...options,ignoreClients:S.ignored.map(item=>item.key),
    plans:Array.isArray(appState().plans)?appState().plans:[],operatorMap:operatorMap(),
    shiftAt:schedule?minutes=>schedule.at(minutes):undefined});
}

/* ------------------------------------------------------------ pantalla */
function dropHtml(){
  return `<label class="sva-drop${S.over?' over':''}" id="svaDrop"><input type="file" id="svaFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    <b>${S.busy?'Leyendo el archivo…':'Subir reporte de transacciones (Excel)'}</b>
    <small>Arrastra el archivo aquí o toca para elegirlo · «Reporte de Transacciones Realizadas» del POS, hasta 8 MB</small></label>
    <p class="sva-note">El archivo se lee en tu navegador y no se guarda en ningún servidor. Las alertas son indicios para revisar, no pruebas: un cliente de flota que compra seguido o un monto redondo pueden ser normales. Para saber si de verdad cargó combustible hace falta cruzarlo con litros o patente, que este reporte no trae.</p>`;
}
function kpisHtml(summary){
  const cells=[['Ventas',fmt(summary.n),`${dmy(summary.from)}${summary.to!==summary.from?` al ${dmy(summary.to)}`:''}`],
    ['Monto vendido',money(summary.total),'sin contar anuladas'],
    ['Clientes distintos',fmt(summary.clients),''],
    ['Operadoras',fmt(summary.operators),summary.cancelled?`${summary.cancelled} venta${summary.cancelled===1?'':'s'} anulada${summary.cancelled===1?'':'s'}`:'sin anuladas']];
  return `<div class="sva-kpis">${cells.map(([label,value,sub])=>`<div class="sva-k"><span>${label}</span><b>${value}</b><small>${esc(sub)}</small></div>`).join('')}</div>`;
}
function optionsHtml(){
  const fields=OPTION_FIELDS.map(([key,label,hint,min,max])=>`<label class="sva-opt"><span>${label}</span><input type="number" min="${min}" max="${max}" step="1" inputmode="numeric" value="${esc(optionValue(key))}" data-sva-opt="${key}"><small>${hint}</small></label>`).join('');
  return `<details class="sva-adv"${S.optionsOpen?' open':''} data-sva-details="optionsOpen"><summary>Sensibilidad de las alertas</summary><div class="sva-opts">${fields}</div>
    <button type="button" class="sva-btn" data-sva="reset-opts">Volver a los valores iniciales</button>${ignoredHtml()}</details>`;
}
function ignoredHtml(){
  if(!S.ignored.length)return '';
  return `<div class="sva-ign"><b>Clientes de confianza</b><small>No generan alertas de cliente repetido ni de mismo día.</small>${S.ignored.map(item=>`<span class="sva-pill">${esc(item.name)}<button type="button" data-sva="unignore" data-key="${esc(item.key)}" aria-label="Volver a avisar de ${esc(item.name)}">×</button></span>`).join('')}</div>`;
}
function alertHtml(alert){
  const rows=alert.refs.slice(0,12).map(ref=>`<tr><td>${esc(dmy(ref.date))} ${esc(ref.time)}</td><td>${esc(ref.receipt||'—')}</td><td>${esc(ref.operator)}</td><td>${esc(ref.client)}</td><td class="n">${money(ref.amount)}</td></tr>`).join('');
  const more=alert.refs.length>12?`<p class="sva-more">y ${alert.refs.length-12} más</p>`:'';
  return `<details class="sva-al ${alert.level}"><summary><i></i><div><b>${esc(alert.title)}</b><small>${esc(alert.detail)}</small></div><span class="sva-tag">${esc(KIND[alert.kind]||alert.kind)}</span><span class="sva-amt">${money(alert.amount)}</span></summary>
    <div class="sva-refs"><table><thead><tr><th>Fecha</th><th>Comprobante</th><th>Operadora</th><th>Cliente</th><th class="n">Monto</th></tr></thead><tbody>${rows}</tbody></table>${more}${alert.clientKey?`<button type="button" class="sva-btn sm" data-sva="ignore" data-key="${esc(alert.clientKey)}" data-name="${esc(alert.client)}">Es un cliente de confianza: no avisar</button>`:''}</div></details>`;
}
function alertsHtml(result){
  const operators=[...new Set(result.alerts.map(alert=>alert.operator).filter(Boolean))].sort();
  const shown=result.alerts.filter(alert=>(!S.level||alert.level===S.level)&&(!S.operator||alert.operator===S.operator));
  const counts={high:0,mid:0,info:0};
  result.alerts.forEach(alert=>counts[alert.level]++);
  const chips=[['','Todas',result.alerts.length],['high','Alta',counts.high],['mid','Media',counts.mid],['info','Para mirar',counts.info]]
    .map(([key,label,count])=>`<button type="button" class="sva-chip${S.level===key?' on':''}" data-sva-level="${key}">${label} <em>${count}</em></button>`).join('');
  const select=`<select id="svaOperator" aria-label="Filtrar por operadora"><option value="">Todas las operadoras</option>${operators.map(name=>`<option value="${esc(name)}"${S.operator===name?' selected':''}>${esc(name)}</option>`).join('')}</select>`;
  const body=shown.length?`<div class="sva-als">${shown.map(alertHtml).join('')}</div>`
    :`<div class="sva-empty">${result.alerts.length?'No hay alertas con ese filtro.':'No encontré nada raro con esta sensibilidad. Con pocos días de datos es normal.'}</div>`;
  return `<section class="sva-sec"><div class="sva-sh"><h3>Alertas</h3><div class="sva-flt">${chips}${select}</div></div>${body}</section>`;
}
function operatorsHtml(result){
  const employees=activeEmployees();
  const map=operatorMap();
  const rows=result.operators.map(op=>{
    const options=[`<option value="">Sin trabajador</option>`].concat(employees.map(employee=>`<option value="${esc(employee.id)}"${map[op.key]?.id===employee.id?' selected':''}>${esc(employee.name)}</option>`)).join('');
    return `<div class="sva-r">
      <div class="sva-p"><b>${esc(op.operator)}</b><small>${op.top?`Más vendido a: ${esc(op.top.client)} (${pct(op.top.share)})`:''}</small></div>
      <div class="sva-n" data-l="Ventas">${fmt(op.n)}</div>
      <div class="sva-n" data-l="Monto">${money(op.total)}</div>
      <div class="sva-n" data-l="Clientes">${fmt(op.clients)}</div>
      <div class="sva-n" data-l="Montos redondos">${pct(op.roundPct)}</div>
      <div class="sva-n sel" data-l="Trabajador en la app"><select data-sva-map="${esc(op.key)}" aria-label="Trabajador de ${esc(op.operator)}">${options}</select></div></div>`;
  }).join('');
  return `<section class="sva-sec"><div class="sva-sh"><h3>Operadoras</h3><small>El trabajador se usa para cruzar con la planificación. Se recuerda en este navegador.</small></div>
    <div class="sva-t"><div class="sva-h sva-o"><span>Operadora</span><span>Ventas</span><span>Monto</span><span>Clientes</span><span>Redondos</span><span>Trabajador en la app</span></div>${rows}</div></section>`;
}
function clientsHtml(result){
  const rows=result.clients.slice(0,15).map(client=>`<div class="sva-r sva-cl">
      <div class="sva-p"><b>${esc(client.client)}</b><small>${esc(client.rut||'sin RUT')} · ${client.operators.map(op=>`${esc(op.name.split(' ')[0])} ${op.count}`).join(', ')}</small></div>
      <div class="sva-n" data-l="Ventas">${fmt(client.n)}</div><div class="sva-n" data-l="Monto">${money(client.total)}</div></div>`).join('');
  return `<section class="sva-sec"><div class="sva-sh"><h3>Clientes con más compras</h3><small>Los 15 con mayor monto del periodo.</small></div>
    <div class="sva-t"><div class="sva-h sva-c"><span>Cliente</span><span>Ventas</span><span>Monto</span></div>${rows}</div></section>`;
}

function render(){
  const root=$('salesAnalysisRoot');
  if(!root)return;
  const head=`<div class="sva-head"><h1>Análisis de ventas</h1><p>Sube el reporte de transacciones del POS para ver quién le vende a quién, y qué ventas conviene revisar.</p></div>`;
  if(!S.parsed||!S.result){
    root.innerHTML=head+(S.error?`<div class="sva-err">${esc(S.error)}</div>`:'')+dropHtml();
    return;
  }
  const info=S.parsed.nonSale?`<div class="sva-warn">Se ignoraron ${S.parsed.nonSale} movimientos que no son ventas (por ejemplo devoluciones).</div>`:'';
  root.innerHTML=`${head}${S.error?`<div class="sva-err">${esc(S.error)}</div>`:''}${info}
    <div class="sva-bar"><div class="sva-who"><b>${esc(S.fileName)}</b><small>${fmt(S.parsed.transactions.length)} transacciones leídas</small></div>
      <div class="sva-acts"><button type="button" class="sva-btn" data-sva="export"${S.busy?' disabled':''}>Descargar alertas (Excel)</button><button type="button" class="sva-btn pri" data-sva="again">Subir otro archivo</button></div></div>
    ${kpisHtml(S.result.summary)}${optionsHtml()}${alertsHtml(S.result)}${operatorsHtml(S.result)}${clientsHtml(S.result)}`;
}

/* ------------------------------------------------------------ acciones */
async function handleFile(file){
  if(!file||S.busy)return;
  S.error='';
  if(file.size>MAX_BYTES){S.error='El archivo pesa más de 8 MB.';render();return}
  S.busy=true;render();
  try{
    const XLSX=await loadLib();
    const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:true,defval:null});
    const parsed=Calc().parse(rows);
    if(!parsed.ok)throw new Error(parsed.error);
    S.parsed=parsed;S.fileName=file.name;S.level='';S.operator='';
    recompute();
  }catch(error){
    S.parsed=null;S.result=null;S.error=error?.message||'No pude leer el archivo.';
  }finally{S.busy=false;render()}
}

async function exportAlerts(){
  if(!S.result)return;
  S.busy=true;render();
  try{
    const XLSX=await loadLib();
    const book=XLSX.utils.book_new();
    const alerts=[['Nivel','Tipo','Operadora','Cliente','Ventas','Monto','Detalle']].concat(S.result.alerts.map(alert=>[LEVEL[alert.level],KIND[alert.kind]||alert.kind,alert.operator,alert.client,alert.count,alert.amount,alert.detail]));
    const operators=[['Operadora','Ventas','Monto','Clientes distintos','% montos redondos','Cliente al que más vendió','% de sus ventas']].concat(S.result.operators.map(op=>[op.operator,op.n,op.total,op.clients,Math.round(op.roundPct),op.top?.client||'',op.top?Math.round(op.top.share):0]));
    const clients=[['Cliente','RUT','Ventas','Monto','Operadoras']].concat(S.result.clients.map(client=>[client.client,client.rut,client.n,client.total,client.operators.map(op=>`${op.name} (${op.count})`).join(', ')]));
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(alerts),'Alertas');
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(operators),'Operadoras');
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(clients),'Clientes');
    XLSX.writeFile(book,`Analisis_de_ventas_${S.result.summary.from}_${S.result.summary.to}.xlsx`);
  }catch(error){
    S.error=error?.message||'No pude generar el Excel.';
  }finally{S.busy=false;render()}
}

function onClick(event){
  const level=event.target.closest('[data-sva-level]');
  if(level){S.level=level.dataset.svaLevel;render();return}
  const button=event.target.closest('[data-sva]');
  if(!button)return;
  const action=button.dataset.sva;
  if(action==='again'){S.parsed=null;S.result=null;S.error='';render()}
  if(action==='export')exportAlerts();
  if(action==='reset-opts'){S.opts={};savePrefs();recompute();render()}
  if(action==='ignore'&&!S.ignored.some(item=>item.key===button.dataset.key)){S.ignored.push({key:button.dataset.key,name:button.dataset.name||button.dataset.key});savePrefs();recompute();render()}
  if(action==='unignore'){S.ignored=S.ignored.filter(item=>item.key!==button.dataset.key);savePrefs();recompute();render()}
}
function onChange(event){
  const target=event.target;
  if(target.id==='svaFile'){handleFile(target.files?.[0]);target.value='';return}
  if(target.id==='svaOperator'){S.operator=target.value;render();return}
  if(target.dataset.svaOpt){
    const [,, , min,max]=OPTION_FIELDS.find(field=>field[0]===target.dataset.svaOpt);
    const value=Math.min(max,Math.max(min,Math.round(Number(target.value))||min));
    S.opts[target.dataset.svaOpt]=value;savePrefs();recompute();render();return;
  }
  if(target.dataset.svaMap!==undefined&&target.dataset.svaMap!==''){
    S.map[target.dataset.svaMap]=target.value;savePrefs();recompute();render();
  }
}
function onToggle(event){
  const key=event.target?.dataset?.svaDetails;
  if(key)S[key]=event.target.open;
}

function init(){
  const section=$('salesAnalysis');
  if(!section)return;
  loadPrefs();
  section.addEventListener('click',onClick);
  section.addEventListener('change',onChange);
  section.addEventListener('toggle',onToggle,true);
  section.addEventListener('dragover',event=>{if(!S.parsed&&event.target.closest('#svaDrop')){event.preventDefault();if(!S.over){S.over=true;$('svaDrop')?.classList.add('over')}}});
  section.addEventListener('dragleave',event=>{if(event.target.closest('#svaDrop')){S.over=false;$('svaDrop')?.classList.remove('over')}});
  section.addEventListener('drop',event=>{
    if(!event.target.closest('#svaDrop'))return;
    event.preventDefault();S.over=false;
    handleFile(event.dataTransfer?.files?.[0]);
  });
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){if(S.parsed)recompute();render()}
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.SalesAnalysisUI={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
