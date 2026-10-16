(function(){
'use strict';

// Pantalla «Ventas de lubricantes»: cuánto se vende del inventario Lubricantes, día a día. Los datos
// vienen de sales_history, que llena la importación de ventas del POS (Inventarios). No toca el stock.

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Math.round(Number(n||0)).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const dec=n=>(Math.round(n*10)/10).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const A=()=>window.InventoryApi;
const PAGE=1000;
const PERIODS=[['7','7 días'],['30','30 días'],['all','Todo el período']];

const S={status:'idle',inventory:null,products:[],sales:[],cat:'',period:'all',loading:false,message:''};

const dmy=iso=>String(iso||'').split('-').reverse().slice(0,2).join('-');
const isoOf=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return isoOf(d)};
const daysBetween=(from,to)=>Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/864e5)+1;

/* ---------------------------------------------------------------- datos */
function toError(error){
  if(error?.code==='PGRST205'||error?.code==='42P01'){const err=new Error('Las ventas de lubricantes todavía no están habilitadas en el servidor.');err.code='unavailable';return err}
  if(/Failed to fetch|NetworkError|Load failed/i.test(String(error?.message||''))||navigator.onLine===false){const err=new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');err.code='network';return err}
  return error instanceof Error?error:new Error(error?.message||'No se pudo cargar la información.');
}
async function load(){
  const company=companyId();
  if(!company||!A()){S.status='idle';return}
  S.loading=true;S.message='';render();
  try{
    const overview=await A().overview(company);
    const inv=(overview?.inventories||[]).find(item=>item.active&&(item.code==='lubricantes'||/^lubricantes$/i.test(String(item.name||'').trim())));
    if(!inv){S.status='missing';S.inventory=null;S.products=[];S.sales=[];return}
    S.inventory=inv;
    S.products=((await A().products(inv.id))||[]).filter(product=>product.active);
    const rows=[];
    for(let from=0;;from+=PAGE){
      const response=await client().from('sales_history').select('sold_on, pos_code, qty, amount').eq('company_id',company).eq('inventory_id',inv.id).order('sold_on',{ascending:true}).range(from,from+PAGE-1);
      if(response.error)throw toError(response.error);
      rows.push(...(response.data||[]));
      if((response.data||[]).length<PAGE)break;
    }
    S.sales=rows;
    S.status='ready';
  }catch(error){
    const err=toError(error);
    S.status=err.code==='unavailable'?'unavailable':'error';
    S.message=err.message;
  }finally{S.loading=false;render()}
}

/* --------------------------------------------------------------- cálculo */
function scope(){
  const byCode=new Map(S.products.map(product=>[String(product.code),product]));
  const cats=[...new Set(S.products.map(product=>product.category||'Sin categoría'))].sort((a,b)=>a.localeCompare(b,'es'));
  let rows=S.sales.filter(row=>byCode.has(String(row.pos_code)));
  if(S.cat)rows=rows.filter(row=>(byCode.get(String(row.pos_code)).category||'Sin categoría')===S.cat);
  const last=S.sales.length?S.sales[S.sales.length-1].sold_on:null;
  let from=null;
  if(S.period!=='all'&&last)from=addDays(last,-(Number(S.period)-1));
  if(from)rows=rows.filter(row=>row.sold_on>=from);
  return {rows,byCode,cats,from,last};
}
function summarize(){
  const sc=scope();
  const first=sc.rows.length?sc.rows[0].sold_on:null;
  const span=first&&sc.last?daysBetween(sc.from||first,sc.last):0;
  const perProduct=new Map();
  sc.rows.forEach(row=>{
    const entry=perProduct.get(row.pos_code)||{code:row.pos_code,qty:0,amount:0,days:new Set()};
    entry.qty+=row.qty;entry.amount+=Number(row.amount||0);entry.days.add(row.sold_on);
    perProduct.set(row.pos_code,entry);
  });
  const list=[...perProduct.values()].sort((a,b)=>b.amount-a.amount||b.qty-a.qty);
  const total={qty:list.reduce((sum,item)=>sum+item.qty,0),amount:list.reduce((sum,item)=>sum+item.amount,0)};
  return {sc,list,total,span,first};
}

/* --------------------------------------------------------------- dibujo */
function chartHtml(sum){
  const {sc,span,total}=sum;
  if(!sc.rows.length||span<2)return '';
  const start=sc.from||sum.first;
  const daily=new Map();
  sc.rows.forEach(row=>daily.set(row.sold_on,(daily.get(row.sold_on)||0)+Number(row.amount||0)));
  const weekly=span>62;
  const buckets=[];
  if(weekly){
    for(let from=start;from<=sc.last;from=addDays(from,7)){
      let value=0;for(let i=0;i<7;i++){value+=daily.get(addDays(from,i))||0}
      buckets.push([from,value,`semana del ${dmy(from)}`]);
    }
  }else{
    for(let day=start;day<=sc.last;day=addDays(day,1))buckets.push([day,daily.get(day)||0,dmy(day)]);
  }
  const W=900,H=190,L=50,R=10,T=14,B=28;
  const max=Math.max(1,...buckets.map(item=>item[1]));
  const slot=(W-L-R)/buckets.length,bw=Math.max(4,Math.min(28,slot*.62));
  const every=Math.ceil(buckets.length/10);
  const base=H-B;
  const bars=buckets.map(([day,value,label],index)=>{
    const h=(H-T-B)*value/max,cx=L+slot*index+slot/2;
    const tick=index%every===0?`<text x="${cx}" y="${H-9}" text-anchor="middle" class="ls-cx">${dmy(day)}</text>`:'';
    return `<g><rect x="${cx-slot/2}" y="${T}" width="${slot}" height="${H-T-B}" fill="transparent"><title>${esc(label)}: ${money(value)}</title></rect><rect x="${cx-bw/2}" y="${base-h}" width="${bw}" height="${value?Math.max(2,h):0}" rx="3" class="ls-bar"><title>${esc(label)}: ${money(value)}</title></rect>${tick}</g>`;
  }).join('');
  const grid=[0,.5,1].map(f=>{const y=base-(H-T-B)*f;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" class="ls-grid${f?' soft':''}"/><text x="${L-6}" y="${y+4}" text-anchor="end" class="ls-cx">${f?(max*f>=10000?'$'+fmt(max*f/1000)+' mil':money(max*f)):'0'}</text>`}).join('');
  return `<div class="ls-chart"><div class="ls-chart-h"><b>${weekly?'Venta por semana ($)':'Venta por día ($)'}</b><span>${dmy(start)} al ${dmy(sc.last)}</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Venta en pesos por ${weekly?'semana':'día'}">${grid}${bars}</svg></div>`;
}
function tableHtml(sum){
  const {list,total,span,sc}=sum;
  const head='<div class="ls-th"><span>Producto</span><span>Unid.</span><span>Vendido</span><span>Días</span><span>Por semana</span><span>Participación</span></div>';
  const top=list[0]?.amount||0;
  const rows=list.map(item=>{
    const product=sc.byCode.get(String(item.code));
    const share=total.amount?item.amount/total.amount*100:0;
    return `<div class="ls-r"><div><b>${esc(product.name)}</b><small>${esc(product.category||'Sin categoría')} · código ${esc(item.code)}</small></div><b data-l="Unid.">${fmt(item.qty)}</b><b data-l="Vendido">${money(item.amount)}</b><b data-l="Días">${item.days.size}</b><b data-l="Por semana">${span?dec(item.qty/span*7):'—'}</b><div data-l="Participación"><div class="ls-meter"><i style="width:${top?Math.round(item.amount/top*100):0}%"></i></div><small>${dec(share)}% del total</small></div></div>`;
  }).join('');
  const sold=new Set(list.map(item=>String(item.code)));
  const quiet=S.products.filter(product=>!sold.has(String(product.code)));
  const none=quiet.length?`<div class="ls-note">Sin ventas en este período: ${quiet.map(product=>esc(product.name)).join(' · ')}.</div>`:'';
  return head+rows+none;
}
function render(){
  const root=$('lubricantsRoot');
  if(!root)return;
  const head=`<div class="ls-head"><div><h1>Ventas de lubricantes</h1><p>Lo que vendes del inventario Lubricantes, día a día, según el POS.</p></div><div class="ls-acts"><button type="button" class="ls-btn ghost" data-act="sales-import">Importar ventas</button></div></div>`;
  if(S.status==='idle'||(S.loading&&S.status==='idle')){root.innerHTML=head+'<div class="ls-note">Cargando…</div>';return}
  if(S.status==='unavailable'||S.status==='error'){root.innerHTML=head+`<div class="ls-note">${esc(S.message||'No se pudo cargar.')} <button type="button" class="ls-link" data-ls="reload">Reintentar</button></div>`;return}
  if(S.status==='missing'){root.innerHTML=head+'<div class="ls-note">No encuentro el inventario «Lubricantes». Créalo en Inventarios para ver sus ventas aquí.</div>';return}
  const sum=summarize();
  const best=sum.list[0];
  const bestName=best?S.products.find(product=>String(product.code)===String(best.code))?.name:'—';
  const kpis=`<div class="ls-kpis">
    <div class="ls-kpi" style="--c:var(--blue)"><i>$</i><div><b>${money(sum.total.amount)}</b><span>Vendido en el período</span></div></div>
    <div class="ls-kpi" style="--c:var(--green)"><i>#</i><div><b>${fmt(sum.total.qty)}</b><span>Unidades vendidas</span></div></div>
    <div class="ls-kpi" style="--c:var(--orange)"><i>★</i><div><b class="sm">${esc(bestName)}</b><span>El que más vende ($)</span></div></div>
    <div class="ls-kpi" style="--c:var(--red)"><i>▤</i><div><b>${sum.list.length} de ${S.products.length}</b><span>Productos con ventas</span></div></div></div>`;
  const cats=['',...sum.sc.cats];
  const tabs=`<div class="ls-tabs">${cats.map(cat=>`<button type="button" data-ls="cat" data-v="${esc(cat)}" class="${S.cat===cat?'on':''}">${cat?esc(cat):'Todos'}</button>`).join('')}</div>`;
  const per=`<div class="ls-per">${PERIODS.map(([key,label])=>`<button type="button" data-ls="period" data-v="${key}" class="${S.period===key?'on':''}">${label}</button>`).join('')}</div>`;
  const body=S.sales.length
    ?chartHtml(sum)+(sum.list.length?tableHtml(sum):'<div class="ls-note">No hay ventas en este período.</div>')
    :'<div class="ls-note">Aún no hay ventas guardadas. Sube el «Informe de Ventas por Artículos» del POS con «Importar ventas» (arriba) y aparecerán aquí.</div>';
  root.innerHTML=head+kpis+`<div class="ls-card"><div class="ls-bar-top">${tabs}${per}</div>${body}</div>`;
}

function onClick(event){
  const target=event.target.closest('[data-ls]');
  if(!target)return;
  const action=target.dataset.ls;
  if(action==='cat'){S.cat=target.dataset.v||'';render();return}
  if(action==='period'){S.period=target.dataset.v;render();return}
  if(action==='reload')load();
}
function init(){
  const section=$('lubricants');
  if(!section||section.dataset.lsReady)return;
  section.dataset.lsReady='1';
  let root=$('lubricantsRoot');
  if(!root){root=document.createElement('div');root.id='lubricantsRoot';section.appendChild(root)}
  root.classList.add('ls-root');
  document.addEventListener('click',event=>{if(event.target.closest('#lubricants'))onClick(event)});
  window.addEventListener('inventory:changed',()=>{if(section.classList.contains('active'))load()});
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was){render();load()}
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.LubricantSales={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
