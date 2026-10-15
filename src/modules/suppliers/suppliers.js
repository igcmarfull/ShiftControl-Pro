(function(){
'use strict';

// Proveedores de la empresa (tabla public.suppliers). Acceso al servidor:
//   lectura  -> select con RLS (cualquier miembro activo; la jefa los usa para elegir en facturas)
//   escritura -> funciones supplier_save / supplier_set_active / supplier_set_logo / supplier_import
// No guarda nada en app_state ni en localStorage. Si la migración no está aplicada,
// status queda en 'unavailable' y el resto de la app sigue funcionando como siempre.

const BUCKET='shiftcontrol-supplier-logos';
const URL_TTL=3600;

const MESSAGES={
  forbidden:'No tienes permiso para esta acción.',
  not_found:'El proveedor ya no existe. Actualiza la pantalla.',
  version_conflict:'Otra persona modificó este proveedor. Se cargó la versión actual.',
  duplicate_rut:'Ya existe un proveedor con ese RUT.',
  duplicate_name:'Ya existe un proveedor con ese nombre.',
  name_required:'El proveedor necesita un nombre.',
  invalid_email:'El correo no es válido.',
  invalid_credit:'Los días de crédito deben estar entre 0 y 365.',
  invalid_logo:'El logo no pertenece a este proveedor.'
};

class SupplierError extends Error{
  constructor(info){
    super(info.message);
    this.name='SupplierError';
    this.code=info.code;
    this.unavailable=Boolean(info.unavailable);
    this.network=Boolean(info.network);
  }
}

const S={status:'idle',list:[],companyId:null,loadedAt:0,promise:null};
const urls={};
const pendingUrls=new Set();
let urlTimer=null;

function client(){
  const supabase=window.ShiftControlAuth?.getClient?.();
  if(!supabase)throw new SupplierError({code:'no_client',message:'No hay sesión activa.'});
  return supabase;
}
function companyId(){
  return window.AuthContext?.get?.()?.companyId||null;
}
function classify(error){
  if(error instanceof SupplierError)return error;
  const raw=String(error?.message||'');
  if(raw.startsWith('sup:')){
    const code=raw.slice(4);
    return new SupplierError({code,message:error.hint||MESSAGES[code]||'No se pudo completar la operación.'});
  }
  if(error?.code==='PGRST202'||error?.code==='PGRST205'||error?.code==='42P01'||error?.code==='42883'){
    return new SupplierError({code:'unavailable',unavailable:true,message:'Los proveedores todavía no están habilitados en el servidor.'});
  }
  if(/Failed to fetch|NetworkError|Load failed/i.test(raw)||(typeof navigator!=='undefined'&&navigator.onLine===false)){
    return new SupplierError({code:'network',network:true,message:'Sin conexión. Revisa tu internet e inténtalo de nuevo.'});
  }
  return new SupplierError({code:error?.code||'error',message:raw||'No se pudo completar la operación.'});
}
async function rpc(name,args){
  let response;
  try{response=await client().rpc(name,args||{})}
  catch(error){throw classify(error)}
  if(response.error)throw classify(response.error);
  return response.data;
}

/* ------------------------------------------------------------------ lectura */
function notify(){
  try{window.dispatchEvent(new CustomEvent('suppliers:changed'))}catch(_error){}
}
async function load({force=false}={}){
  const company=companyId();
  if(!company){S.status='idle';return S.list}
  if(!force&&S.status==='ready'&&S.companyId===company&&Date.now()-S.loadedAt<60000)return S.list;
  if(S.promise)return S.promise;
  S.promise=(async()=>{
    try{
      if(S.status!=='ready')S.status='loading';
      const response=await client().from('suppliers').select('*').eq('company_id',company).order('name');
      if(response.error)throw classify(response.error);
      S.list=Array.isArray(response.data)?response.data:[];
      S.companyId=company;
      S.status='ready';
      S.loadedAt=Date.now();
    }catch(error){
      const info=classify(error);
      S.status=info.unavailable?'unavailable':'error';
      S.error=info;
      if(info.unavailable)S.list=[];
    }finally{
      S.promise=null;
      notify();
    }
    return S.list;
  })();
  return S.promise;
}

/* ----------------------------------------------------------------- escritura */
function upsertLocal(row){
  if(!row||!row.id)return row;
  const index=S.list.findIndex(item=>item.id===row.id);
  if(index>=0)S.list[index]=row;
  else S.list.push(row);
  S.list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  notify();
  return row;
}
async function save(fields){
  const company=companyId();
  const row=await rpc('supplier_save',{p_company_id:company,p_supplier:fields});
  return upsertLocal(row);
}
async function setActive(id,active,version){
  return upsertLocal(await rpc('supplier_set_active',{p_supplier_id:id,p_active:active,p_expected_version:version}));
}
async function setLogo(id,path,version){
  return upsertLocal(await rpc('supplier_set_logo',{p_supplier_id:id,p_logo_path:path||null,p_expected_version:version}));
}
async function importMany(items){
  const result=await rpc('supplier_import',{p_company_id:companyId(),p_items:items});
  await load({force:true});
  return result;
}
async function uploadLogo(supplier,blob){
  const ext=blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':'webp';
  const uuid=typeof window.safeRandomUUID==='function'?window.safeRandomUUID():String(Date.now());
  const path=`${supplier.company_id}/${supplier.id}/${uuid}.${ext}`;
  let response;
  try{response=await client().storage.from(BUCKET).upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false})}
  catch(error){throw classify(error)}
  if(response.error){
    const raw=String(response.error.message||'');
    throw new SupplierError({code:'upload',message:/row-level security|policy/i.test(raw)?'No tienes permiso para cambiar logos.':'No se pudo subir el logo.'});
  }
  return path;
}
function removeLogoFiles(paths){
  const list=(paths||[]).filter(Boolean);
  if(!list.length)return;
  try{client().storage.from(BUCKET).remove(list)}catch(_error){}
}

