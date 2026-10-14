(function(){
'use strict';

// Acceso al servidor para Inventarios. Todas las operaciones son funciones de
// Supabase (RPC); el stock lo calcula y valida el servidor. Este archivo no
// guarda nada en app_state ni en localStorage.

const MESSAGES={
  forbidden:'No tienes permiso para esta acción.',
  not_found:'El registro ya no existe. Actualiza la pantalla.',
  insufficient_stock:'No hay stock suficiente para este movimiento.',
  duplicate_code:'Ese código ya existe en este inventario.',
  duplicate_barcode:'Ese código de barras ya existe en este inventario.',
  duplicate_receipt:'Esa factura de ese proveedor ya fue recibida.',
  version_conflict:'Otra persona modificó este registro. Se cargó la versión actual.',
  note_required:'Falta una observación obligatoria.',
  already_reviewed:'Este ajuste ya fue revisado por otra persona.',
  already_reversed:'Este movimiento ya fue corregido.',
  count_closed:'Este conteo ya fue enviado.',
  request_reuse:'La operación ya se había usado. Vuelve a intentarlo.',
  has_stock:'No se puede desactivar un producto con stock.'
};

class InventoryError extends Error{
  constructor(info){
    super(info.message);
    this.name='InventoryError';
    this.code=info.code;
    this.detail=info.detail||null;
    this.network=Boolean(info.network);
    this.unavailable=Boolean(info.unavailable);
  }
}

function parseDetail(value){
  if(!value)return null;
  if(typeof value==='object')return value;
  try{return JSON.parse(value)}catch(_error){return null}
}

// Convierte cualquier fallo en un InventoryError con un mensaje en español.
function classify(error){
  if(error instanceof InventoryError)return error;
  const raw=String(error?.message||'');

  if(raw.startsWith('inv:')){
    const code=raw.slice(4);
    return new InventoryError({
      code,
      message:error.hint||MESSAGES[code]||'No se pudo completar la operación.',
      detail:parseDetail(error.details)
    });
  }

  // Las funciones aún no existen en el servidor (migraciones sin aplicar).
  if(error?.code==='PGRST202'||error?.code==='42883'||error?.code==='PGRST205'||error?.code==='42P01'){
    return new InventoryError({
      code:'unavailable',
      unavailable:true,
      message:'El módulo de Inventarios todavía no está habilitado en el servidor.'
    });
  }

  if(error?.code==='42501'||error?.status===401||error?.status===403){
    return new InventoryError({code:'forbidden',message:error.hint||MESSAGES.forbidden});
  }

  const offline=(typeof navigator!=='undefined'&&navigator.onLine===false)
    ||error?.name==='TypeError'
    ||/failed to fetch|network|load failed|fetch failed|timeout|offline/i.test(raw)
    ||error?.status===0;
  if(offline){
    return new InventoryError({
      code:'network',
      network:true,
      message:'Sin conexión con el servidor. Tus datos siguen en pantalla: puedes reintentar.'
    });
  }

  return new InventoryError({
    code:error?.code||'unknown',
    message:raw||'No se pudo completar la operación.'
  });
}

function client(){
  const supabase=window.ShiftControlAuth?.getClient?.();
  if(!supabase)throw new InventoryError({code:'no_client',message:'No hay sesión activa.'});
  return supabase;
}

function context(){
  return window.AuthContext?.get?.()||null;
}

function uuid(){
  if(typeof window.safeRandomUUID==='function')return window.safeRandomUUID();
  if(window.crypto?.randomUUID)return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,char=>{
    const r=Math.random()*16|0;
    return (char==='x'?r:(r&3|8)).toString(16);
  });
}

async function rpc(name,args){
  let response;
  try{
    response=await client().rpc(name,args||{});
  }catch(error){
    throw classify(error);
  }
  if(response.error)throw classify(response.error);
  return response.data;
}

const Api={
  InventoryError,
  classify,
  uuid,
  context,

  // --- Lectura ---
  myRole:companyId=>rpc('inv_my_role',{p_company_id:companyId}),
  overview:companyId=>rpc('inv_overview',{p_company_id:companyId}),
  products:inventoryId=>rpc('inv_list_products',{p_inventory_id:inventoryId}),
  movements:(companyId,options={})=>rpc('inv_list_movements',{
    p_company_id:companyId,
    p_inventory_id:options.inventoryId||null,
    p_product_id:options.productId||null,
    p_kind:options.kind||null,
    p_limit:options.limit||100,
    p_before:options.before||null
  }),
  adjustments:(companyId,status)=>rpc('inv_list_adjustments',{p_company_id:companyId,p_status:status||null}),
  getCount:inventoryId=>rpc('inv_get_count',{p_inventory_id:inventoryId}),
  receipts:(inventoryId,limit)=>rpc('inv_list_receipts',{p_inventory_id:inventoryId,p_limit:limit||50}),
  reportWaste:(inventoryId,from,to)=>rpc('inv_report_waste',{p_inventory_id:inventoryId,p_from:from,p_to:to}),
  reportShortages:inventoryId=>rpc('inv_report_shortages',{p_inventory_id:inventoryId}),
  async audit(companyId,limit){
    let response;
    try{
      response=await client().from('inv_audit').select('id, at, user_name, action, entity, details')
        .eq('company_id',companyId).order('at',{ascending:false}).limit(limit||100);
    }catch(error){
      throw classify(error);
    }
    if(response.error)throw classify(response.error);
    return response.data||[];
  },

  // --- Escritura (cada una recibe un requestId para que un reintento no duplique) ---
  setup:companyId=>rpc('inv_setup',{p_company_id:companyId}),
  updateInventory:(inventoryId,patch)=>rpc('inv_update_inventory',{p_inventory_id:inventoryId,p_patch:patch}),
  saveLocation:(inventoryId,location)=>rpc('inv_save_location',{p_inventory_id:inventoryId,p_location:location}),
  saveProduct:(inventoryId,product)=>rpc('inv_save_product',{p_inventory_id:inventoryId,p_product:product}),
  setProductActive:(productId,active,version)=>rpc('inv_set_product_active',{
    p_product_id:productId,p_active:active,p_expected_version:version
  }),
  opening:(requestId,inventoryId,lines)=>rpc('inv_register_opening',{
    p_request_id:requestId,p_inventory_id:inventoryId,p_lines:lines
  }),
  receive:(requestId,inventoryId,header,lines)=>rpc('inv_receive',{
    p_request_id:requestId,p_inventory_id:inventoryId,p_header:header,p_lines:lines
  }),
  issue:(requestId,data)=>rpc('inv_issue',{
    p_request_id:requestId,p_product_id:data.productId,p_qty:data.qty,p_kind:data.kind,
    p_reason:data.reason,p_note:data.note||null,p_location_id:data.locationId||null,p_lot_id:data.lotId||null
  }),
  transfer:(requestId,data)=>rpc('inv_transfer',{
    p_request_id:requestId,p_product_id:data.productId,p_from_location:data.from,p_to_location:data.to,
    p_qty:data.qty,p_note:data.note||null
  }),
  countStart:inventoryId=>rpc('inv_count_start',{p_inventory_id:inventoryId}),
  countSave:(countId,lines)=>rpc('inv_count_save',{p_count_id:countId,p_lines:lines}),
  countSubmit:(requestId,countId)=>rpc('inv_count_submit',{p_request_id:requestId,p_count_id:countId}),
  review:(requestId,adjustmentId,approve,note)=>rpc('inv_review_adjustment',{
    p_request_id:requestId,p_adjustment_id:adjustmentId,p_approve:approve,p_note:note||null
  }),
  reverse:(requestId,movementId,reason)=>rpc('inv_reverse_movement',{
    p_request_id:requestId,p_movement_id:movementId,p_reason:reason
  }),
  voidReceipt:(requestId,receiptId,reason)=>rpc('inv_void_receipt',{
    p_request_id:requestId,p_receipt_id:receiptId,p_reason:reason
  })
};

window.InventoryApi=Api;
})();
