/* Pasar a stock las líneas de una factura leída desde PDF.
   Cada línea se empareja con un producto de Inventarios (código recordado o
   sugerencia por nombre que la persona confirma) y se registra con la
   recepción de Inventarios (inv_receive), que evita duplicar la factura. */
(function(){
'use strict';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const A=()=>window.InventoryApi;
const client=()=>window.ShiftControlAuth?.getClient?.();
const companyId=()=>window.AuthContext?.get?.()?.companyId||null;
const fmt=n=>Number(n||0).toLocaleString('es-CL');
const money=n=>`$${fmt(n)}`;

/* ------------------------------------------------- emparejar por nombre */
const SYN=[[/\bls\b/g,'lucky strike'],[/\blucky\b(?!\s+strike)/g,'lucky strike'],[/\bclic\b/g,'click'],[/\bblu\b/g,'blue'],
  [/sinaditivos?/g,'sin aditivos'],[/\bsin aditivo\b/g,'sin aditivos']];
function tokens(text){
  let s=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  s=s.replace(/^\s*\d{3,4}\s+/,'');
  s=s.replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([a-z])/g,(m,d,l)=>l==='s'?d:`${d} ${l}`);
  s=s.replace(/[^a-z0-9 ]/g,' ');
  SYN.forEach(([re,to])=>{s=s.replace(re,to)});
  const drop=new Set(['ds90','lep','s','cajetilla','cigarrillos']);
  return new Set(s.split(/\s+/).filter(word=>word&&!drop.has(word)));
}
const SIZES=new Set(['10','18','20']);
function score(a,b){
  const A1=tokens(a),B1=tokens(b);
  // Cajetillas de 10, 18 o 20 son productos distintos: si ambos nombres dicen el tamaño y no coincide, no es el mismo.
  const sizeA=[...A1].filter(word=>SIZES.has(word));
  const sizeB=[...B1].filter(word=>SIZES.has(word));
  if(sizeA.length&&sizeB.length&&!sizeA.some(word=>sizeB.includes(word)))return 0;
  let both=0;A1.forEach(word=>{if(B1.has(word))both++});
  const union=A1.size+B1.size-both;
  return union?both/union:0;
}
// Devuelve {product, score} solo si la sugerencia es clara frente a la segunda mejor.
function suggest(name,products){
  const ranked=products.map(product=>({product,score:score(name,product.name)})).sort((x,y)=>y.score-x.score);
  const best=ranked[0],second=ranked[1];
  if(!best||best.score<0.6)return null;
  if(second&&best.score-second.score<0.1)return null;
  return best;
}

/* -------------------------------------------------------------- datos */
const S={open:false,busy:false,supplier:null,parsed:null,rows:[],products:[],inventories:[],requestIds:{},message:'',done:null,create:null};
const isAdmin=()=>(typeof window.getAppRole==='function'?window.getAppRole():'')==='admin';

async function loadProducts(){
  const overview=await A().overview(companyId());
  S.inventories=(overview?.inventories||[]).filter(inv=>inv.active);
  const lists=await Promise.all(S.inventories.map(inv=>A().products(inv.id).then(rows=>(rows||[]).map(row=>({...row,inventory_id:inv.id,inventory:inv.code})))));
  S.products=lists.flat().filter(product=>product.active);
}
async function loadCodes(supplierId){
  const response=await client().from('supplier_product_codes').select('supplier_code, product_id').eq('supplier_id',supplierId);
  if(response.error)throw response.error;
  return new Map((response.data||[]).map(row=>[row.supplier_code,row.product_id]));
}
async function saveCodes(supplierId,items){
  if(!items.length)return;
  const response=await client().rpc('supplier_codes_save',{p_company_id:companyId(),p_supplier_id:supplierId,p_items:items});
  if(response.error)throw response.error;
}

function buildRows(parsed,codes){
  return parsed.lines.map((line,index)=>{
    let product=null,state='none';
    if(line.code&&codes.has(line.code)){
      product=S.products.find(item=>item.id===codes.get(line.code))||null;
      if(product)state='saved';
    }
    if(!product){
      const hit=suggest(line.name,S.products);
      if(hit){product=hit.product;state='ask'}
    }
    return {index,line,productId:product?product.id:'',state,skip:false};
  });
}
const productOf=row=>S.products.find(item=>item.id===row.productId)||null;
function problem(row){
  const product=productOf(row);
  if(row.skip)return '';
  if(!product)return 'Falta elegir el producto.';
  if(row.state==='ask')return 'Confirma que es este producto.';
  if(!row.line.qty||row.line.qty<=0)return 'La cantidad no es válida.';
  if(!product.receive_unit)return 'Este producto no tiene unidad de recepción (cartón). Configúrala en Inventarios.';
  if(product.tracks_expiry)return 'Este producto necesita fecha de vencimiento: recíbelo desde Inventarios.';
  return '';
}
const ready=row=>!row.skip&&!problem(row);
function entering(row){
  const product=productOf(row);
  return product&&product.receive_unit?row.line.qty*product.receive_factor:0;
}

/* -------------------------------------------------------------- pantalla */
function root(){
  let element=document.getElementById('invoiceStockRoot');
  if(!element){element=document.createElement('div');element.id='invoiceStockRoot';document.body.appendChild(element)}
  return element;
}
function optionsFor(row){
  const groups=S.inventories.map(inv=>{
    const items=S.products.filter(product=>product.inventory_id===inv.id).sort((x,y)=>String(x.name).localeCompare(String(y.name),'es'));
    return `<optgroup label="${esc(inv.name)}">${items.map(product=>`<option value="${esc(product.id)}"${product.id===row.productId?' selected':''}>${esc(product.name)} · ${esc(product.code)}</option>`).join('')}</optgroup>`;
  }).join('');
  return `<option value="">Elegir producto…</option>${groups}`;
}
function rowHtml(row){
  const product=productOf(row);
  const msg=problem(row);
  const cls=row.skip?'skip':row.state==='saved'&&!msg?'ok':row.state==='ask'||msg?'ask':'no';
  const label=row.skip?'No se suma':!product?'Falta':row.state==='ask'?'Confirmar':msg?'Revisar':'Listo';
  const qty=product&&product.receive_unit?`<b>${fmt(row.line.qty)} ${esc(product.receive_unit)}${row.line.qty===1?'':'es'}</b><small>= ${fmt(entering(row))} ${esc(product.control_unit||'unidades')}</small>`:`<b>${fmt(row.line.qty)}</b><small>de la factura</small>`;
  const create=(!product&&!row.skip)?(isAdmin()?`<small><button type="button" class="is-link" data-is="new" data-i="${row.index}">＋ Crear producto nuevo</button></small>`:'<small>Pide al administrador que cree el producto.</small>'):'';
  const confirm=row.state==='ask'&&product&&!row.skip?`<button type="button" class="is-confirm" data-is="ok" data-i="${row.index}">Confirmar</button>`:'';
  const form=S.create&&S.create.index===row.index?createForm(row):'';
  return `<div class="is-r ${cls}"><div><b>${esc(row.line.name||'Sin nombre')}</b><small>${row.line.code?`Código ${esc(row.line.code)} · `:''}${money(row.line.amount)}</small></div>
  <div><select class="is-sel" data-is="pick" data-i="${row.index}" ${row.skip?'disabled':''}>${optionsFor(row)}</select>${create}${msg&&product?`<small class="is-warn">${esc(msg)}</small>`:''}${form}</div>
  <div class="is-q">${qty}</div><div class="is-s"><span class="is-st ${cls}">${label}</span>${confirm}<label class="is-skip"><input type="checkbox" data-is="skip" data-i="${row.index}" ${row.skip?'checked':''}> No sumar</label></div></div>`;
}
function createForm(row){
  const c=S.create;
  return `<div class="is-new"><label>Nombre<input id="isNewName" value="${esc(c.name)}"></label><label>Código del POS<input id="isNewCode" value="${esc(c.code)}" placeholder="Ej: 213059"></label>
  <label>Inventario<select id="isNewInv">${S.inventories.map(inv=>`<option value="${esc(inv.id)}"${inv.id===c.inventoryId?' selected':''}>${esc(inv.name)}</option>`).join('')}</select></label>
  <div class="is-new-a"><button type="button" class="is-b" data-is="new-x">Cancelar</button><button type="button" class="is-b pri" data-is="new-ok">Crear y usar</button></div><small id="isNewErr" class="is-warn"></small></div>`;
}
function render(){
  if(!S.open){root().innerHTML='';return}
  const rows=S.rows;
  const okCount=rows.filter(ready).length;
  const total=rows.filter(ready).reduce((sum,row)=>sum+entering(row),0);
  const ask=rows.filter(row=>!row.skip&&row.state==='ask'&&productOf(row)).length;
  const missing=rows.filter(row=>!row.skip&&!productOf(row)).length;
  const saved=rows.filter(row=>!row.skip&&row.state==='saved'&&!problem(row)).length;
  const parsed=S.parsed;
  if(S.done){
    root().innerHTML=`<div class="is-ov"><div class="is-m"><h3>Stock actualizado</h3><p class="is-sub">${esc(S.done)}</p><div class="is-f"><span></span><button type="button" class="is-b pri" data-is="close">Listo</button></div></div></div>`;
    return;
  }
  root().innerHTML=`<div class="is-ov" data-is="bg"><div class="is-m" role="dialog" aria-label="Pasar la factura a stock"><h3>Pasar la factura a stock</h3>
  <p class="is-sub">${esc(S.supplier?.name||parsed.supplierName)} · N° ${esc(parsed.folio)} · ${rows.length} línea${rows.length===1?'':'s'}</p>
  <div class="is-sum"><span class="g">● ${saved} recordadas</span><span class="o">● ${ask} por confirmar${ask?' <button type="button" class="is-link" data-is="ok-all">Confirmar todas</button>':''}</span><span class="r">● ${missing} sin producto</span><span>Entra al stock: <b>${fmt(total)}</b> unidades</span></div>
  <div class="is-t"><div class="is-h"><span>En la factura</span><span>Producto en tu inventario</span><span>Entra al stock</span><span>Estado</span></div>${rows.map(rowHtml).join('')}</div>
  ${S.message?`<p class="is-err">${esc(S.message)}</p>`:''}
  <div class="is-f"><p>La primera vez confirmas cada producto y la app lo recuerda para las próximas facturas de este proveedor. Las líneas sin resolver no suman stock.</p>
  <div class="is-fa"><button type="button" class="is-b" data-is="close">Ahora no</button><button type="button" class="is-b pri" data-is="commit" ${okCount&&!S.busy?'':'disabled'}>${S.busy?'Sumando…':`Sumar ${okCount} producto${okCount===1?'':'s'} al stock`}</button></div></div></div></div>`;
}

/* ------------------------------------------------------------ acciones */
function today(){
  const d=new Date();const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
async function commit(){
  if(S.busy)return;
  const rows=S.rows.filter(ready);
  if(!rows.length)return;
  S.busy=true;S.message='';render();
  const byInventory=new Map();
  rows.forEach(row=>{
    const product=productOf(row);
    if(!byInventory.has(product.inventory_id))byInventory.set(product.inventory_id,new Map());
    const lines=byInventory.get(product.inventory_id);
    lines.set(product.id,(lines.get(product.id)||0)+row.line.qty);
  });
  const header={
    supplier:S.supplier.name,
    document_no:S.parsed.folio,
    received_on:S.parsed.issueDate&&S.parsed.issueDate<=today()?S.parsed.issueDate:today(),
    notes:'Desde factura PDF'
  };
  const done=[];
  try{
    for(const [inventoryId,lines] of byInventory){
      // Un identificador por inventario y por apertura de esta pantalla: un reintento no duplica.
      const key=inventoryId;
      if(!S.requestIds[key])S.requestIds[key]=A().uuid();
      await A().receive(S.requestIds[key],inventoryId,header,[...lines].map(([productId,qty])=>({product_id:productId,qty,unit:'purchase'})));
      done.push(inventoryId);
    }
  }catch(error){
    S.busy=false;
    S.message=done.length
      ?`Se sumó el stock de ${done.length} inventario(s), pero falló otro: ${error.message||'error'}. Revisa Inventarios antes de reintentar.`
      :(error.message||'No se pudo sumar el stock.');
    render();
    return;
  }
  let note='';
  try{
    await saveCodes(S.supplier.id,rows.filter(row=>row.line.code).map(row=>({code:row.line.code,product_id:row.productId})));
  }catch(_error){note=' No se pudieron recordar los códigos; la próxima vez tendrás que confirmarlos otra vez.'}
  const units=rows.reduce((sum,row)=>sum+entering(row),0);
  S.busy=false;
  S.done=`Se sumaron ${rows.length} producto${rows.length===1?'':'s'} (${fmt(units)} unidades) de la factura N° ${S.parsed.folio}.${note}`;
  try{window.dispatchEvent(new CustomEvent('inventory:changed'))}catch(_error){}
  render();
}
function cleanName(name){
  return String(name||'').replace(/^\s*\d{3,4}\s+/,'').replace(/\bLS\b/g,'Lucky Strike').replace(/\s+/g,' ').trim();
}
async function createProduct(){
  const c=S.create;
  const name=document.getElementById('isNewName').value.trim();
  const code=document.getElementById('isNewCode').value.trim();
  const inventoryId=document.getElementById('isNewInv').value;
  const error=document.getElementById('isNewErr');
  if(!name||!code){error.textContent='Indica el nombre y el código.';return}
  const inventory=S.inventories.find(inv=>inv.id===inventoryId);
  const isCig=inventory&&inventory.code==='cigarrillos';
  try{
    const product=await A().saveProduct(inventoryId,{
      code,name,control_unit:isCig?'cajetilla':(inventory?.control_unit||'unidad'),
      ...(isCig?{category:'Cigarrillos',receive_unit:'cartón',receive_factor:10,presentation:'Cajetilla 20'}:{})
    });
    S.products.push({...product,inventory_id:inventoryId,inventory:inventory?.code,stock:0});
    const row=S.rows[c.index];
    row.productId=product.id;row.state='ask';
    S.create=null;
    render();
  }catch(err){error.textContent=err.message||'No se pudo crear el producto.'}
}

function onClick(event){
  const target=event.target.closest('[data-is]');
  if(!target||!S.open)return;
  const action=target.dataset.is;
  const row=S.rows[Number(target.dataset.i)];
  if(action==='bg'){if(event.target===target)close();return}
  if(action==='close')return close();
  if(action==='ok-all'){S.rows.forEach(item=>{if(!item.skip&&item.state==='ask'&&productOf(item))item.state='saved'});render();return}
  if(action==='commit')return commit();
  if(action==='ok'&&row){row.state='saved';render();return}
  if(action==='new'&&row){
    const hint=S.products.find(product=>product.inventory==='cigarrillos');
    S.create={index:row.index,name:cleanName(row.line.name),code:'',inventoryId:(hint||S.inventories[0]||{}).inventory_id||(S.inventories[0]||{}).id};
    render();return;
  }
  if(action==='new-x'){S.create=null;render();return}
  if(action==='new-ok')return createProduct();
}
function onChange(event){
  const target=event.target.closest('[data-is]');
  if(!target||!S.open)return;
  const row=S.rows[Number(target.dataset.i)];
  if(!row)return;
  if(target.dataset.is==='pick'){row.productId=target.value;row.state=target.value?'ask':'none';
    // Elegir a mano ya es confirmar.
    if(target.value)row.state='saved';render()}
  if(target.dataset.is==='skip'){row.skip=target.checked;render()}
}
function close(){S.open=false;S.done=null;S.create=null;render()}

async function open(parsed,supplier){
  if(!A()||!companyId()){alert('Inventarios no está disponible.');return}
  if(!supplier){alert('Registra primero el proveedor para poder recordar sus productos.');return}
  S.open=true;S.busy=false;S.done=null;S.message='';S.create=null;S.requestIds={};S.supplier=supplier;S.parsed=parsed;S.rows=[];
  root().innerHTML='<div class="is-ov"><div class="is-m"><h3>Pasar la factura a stock</h3><p class="is-sub">Cargando productos…</p></div></div>';
  try{
    await loadProducts();
    let codes=new Map();
    try{codes=await loadCodes(supplier.id)}catch(_error){}
    S.rows=buildRows(parsed,codes);
    render();
  }catch(error){
    S.open=false;
    root().innerHTML='';
    alert(error?.message||'No se pudieron cargar los productos de Inventarios.');
  }
}

document.addEventListener('click',onClick);
document.addEventListener('change',onChange);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&S.open&&!S.busy)close()});

window.InvoiceStock={open,suggest,score,tokens,state:S};
})();
