(function(){
'use strict';

// Pantalla «Ventas»: cuánto se vende por producto, por pestaña (Lubricantes, Cigarros, Energéticas, Tienda).
// Los datos vienen de sales_history, que llena la importación de ventas del POS (Inventarios). No toca el
// stock. El café no entra aquí: se cuadra en «Máquinas de café».

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Math.round(Number(n||0)).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const dec=n=>(Math.round(n*10)/10).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
const norm=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const A=()=>window.InventoryApi;
const PAGE=1000;
const HISTORY_DAYS=400;
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const TABS=[
  {key:'lubricantes',label:'Lubricantes',inv:'lubricantes'},
  {key:'cigarros',label:'Cigarros',inv:'cigarrillos'},
  {key:'energeticas',label:'Energéticas',inv:'tienda',match:product=>/energ/.test(norm(product.category))},
  {key:'tienda',label:'Tienda',inv:'tienda'}
];

const S={status:'idle',invs:{},cache:{},coffee:new Set(),tab:'lubricantes',filter:'',range:null,loading:false,message:''};

/* ---------------------------------------------------------------- fechas */
const isoOf=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parse=iso=>new Date(`${iso}T12:00:00`);
const addDays=(iso,n)=>{const d=parse(iso);d.setDate(d.getDate()+n);return isoOf(d)};
const daysBetween=(from,to)=>Math.round((parse(to)-parse(from))/864e5)+1;
const dmy=iso=>String(iso||'').split('-').reverse().slice(0,2).join('-');
const monthEnd=ym=>{const [y,m]=ym.split('-').map(Number);return isoOf(new Date(y,m,0))};
const prevMonth=ym=>{const [y,m]=ym.split('-').map(Number);return isoOf(new Date(y,m-2,1)).slice(0,7)};
const monthName=ym=>{const [y,m]=ym.split('-').map(Number);return `${MONTHS[m-1]} ${y}`};
const monthShort=ym=>MONTHS[Number(ym.slice(5))-1].slice(0,3);
const today=()=>isoOf(new Date());

/* ---------------------------------------------------------------- datos */
function toError(error){
  if(error?.code==='PGRST205'||error?.code==='42P01'){const err=new Error('Las ventas todavía no están habilitadas en el servidor.');err.code='unavailable';return err}
  if(/Failed to fetch|NetworkError|Load failed/i.test(String(error?.message||''))||navigator.onLine===false){const err=new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');err.code='network';return err}
  return error instanceof Error?error:new Error(error?.message||'No se pudo cargar la información.');
}
const tabDef=()=>TABS.find(tab=>tab.key===S.tab)||TABS[0];
const visibleTabs=()=>TABS.filter(tab=>S.invs[tab.inv]);
async function loadBase(){
  const company=companyId();
  const overview=await A().overview(company);
  S.invs={};
  (overview?.inventories||[]).filter(inv=>inv.active).forEach(inv=>{
    const code=String(inv.code||'').toLowerCase()||norm(inv.name);
    S.invs[code]=inv;
  });
  S.coffee=new Set();
  try{
    const response=await client().from('coffee_machine_codes').select('pos_code').eq('company_id',company);
    if(!response.error)(response.data||[]).forEach(row=>S.coffee.add(String(row.pos_code)));
  }catch(_error){}
}
async function loadInventory(inv){
  const company=companyId();
  const since=addDays(today(),-HISTORY_DAYS);
  const products=((await A().products(inv.id))||[]).filter(product=>product.active);
  const rows=[];
  for(let from=0;;from+=PAGE){
    const response=await client().from('sales_history').select('sold_on, pos_code, qty, amount').eq('company_id',company).eq('inventory_id',inv.id).gte('sold_on',since).order('sold_on',{ascending:true}).range(from,from+PAGE-1);
    if(response.error)throw toError(response.error);
    rows.push(...(response.data||[]));
    if((response.data||[]).length<PAGE)break;
  }
  S.cache[inv.id]={products,rows};
}
async function load(force){
  const company=companyId();
  if(!company||!A()){S.status='idle';return}
  S.loading=true;S.message='';render();
  try{
    if(force||S.status!=='ready'){S.cache={};await loadBase()}
    const tabs=visibleTabs();
    if(!tabs.length){S.status='missing';return}
    if(!tabs.some(tab=>tab.key===S.tab)){S.tab=tabs[0].key;S.range=null}
    const inv=S.invs[tabDef().inv];
    if(!S.cache[inv.id])await loadInventory(inv);
    S.status='ready';
  }catch(error){
    const err=toError(error);
    S.status=err.code==='unavailable'?'unavailable':'error';
    S.message=err.message;
  }finally{S.loading=false;render()}
}

/* --------------------------------------------------------------- cálculo */
function tabData(){
  const tab=tabDef();
  const entry=S.cache[S.invs[tab.inv]?.id]||{products:[],rows:[]};
  const products=entry.products.filter(product=>!S.coffee.has(String(product.code))&&!/^caf[eé]$/.test(norm(product.category))&&(!tab.match||tab.match(product)));
  const cats=[...new Set(products.map(product=>product.category||'Sin categoría'))];
  const brands=[...new Set(products.map(product=>product.brand).filter(Boolean))];
  // Una sola lista de filtros: categorías si hay varias; si no, marcas.
  const byBrand=cats.length<2&&brands.length>1;
  const options=(byBrand?brands:cats).sort((a,b)=>a.localeCompare(b,'es'));
  const key=product=>byBrand?(product.brand||'Sin marca'):(product.category||'Sin categoría');
  const visible=S.filter&&options.includes(S.filter)?products.filter(product=>key(product)===S.filter):products;
  const codes=new Set(visible.map(product=>String(product.code)));
  const rows=entry.rows.filter(row=>codes.has(String(row.pos_code)));
  return {products:visible,all:products,rows,options,byBrand,last:entry.rows.length?entry.rows[entry.rows.length-1].sold_on:null};
}
function monthsOf(rows){return [...new Set(rows.map(row=>row.sold_on.slice(0,7)))].sort().reverse()}
// Rango elegido y el rango anterior de igual largo con el que se compara.
function ranges(data){
  const last=data.last||today();
  const range=S.range||(monthsOf(data.rows)[0]?`m:${monthsOf(data.rows)[0]}`:'all');
  if(range==='all'){
    const first=data.rows[0]?.sold_on||last;
    return {key:range,from:first,to:last,prev:null,label:'todo el período'};
  }
  if(range==='7'||range==='30'){
    const n=Number(range);const from=addDays(last,-(n-1));
    return {key:range,from,to:last,prev:{from:addDays(from,-n),to:addDays(from,-1),label:'los '+n+' días anteriores'},label:`últimos ${n} días`};
  }
  const ym=range.slice(2);
  const to=last<monthEnd(ym)&&last>=ym+'-01'?last:monthEnd(ym);
  const n=Number(to.slice(8));
  const pm=prevMonth(ym);
  const pto=`${pm}-${String(Math.min(n,Number(monthEnd(pm).slice(8)))).padStart(2,'0')}`;
  return {key:range,from:ym+'-01',to,prev:{from:pm+'-01',to:pto,label:monthShort(pm)+(to<monthEnd(ym)?` (1–${Number(pto.slice(8))})`:'')},label:monthName(ym),partial:to<monthEnd(ym)};
}
function aggregate(rows,from,to){
  const per=new Map();
  rows.forEach(row=>{
    if(row.sold_on<from||row.sold_on>to)return;
    const entry=per.get(String(row.pos_code))||{code:String(row.pos_code),qty:0,amount:0,days:new Set()};
    entry.qty+=row.qty;entry.amount+=Number(row.amount||0);entry.days.add(row.sold_on);
    per.set(entry.code,entry);
  });
  const list=[...per.values()].sort((a,b)=>b.amount-a.amount||b.qty-a.qty);
  return {list,qty:list.reduce((sum,item)=>sum+item.qty,0),amount:list.reduce((sum,item)=>sum+item.amount,0)};
}
const delta=(now,before)=>before>0?Math.round((now-before)/before*100):null;
const chip=(value,label)=>value===null?'':`<span class="sl-chip ${value>=0?'up':'dn'}">${value>0?'+':''}${value}% vs ${esc(label)}</span>`;

/* --------------------------------------------------------------- dibujo */
function chartHtml(data,rg){
  const span=daysBetween(rg.from,rg.to);
  if(span<2||!data.rows.some(row=>row.sold_on>=rg.from&&row.sold_on<=rg.to))return '';
  const daily=new Map();
  data.rows.forEach(row=>{if(row.sold_on>=rg.from&&row.sold_on<=rg.to)daily.set(row.sold_on,(daily.get(row.sold_on)||0)+Number(row.amount||0))});
  const weekly=span>62;
  const buckets=[];
  if(weekly){
    for(let from=rg.from;from<=rg.to;from=addDays(from,7)){
      let value=0;for(let i=0;i<7;i++)value+=daily.get(addDays(from,i))||0;
      buckets.push([from,value,`semana del ${dmy(from)}`]);
    }
  }else{
    for(let day=rg.from;day<=rg.to;day=addDays(day,1))buckets.push([day,daily.get(day)||0,dmy(day)]);
  }
  const W=900,H=190,L=50,R=10,T=14,B=28;
  const max=Math.max(1,...buckets.map(item=>item[1]));
  const slot=(W-L-R)/buckets.length,bw=Math.max(4,Math.min(28,slot*.62));
  const every=Math.ceil(buckets.length/10);
  const base=H-B;
  const bars=buckets.map(([day,value,label],index)=>{
    const h=(H-T-B)*value/max,cx=L+slot*index+slot/2;
    const tick=index%every===0?`<text x="${cx}" y="${H-9}" text-anchor="middle" class="sl-cx">${dmy(day)}</text>`:'';
    return `<g><rect x="${cx-slot/2}" y="${T}" width="${slot}" height="${H-T-B}" fill="transparent"><title>${esc(label)}: ${money(value)}</title></rect><rect x="${cx-bw/2}" y="${base-h}" width="${bw}" height="${value?Math.max(2,h):0}" rx="3" class="sl-bar"><title>${esc(label)}: ${money(value)}</title></rect>${tick}</g>`;
  }).join('');
  const grid=[0,.5,1].map(f=>{const y=base-(H-T-B)*f;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" class="sl-grid${f?' soft':''}"/><text x="${L-6}" y="${y+4}" text-anchor="end" class="sl-cx">${f?(max*f>=10000?'$'+fmt(max*f/1000)+' mil':money(max*f)):'0'}</text>`}).join('');
  return `<div class="sl-chart"><div class="sl-chart-h"><b>${weekly?'Venta por semana ($)':'Venta por día ($)'}</b><span>${dmy(rg.from)} al ${dmy(rg.to)}</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Venta en pesos por ${weekly?'semana':'día'}">${grid}${bars}</svg></div>`;
}
function monthsHtml(data,rg){
  const months=monthsOf(data.rows).slice(0,12).reverse();
  if(months.length<2)return '';
  const totals=months.map(ym=>{
    const total=data.rows.filter(row=>row.sold_on.startsWith(ym)).reduce((sum,row)=>sum+Number(row.amount||0),0);
    const partial=data.last&&data.last.startsWith(ym)&&data.last<monthEnd(ym);
    return {ym,total,partial};
  });
  const max=Math.max(1,...totals.map(item=>item.total));
  const rows=totals.map(item=>`<div class="sl-mrow"><span>${esc(monthName(item.ym))}${item.partial?' <small>(parcial)</small>':''}</span><div class="sl-meter big"><i style="width:${Math.round(item.total/max*100)}%"></i></div><b>${money(item.total)}</b></div>`).join('');
  return `<div class="sl-chart"><div class="sl-chart-h"><b>Evolución por mes</b><span>Total vendido en $</span></div>${rows}</div>`;
}
function tableHtml(data,cur,prev,rg){
  const head=`<div class="sl-th"><span>Producto</span><span>Unid.</span><span>Vendido</span><span>${prev?'vs '+esc(rg.prev.label):''}</span><span>Por semana</span><span>Participación</span></div>`;
  const span=daysBetween(rg.from,rg.to);
  const byCode=new Map(data.products.map(product=>[String(product.code),product]));
  const prevAmount=new Map((prev?.list||[]).map(item=>[item.code,item.amount]));
  const top=cur.list[0]?.amount||0;
  const rows=cur.list.map(item=>{
    const product=byCode.get(item.code);
    const share=cur.amount?item.amount/cur.amount*100:0;
    const change=prev?delta(item.amount,prevAmount.get(item.code)||0):null;
    const tag=prev?(change===null?'<span class="sl-chip">nuevo</span>':`<span class="sl-chip ${change>=0?'up':'dn'}">${change>0?'+':''}${change}%</span>`):'';
    return `<div class="sl-r"><div><b>${esc(product.name)}</b><small>${esc(product.category||'Sin categoría')} · código ${esc(item.code)}</small></div><b data-l="Unid.">${fmt(item.qty)}</b><b data-l="Vendido">${money(item.amount)}</b><div data-l="${prev?'vs '+esc(rg.prev.label):''}">${tag}</div><b data-l="Por semana">${dec(item.qty/span*7)}</b><div data-l="Participación"><div class="sl-meter"><i style="width:${top?Math.round(item.amount/top*100):0}%"></i></div><small>${dec(share)}% del total</small></div></div>`;
  }).join('');
  const sold=new Set(cur.list.map(item=>item.code));
  const quiet=data.products.filter(product=>!sold.has(String(product.code)));
  const none=quiet.length?`<div class="sl-note">Sin ventas en este período: ${quiet.slice(0,12).map(product=>esc(product.name)).join(' · ')}${quiet.length>12?` y ${quiet.length-12} más`:''}.</div>`:'';
  return head+rows+none;
}
function rangeOptions(data,rg){
  const items=[['7','Últimos 7 días'],['30','Últimos 30 días'],...monthsOf(data.rows).map(ym=>['m:'+ym,monthName(ym)[0].toUpperCase()+monthName(ym).slice(1)]),['all','Todo el período']];
  return items.map(([key,label])=>`<option value="${esc(key)}"${rg.key===key?' selected':''}>${esc(label)}</option>`).join('');
}
function render(){
  const root=$('salesRoot');
  if(!root)return;
  const head=`<div class="sl-head"><div><h1>Ventas</h1><p>Lo que vendes por producto, según el POS. El stock se controla en Inventarios y el café en Máquinas de café.</p></div><div class="sl-acts"><button type="button" class="sl-btn ghost" data-act="sales-import">Importar ventas</button></div></div>`;
  if(S.status==='idle'){root.innerHTML=head+'<div class="sl-note">Cargando…</div>';return}
  if(S.status==='unavailable'||S.status==='error'){root.innerHTML=head+`<div class="sl-note">${esc(S.message||'No se pudo cargar.')} <button type="button" class="sl-link" data-sl="reload">Reintentar</button></div>`;return}
  if(S.status==='missing'){root.innerHTML=head+'<div class="sl-note">No encuentro inventarios activos. Créalos en Inventarios para ver sus ventas aquí.</div>';return}
  const tabs=`<div class="sl-tabs top">${visibleTabs().map(tab=>`<button type="button" data-sl="tab" data-v="${tab.key}" class="${S.tab===tab.key?'on':''}">${esc(tab.label)}</button>`).join('')}</div>`;
  const inv=S.invs[tabDef().inv];
  if(!S.cache[inv?.id]){root.innerHTML=head+tabs+'<div class="sl-note">Cargando…</div>';return}
  const data=tabData();
  const rg=ranges(data);
  const cur=aggregate(data.rows,rg.from,rg.to);
  const prev=rg.prev?aggregate(data.rows,rg.prev.from,rg.prev.to):null;
  const best=cur.list[0]?data.products.find(product=>String(product.code)===cur.list[0].code):null;
  const dAmount=prev?delta(cur.amount,prev.amount):null,dQty=prev?delta(cur.qty,prev.qty):null;
  const kpis=`<div class="sl-kpis">
    <div class="sl-kpi" style="--c:var(--blue)"><i>$</i><div><b>${money(cur.amount)}</b><span>Vendido · ${esc(rg.label)}</span>${chip(dAmount,rg.prev?.label)}</div></div>
    <div class="sl-kpi" style="--c:var(--green)"><i>#</i><div><b>${fmt(cur.qty)}</b><span>Unidades vendidas</span>${chip(dQty,rg.prev?.label)}</div></div>
    <div class="sl-kpi" style="--c:var(--orange)"><i>★</i><div><b class="sm">${esc(best?best.name:'—')}</b><span>El que más vende ($)</span></div></div>
    <div class="sl-kpi" style="--c:var(--red)"><i>▤</i><div><b>${cur.list.length} de ${data.products.length}</b><span>Productos con ventas</span></div></div></div>`;
  const filter=data.options.length>1?`<select data-sl="filter" aria-label="${data.byBrand?'Marca':'Categoría'}"><option value="">${data.byBrand?'Todas las marcas':'Todas las categorías'}</option>${data.options.map(option=>`<option value="${esc(option)}"${S.filter===option?' selected':''}>${esc(option)}</option>`).join('')}</select>`:'';
  const controls=`<div class="sl-bar-top"><div class="sl-sel"><select data-sl="range" aria-label="Período">${rangeOptions(data,rg)}</select>${filter}</div>${rg.partial?`<span class="sl-hint">Se muestra ${esc(rg.label)} hasta el ${dmy(rg.to)}; se compara con los mismos días de ${esc(rg.prev.label)}.</span>`:''}</div>`;
  const body=data.rows.length
    ?chartHtml(data,rg)+(rg.key==='all'||rg.key.startsWith('m:')?monthsHtml(data,rg):'')+(cur.list.length?tableHtml(data,cur,prev,rg):'<div class="sl-note">No hay ventas en este período.</div>')
    :`<div class="sl-note">Aún no hay ventas guardadas de ${esc(tabDef().label.toLowerCase())}. Sube el «Informe de Ventas por Artículos» del POS con «Importar ventas» (arriba) y aparecerán aquí.</div>`;
  root.innerHTML=head+tabs+kpis+`<div class="sl-card">${controls}${body}</div>`;
}

/* --------------------------------------------------------------- eventos */
function onClick(event){
  const target=event.target.closest('[data-sl]');
  if(!target)return;
  const action=target.dataset.sl;
  if(action==='tab'){S.tab=target.dataset.v;S.filter='';S.range=null;load();return}
  if(action==='reload')load(true);
}
function onChange(event){
  const target=event.target.closest('[data-sl]');
  if(!target)return;
  if(target.dataset.sl==='range'){S.range=target.value;render()}
  if(target.dataset.sl==='filter'){S.filter=target.value;render()}
}
function init(){
  const section=$('sales');
  if(!section||section.dataset.slReady)return;
  section.dataset.slReady='1';
  let root=$('salesRoot');
  if(!root){root=document.createElement('div');root.id='salesRoot';section.appendChild(root)}
  root.classList.add('sl-root');
  document.addEventListener('click',event=>{if(event.target.closest('#sales'))onClick(event)});
  document.addEventListener('change',event=>{if(event.target.closest('#sales'))onChange(event)});
  window.addEventListener('inventory:changed',()=>{if(section.classList.contains('active'))load(true)});
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){render();load(true)}
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.SalesUI={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