/* ------------------------------------------------------------ logos (URLs) */
function logoUrl(path){
  if(!path)return null;
  const hit=urls[path];
  if(hit&&hit.exp>Date.now())return hit.url;
  queueUrl(path);
  return hit?hit.url:null;
}
function queueUrl(path){
  if(pendingUrls.has(path))return;
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
    try{window.dispatchEvent(new CustomEvent('suppliers:logos'))}catch(_error){}
  },60);
}

/* ------------------------------------------------- relación con las facturas */
const norm=text=>String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
function rutKey(text){
  const key=String(text||'').replace(/[^0-9kK]/g,'').toLowerCase();
  return key.length>=7?key:'';
}
// Busca el proveedor de una factura: por id guardado, por RUT y, al final, por nombre.
function forInvoice(invoice){
  if(!invoice)return null;
  if(invoice.supplierId){
    const direct=S.list.find(item=>item.id===invoice.supplierId);
    if(direct)return direct;
  }
  const key=rutKey(invoice.rutProveedor);
  if(key){
    const byRut=S.list.find(item=>item.rut_key===key);
    if(byRut)return byRut;
  }
  const name=norm(invoice.proveedor);
  return name?(S.list.find(item=>norm(item.name)===name)||null):null;
}
function invoicesOf(supplier){
  const all=window.InvoiceModule?.getAll?.()||[];
  return all.filter(invoice=>forInvoice(invoice)?.id===supplier.id);
}

window.SupplierModule={
  SupplierError,
  state:S,
  load,
  save,
  setActive,
  setLogo,
  importMany,
  uploadLogo,
  removeLogoFiles,
  logoUrl,
  forInvoice,
  invoicesOf,
  rutKey,
  norm,
  list:()=>S.list,
  active:()=>S.list.filter(item=>item.active),
  get:id=>S.list.find(item=>item.id===id)||null,
  isReady:()=>S.status==='ready',
  isAvailable:()=>S.status!=='unavailable'
};
})();
