(function(){
'use strict';

// Pantalla «Ventas»: cuánto se vende por producto, por pestaña (Lubricantes, Cigarros, Energéticas, Hot dogs, Tienda, Café).
// Los datos vienen de sales_history, que llena la importación de ventas del POS (Inventarios). No toca el
// stock. El café sale de coffee_sales (vasos, monto y nombre que guarda la misma importación); allí el stock
// no existe y la cuadratura con el numeral sigue en «Máquinas de café».

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
// Energéticas y Hot dogs salen del inventario de Tienda por su categoría; la pestaña Tienda es el resto (sin ellas).
const isEnergy=product=>/energ/.test(norm(product.category));
const isHotDog=product=>/hot ?dog/.test(norm(`${product.category} ${product.name}`));
const TABS=[
  {key:'lubricantes',label:'Lubricantes',inv:'lubricantes'},
  {key:'cigarros',label:'Cigarros',inv:'cigarrillos'},
  {key:'energeticas',label:'Energéticas',inv:'tienda',match:isEnergy},
  {key:'hotdogs',label:'Hot dogs',inv:'tienda',match:isHotDog},
  {key:'tienda',label:'Tienda',inv:'tienda',match:product=>!isEnergy(product)&&!isHotDog(product)},
  {key:'cafe',label:'Café',source:'coffee',filterLabel:'Todas las máquinas'}
];

const S={status:'idle',invs:{},cache:{},coffee:new Set(),coffeeOk:false,coffeeMachine:new Map(),tab:'lubricantes',filter:'',range:null,sel:null,loading:false,message:''};

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
const visibleTabs=()=>TABS.filter(tab=>tab.source==='coffee'?S.coffeeOk:S.invs[tab.inv]);
const cacheKey=tab=>tab.source==='coffee'?'coffee':S.invs[tab.inv]?.id;
async function loadBase(){
  const company=companyId();
  const overview=await A().overview(company);
  S.invs={};
  (overview?.inventories||[]).filter(inv=>inv.active).forEach(inv=>{
    const code=String(inv.code||'').toLowerCase()||norm(inv.name);
    S.invs[code]=inv;
  });
  S.coffee=new Set();
  S.coffeeOk=false;
  S.coffeeMachine=new Map();
  try{
    const [codes,machines]=await Promise.all([
      client().from('coffee_machine_codes').select('pos_code, machine_id').eq('company_id',company),
      client().from('coffee_machines').select('id, name, active').eq('company_id',company)
    ]);
    const names=new Map();
    if(!machines.error)(machines.data||[]).filter(row=>row.active!==false).forEach(row=>names.set(row.id,row.name));
    if(!codes.error)(codes.data||[]).forEach(row=>{S.coffee.add(String(row.pos_code));if(names.has(row.machine_id))S.coffeeMachine.set(String(row.pos_code),names.get(row.machine_id))});
    S.coffeeOk=names.size>0;
  }catch(_error){}
}
// Café: no hay inventario; los productos salen de los códigos de las máquinas y los nombres de las ventas guardadas.
async function loadCoffee(){
  const company=companyId();
  const since=addDays(today(),-HISTORY_DAYS);
  const rows=[];
  for(let from=0;;from+=PAGE){
    const response=await client().from('coffee_sales').select('sold_on, pos_code, qty, amount, description').eq('company_id',company).gte('sold_on',since).order('sold_on',{ascending:true}).range(from,from+PAGE-1);
    if(response.error)throw toError(response.error);
    rows.push(...(response.data||[]));
    if((response.data||[]).length<PAGE)break;
  }
  const names=new Map();
  rows.forEach(row=>{if(row.description)names.set(String(row.pos_code),row.description)});
  const codes=new Set([...S.coffee,...rows.map(row=>String(row.pos_code))]);
  const products=[...codes].map(code=>({code,name:names.get(code)||`Código ${code}`,category:S.coffeeMachine.get(code)||'Café',brand:'',active:true}));
  S.cache.coffee={products,rows};
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
    const tab=tabDef();
    if(!S.cache[cacheKey(tab)])await(tab.source==='coffee'?loadCoffee():loadInventory(S.invs[tab.inv]));
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
  const entry=S.cache[cacheKey(tab)]||{products:[],rows:[]};
  const isCoffee=tab.source==='coffee';
  const products=entry.products.filter(product=>(isCoffee||(!S.coffee.has(String(product.code))&&!/^caf[eé]$/.test(norm(product.category))))&&(!tab.match||tab.match(product)));
  const cats=[...new Set(products.map(product=>product.category||'Sin categoría'))];
  const brands=[...new Set(products.map(product=>product.brand).filter(Boolean))];
  // Una sola lista de filtros: categorías si hay varias; si no, marcas.
  const byBrand=cats.length<2&&brands.length>1;
  const options=(byBrand?brands:cats).sort((a,b)=>a.localeCompare(b,'es'));
  const key=product=>byBrand?(product.brand||'Sin marca'):(product.category||'Sin categoría');
  const visible=S.filter&&options.includes(S.filter)?products.filter(product=>key(product)===S.filter):products;
  const codes=new Set(visible.map(product=>String(product.code)));
  const rows=entry.rows.filter(row=>codes.has(String(row.pos_code)));
  return {products:visible,all:products,rows,options,byBrand,keyOf:key,last:entry.rows.length?entry.rows[entry.rows.length-1].sold_on:null};
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
const COLORS=['--blue','--green','--orange','--red'];
const short=n=>n>=1000?'$'+fmt(n/1000)+' mil':money(n);
const plural=(n,one,many)=>n===1?one:many;
function sparkline(values,w,h,color){
  if(values.length<2)return '';
  const max=Math.max(...values,1),step=w/(values.length-1);
  const points=values.map((v,i)=>`${(i*step).toFixed(1)},${(h-2-(h-4)*v/max).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="sl-spark" aria-hidden="true"><polyline points="${points}" fill="none" stroke="var(${color})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
// Cubetas de la serie: por día, o por semana si el período es largo.
function buckets(rg){
  const span=daysBetween(rg.from,rg.to);
  const weekly=span>62;
  const list=[];
  for(let from=rg.from;from<=rg.to;from=addDays(from,weekly?7:1))list.push({from,to:weekly?addDays(from,6):from});
  return {weekly,list};
}
function series(rows,bk){
  const index=new Map();
  bk.list.forEach((bucket,i)=>{for(let day=bucket.from;day<=bucket.to;day=addDays(day,1))index.set(day,i)});
  const amount=bk.list.map(()=>0),qty=bk.list.map(()=>0);
  rows.forEach(row=>{const i=index.get(row.sold_on);if(i!==undefined){amount[i]+=Number(row.amount||0);qty[i]+=row.qty}});
  return {amount,qty};
}
function chartHtml(data,rg){
  const bk=buckets(rg);
  if(bk.list.length<2||!data.rows.some(row=>row.sold_on>=rg.from&&row.sold_on<=rg.to))return '';
  const sr=series(data.rows,bk);
  const values=sr.amount,qtys=sr.qty;
  const max=Math.max(1,...values);
  const topIndex=Math.max(...values)>0?values.indexOf(Math.max(...values)):-1;
  const sel=S.sel!==null&&S.sel<values.length?S.sel:topIndex;
  const labelAll=bk.list.length<=20;
  const every=Math.ceil(values.length/(bk.weekly?10:16));
  const cap=text=>text.charAt(0).toUpperCase()+text.slice(1);
  const nameOf=index=>{
    const from=bk.list[index].from;
    return bk.weekly?`Semana del ${dmy(from)} al ${dmy(bk.list[index].to)}`:`${cap(parse(from).toLocaleDateString('es-CL',{weekday:'long'}))} ${dmy(from)}`;
  };
  // Barras en HTML (no SVG escalado) para que el texto conserve su tamaño en cualquier ancho.
  // Un toque o clic en una barra muestra su día; en pantallas anchas todas llevan su valor.
  const cols=values.map((value,index)=>{
    const from=bk.list[index].from;
    const top=index===topIndex;
    const tick=index%every===0?`<i>${bk.weekly?dmy(from):from.slice(8)}</i>`:'';
    const label=value>0&&(top||labelAll)?`<b${top?'':' class="mini"'}>${short(value)}</b>`:'';
    return `<div class="sl-dcol${index===sel?' sel':''}" data-sl="bar" data-i="${index}" title="${esc(nameOf(index))}: ${money(value)} · ${fmt(qtys[index])} unid."><div class="sl-dv">${label}</div><div class="sl-db${index===sel?' sel':''}" style="height:${value?Math.max(3,Math.round(value/max*96)):0}px"></div><div class="sl-dt">${tick}</div></div>`;
  }).join('');
  const detail=sel>=0?`<div class="sl-dsel"><b>${esc(nameOf(sel))}</b><b>${money(values[sel])}</b><b>${fmt(qtys[sel])} ${plural(qtys[sel],'unidad','unidades')}</b><span>Toca una barra para ver otro ${bk.weekly?'período':'día'}</span></div>`:'';
  return `<div class="sl-card"><h4>${bk.weekly?'Venta por semana':'Venta por día'}<small>${dmy(rg.from)} al ${dmy(rg.to)}</small></h4><div class="sl-dchart" role="img" aria-label="Venta en pesos por ${bk.weekly?'semana':'día'}">${cols}</div>${detail}</div>`;
}
function monthsHtml(data,rg){
  const months=monthsOf(data.rows).slice(0,6).reverse();
  if(months.length<2)return '';
  const totals=months.map(ym=>{
    const rows=data.rows.filter(row=>row.sold_on.startsWith(ym));
    return {ym,total:rows.reduce((sum,row)=>sum+Number(row.amount||0),0),qty:rows.reduce((sum,row)=>sum+row.qty,0),partial:Boolean(data.last&&data.last.startsWith(ym)&&data.last<monthEnd(ym))};
  });
  const max=Math.max(1,...totals.map(item=>item.total));
  const cols=totals.map(item=>`<button type="button" class="sl-mcol${rg&&rg.key==='m:'+item.ym?' cur':''}" data-sl="month" data-v="${item.ym}" title="Ver ${esc(monthName(item.ym))} día por día"><small class="v">${item.total?short(item.total):'sin monto'}</small><div class="sl-mb${item.partial?' part':''}" style="height:${Math.max(4,Math.round(item.total/max*88))}px"></div><small>${esc(monthShort(item.ym))}${item.partial?' · parcial':''}</small><small class="u">${fmt(item.qty)} unid.</small></button>`).join('');
  return `<div class="sl-card"><h4>Por mes<small>toca un mes para ver sus días</small></h4><div class="sl-months">${cols}</div></div>`;
}
function tableHtml(data,cur,prev,rg){
  const bk=buckets(rg);
  const span=daysBetween(rg.from,rg.to);
  const byCode=new Map(data.products.map(product=>[String(product.code),product]));
  const colorOf=new Map(data.options.map((option,i)=>[option,COLORS[i%COLORS.length]]));
  const prevAmount=new Map((prev?.list||[]).map(item=>[item.code,item.amount]));
  const perCode=new Map();
  data.rows.forEach(row=>{if(row.sold_on>=rg.from&&row.sold_on<=rg.to){const list=perCode.get(String(row.pos_code))||[];list.push(row);perCode.set(String(row.pos_code),list)}});
  const head=`<div class="sl-th"><span>Producto</span><span>Unid.</span><span>Vendido</span><span>${prev?'vs '+esc(rg.prev.label):''}</span><span>Tendencia</span><span class="r">Part.</span></div>`;
  const rows=cur.list.map(item=>{
    const product=byCode.get(item.code);
    const group=data.keyOf(product);
    const color=colorOf.get(group)||COLORS[0];
    const share=cur.amount?item.amount/cur.amount*100:0;
    let tag='';
    if(prev){
      const change=delta(item.amount,prevAmount.get(item.code)||0);
      tag=change===null?'<span class="sl-chip">nuevo</span>':change===0?'<span class="sl-chip">sin cambio</span>':`<span class="sl-chip ${change>0?'up':'dn'}">${change>0?'+':''}${change}%</span>`;
    }
    const trend=sparkline(series(perCode.get(item.code)||[],bk).qty,110,26,color);
    return `<div class="sl-r"><div class="sl-p"><div class="sl-av" style="--c:var(${color})">${esc(group.slice(0,2).toUpperCase())}</div><div><b>${esc(product.name)}</b><small>${esc(product.category||'Sin categoría')} · código ${esc(item.code)}</small></div></div><b class="q" data-one="${item.qty===1?1:0}">${fmt(item.qty)}</b><b class="a">${money(item.amount)}</b><div class="c">${tag}</div><div class="t">${trend}</div><span class="sh">${dec(share)}%</span></div>`;
  }).join('');
  const sold=new Set(cur.list.map(item=>item.code));
  const quiet=data.products.filter(product=>!sold.has(String(product.code)));
  const none=quiet.length?`<details class="sl-fold"><summary>${quiet.length} ${plural(quiet.length,'producto sin ventas','productos sin ventas')} en este período <u>Ver</u></summary><p>${quiet.map(product=>esc(product.name)).join(' · ')}</p></details>`:'';
  return `<div class="sl-card sl-table">${head}${rows}${none}</div>`;
}
function rangeOptions(data,rg){
  const items=[['7','Últimos 7 días'],['30','Últimos 30 días'],...monthsOf(data.rows).map(ym=>['m:'+ym,monthName(ym)[0].toUpperCase()+monthName(ym).slice(1)]),['all','Todo el período']];
  return items.map(([key,label])=>`<option value="${esc(key)}"${rg.key===key?' selected':''}>${esc(label)}</option>`).join('');
}
function render(){
  const root=$('salesRoot');
  if(!root)return;
  const head=`<div class="sl-head"><div><h1>Ventas</h1><p>Lo que vendes por producto, según el POS. El stock está en Inventarios y el control de los vasos en Máquinas de café.</p></div><div class="sl-acts"><button type="button" class="sl-btn ghost" data-act="sales-import">Importar ventas</button></div></div>`;
  if(S.status==='idle'){root.innerHTML=head+'<div class="sl-note">Cargando…</div>';return}
  if(S.status==='unavailable'||S.status==='error'){root.innerHTML=head+`<div class="sl-note">${esc(S.message||'No se pudo cargar.')} <button type="button" class="sl-link" data-sl="reload">Reintentar</button></div>`;return}
  if(S.status==='missing'){root.innerHTML=head+'<div class="sl-note">No encuentro inventarios activos. Créalos en Inventarios para ver sus ventas aquí.</div>';return}
  const tabs=`<div class="sl-tabs top" role="tablist">${visibleTabs().map(tab=>`<button type="button" role="tab" data-sl="tab" data-v="${tab.key}" class="${S.tab===tab.key?'on':''}">${esc(tab.label)}</button>`).join('')}</div>`;
  if(!S.cache[cacheKey(tabDef())]){root.innerHTML=head+`<div class="sl-bar">${tabs}</div><div class="sl-note">Cargando…</div>`;return}
  const data=tabData();
  const rg=ranges(data);
  const cur=aggregate(data.rows,rg.from,rg.to);
  const prev=rg.prev?aggregate(data.rows,rg.prev.from,rg.prev.to):null;
  const best=cur.list[0]?data.products.find(product=>String(product.code)===cur.list[0].code):null;
  const dAmount=prev?delta(cur.amount,prev.amount):null,dQty=prev?delta(cur.qty,prev.qty):null;
  const bk=buckets(rg);
  const trend=sparkline(series(data.rows,bk).amount,120,44,'--blue');
  const kchip=(value,label)=>value===null?'':value===0?'<span class="sl-chip">sin cambio</span>':`<span class="sl-chip ${value>0?'up':'dn'}">${value>0?'+':''}${value}%${label?' vs '+esc(label):''}</span>`;
  const filter=data.options.length>1?`<select data-sl="filter" aria-label="${data.byBrand?'Marca':(tabDef().source==='coffee'?'Máquina':'Categoría')}"><option value="">${data.byBrand?'Todas las marcas':(tabDef().filterLabel||'Todas las categorías')}</option>${data.options.map(option=>`<option value="${esc(option)}"${S.filter===option?' selected':''}>${esc(option)}</option>`).join('')}</select>`:'';
  const bar=`<div class="sl-bar">${tabs}<div class="sl-sel"><select data-sl="range" aria-label="Período">${rangeOptions(data,rg)}</select>${filter}</div></div>`;
  const hint=rg.partial?`<div class="sl-hint">${esc(rg.label[0].toUpperCase()+rg.label.slice(1))} hasta el ${dmy(rg.to)} · comparado con los mismos días de ${esc(rg.prev.label)}</div>`:'';
  const noAmount=tabDef().source==='coffee'?data.rows.filter(row=>row.sold_on>=rg.from&&row.sold_on<=rg.to&&(row.amount===null||row.amount===undefined)).length:0;
  const pending=noAmount?`<div class="sl-hint">${fmt(noAmount)} ${plural(noAmount,'venta de café aún no tiene','ventas de café aún no tienen')} monto ni nombre (se importaron antes). Vuelve a subir el informe del POS con «Importar ventas» para completarlos.</div>`:'';
  const kpis=`<div class="sl-kpis">
    <div class="sl-k big"><span>Vendido · ${esc(rg.label)}</span><div class="row"><div><b>${money(cur.amount)}</b>${kchip(dAmount,rg.prev?.label)}</div>${trend}</div></div>
    <div class="sl-k"><span>Unidades</span><b>${fmt(cur.qty)}</b>${kchip(dQty,'')}</div>
    <div class="sl-k best"><span>El que más vende</span><b>${esc(best?best.name:'—')}</b>${best&&cur.amount?`<span class="sub">${money(cur.list[0].amount)} · ${Math.round(cur.list[0].amount/cur.amount*100)}% del total</span>`:''}</div>
    <div class="sl-k"><span>Con ventas</span><b>${cur.list.length} <small>de ${data.products.length}</small></b><div class="sl-prog"><i style="width:${data.products.length?Math.round(cur.list.length/data.products.length*100):0}%"></i></div></div></div>`;
  let body;
  if(!data.rows.length){
    body=`<div class="sl-note">Aún no hay ventas guardadas de ${esc(tabDef().label.toLowerCase())}. Sube el «Informe de Ventas por Artículos» del POS con «Importar ventas» (arriba) y aparecerán aquí.</div>`;
  }else{
    const months=monthsHtml(data,rg);
    body=`<div class="sl-two${months?'':' one'}">${chartHtml(data,rg)}${months}</div>`+(cur.list.length?tableHtml(data,cur,prev,rg):'<div class="sl-note">No hay ventas en este período.</div>');
  }
  root.innerHTML=head+bar+hint+pending+kpis+body;
}

/* --------------------------------------------------------------- eventos */
function onClick(event){
  const target=event.target.closest('[data-sl]');
  if(!target)return;
  const action=target.dataset.sl;
  if(action==='tab'){S.tab=target.dataset.v;S.filter='';S.range=null;S.sel=null;load();return}
  if(action==='bar'){S.sel=Number(target.dataset.i);render();return}
  if(action==='month'){S.range='m:'+target.dataset.v;S.sel=null;render();return}
  if(action==='reload')load(true);
}
function onChange(event){
  const target=event.target.closest('[data-sl]');
  if(!target)return;
  if(target.dataset.sl==='range'){S.range=target.value;S.sel=null;render()}
  if(target.dataset.sl==='filter'){S.filter=target.value;S.sel=null;render()}
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
