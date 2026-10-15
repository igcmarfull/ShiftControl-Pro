(function(){
  'use strict';
  // Logo del proveedor en Facturas y compras.
  // El logo se recorta y se comprime en el navegador, se sube al bucket privado de evidencia
  // (<empresa>/invoices/<ÁREA>/proveedores/...) y su ruta se guarda en las facturas del proveedor
  // mediante InvoiceModule. Sin logo se mantiene el círculo con la inicial.
  const BUCKET='shiftcontrol-evidence';
  const TTL=3600;
  const SIZE=256;
  const MAX_INPUT=10*1024*1024;
  const MAX_OUTPUT=120*1024;
  const URLS={};
  const pending=new Set();
  let timer=null;
  let picker=null;
  let menu=null;
  let target=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const client=()=>window.ShiftControlAuth?.getClient?.()||null;
  const areaOf=inv=>window.ShiftControlAreas?.normalizeArea?.(inv?.area)||'';

  function canEdit(inv){
    if(!inv||!window.InvoiceModule?.setSupplierLogo)return false;
    const role=typeof window.getAppRole==='function'?window.getAppRole():null;
    if(role==='admin')return true;
    const mine=window.ShiftControlAreas?.getSessionArea?.();
    return Boolean(mine)&&mine===areaOf(inv);
  }

  /* ------------------------------------------------------- URLs firmadas */
  function urlOf(path){
    const hit=URLS[path];
    if(hit&&hit.exp>Date.now())return hit.url;
    queue(path);
    return hit?hit.url:null;
  }
  function queue(path){
    if(pending.has(path))return;
    pending.add(path);
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      const paths=[...pending];
      let rows=[];
      try{
        const response=await client().storage.from(BUCKET).createSignedUrls(paths,TTL);
        rows=response?.data||[];
      }catch(_error){}
      const fresh=Date.now()+(TTL-300)*1000;
      paths.forEach(path=>{
        const row=rows.find(entry=>entry.path===path);
        const url=row&&!row.error?row.signedUrl:null;
        URLS[path]={url,exp:url?fresh:Date.now()+60000};
        pending.delete(path);
      });
      hydrate();
    },60);
  }
  // Pone el logo en los avatares que ya estaban dibujados con la inicial.
  function hydrate(){
    document.querySelectorAll('#invoices [data-su-logo]').forEach(element=>{
      const url=window.SupplierModule?.logoUrl?.(element.dataset.suLogo);
      if(!url||element.querySelector('img'))return;
      element.innerHTML=`<span class="sp-logo"><img src="${esc(url)}" alt="" decoding="async"></span>`;
    });
    document.querySelectorAll('#invoices [data-sp-path]').forEach(element=>{
      const hit=URLS[element.dataset.spPath];
      if(!hit||!hit.url||element.querySelector('img'))return;
      element.innerHTML=`<span class="sp-logo"><img src="${esc(hit.url)}" alt="" decoding="async"></span>`;
    });
  }

  /* ------------------------------------------------------------- dibujo */
  // Reemplaza a invoiceAvatar cuando hay una factura: logo si existe, círculo si no.
  function avatar(inv,fallbackHtml){
    if(!inv)return fallbackHtml;
    // El logo del proveedor registrado (sección Proveedores) manda sobre el logo guardado en la factura.
    const supplier=window.SupplierModule?.forInvoice?.(inv);
    if(supplier&&supplier.logo_path){
      const suUrl=window.SupplierModule.logoUrl(supplier.logo_path);
      const suInner=suUrl?`<span class="sp-logo"><img src="${esc(suUrl)}" alt="" decoding="async"></span>`:fallbackHtml;
      return `<span class="sp-wrap" data-su-logo="${esc(supplier.logo_path)}">${suInner}</span>`;
    }
    const path=window.InvoiceModule?.supplierLogoPath?.(inv)||'';
    const url=path?urlOf(path):null;
    let inner;
    if(url)inner=`<span class="sp-logo"><img src="${esc(url)}" alt="" decoding="async"></span>`;
    else inner=fallbackHtml;
    const body=path&&!url?`<span class="sp-wrap" data-sp-path="${esc(path)}">${inner}</span>`:`<span class="sp-wrap"${path?` data-sp-path="${esc(path)}"`:''}>${inner}</span>`;
    if(!canEdit(inv))return body;
    const label=path?'Cambiar o quitar el logo':'Agregar logo';
    return `<button type="button" class="sp-btn" data-sp-inv="${esc(inv.id)}" title="${label}" aria-label="${label}: ${esc(inv.proveedor||'proveedor')}">${body}<i class="sp-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg></i></button>`;
  }

  /* -------------------------------------------------- imagen del logo */
  const fail=message=>new Error(message);
  async function loadBitmap(file){
    if(window.createImageBitmap)return createImageBitmap(file);
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const image=new Image();
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('imagen no válida'))};
      image.src=url;
    });
  }
  const canvasBlob=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  async function processLogo(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw fail('Usa una imagen JPG, PNG o WebP.');
    if(file.size>MAX_INPUT)throw fail('La imagen supera los 10 MB.');
    let bitmap;
    try{bitmap=await loadBitmap(file)}catch(_error){throw fail('No se pudo leer la imagen.')}
    const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale));
    const h=Math.max(1,Math.round(bitmap.height*scale));
    const work=document.createElement('canvas');
    work.width=w;work.height=h;
    const wctx=work.getContext('2d',{willReadFrequently:true});
    wctx.fillStyle='#fff';
    wctx.fillRect(0,0,w,h);
    wctx.drawImage(bitmap,0,0,w,h);
    if(bitmap.close)bitmap.close();
    const data=wctx.getImageData(0,0,w,h).data;
    let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y+=2){
      for(let x=0;x<w;x+=2){
        const i=(y*w+x)*4;
        if(data[i]<244||data[i+1]<244||data[i+2]<244){
          if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        }
      }
    }
    if(x1<0){x0=0;y0=0;x1=w-1;y1=h-1}
    const pad=Math.round(Math.max(x1-x0,y1-y0)*0.04);
    x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
    const cw=x1-x0+1,ch=y1-y0+1;
    const k=(SIZE*0.9)/Math.max(cw,ch);
    const out=document.createElement('canvas');
    out.width=SIZE;out.height=SIZE;
    const octx=out.getContext('2d');
    octx.fillStyle='#fff';
    octx.fillRect(0,0,SIZE,SIZE);
    octx.imageSmoothingQuality='high';
    octx.drawImage(work,x0,y0,cw,ch,(SIZE-cw*k)/2,(SIZE-ch*k)/2,cw*k,ch*k);
    let blob=await canvasBlob(out,'image/webp',0.86);
    if(!blob||blob.type!=='image/webp')blob=await canvasBlob(out,'image/jpeg',0.88);
    if(blob&&blob.size>MAX_OUTPUT)blob=await canvasBlob(out,blob.type,0.7);
    if(!blob||blob.size>MAX_OUTPUT)throw fail('No se pudo reducir la imagen. Prueba con otra.');
    return blob;
  }

  /* ----------------------------------------------------- guardar / quitar */
  const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};
  const persist=()=>{if(typeof window.save==='function')window.save()};
  const refresh=()=>{if(typeof window.renderInvoices==='function')window.renderInvoices(true)};

  async function change(inv,file){
    const companyId=window.AuthContext?.get?.()?.companyId;
    if(!companyId){alert('Tu sesión no es válida. Vuelve a iniciar sesión.');return}
    toast('Subiendo logo…');
    try{
      const blob=await processLogo(file);
      const folder=areaOf(inv)||'GENERAL';
      const uuid=typeof window.safeRandomUUID==='function'?window.safeRandomUUID():String(Date.now());
      const path=`${companyId}/invoices/${folder}/proveedores/${uuid}.${blob.type==='image/jpeg'?'jpg':'webp'}`;
      const {error}=await client().storage.from(BUCKET).upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false});
      if(error)throw error;
      window.InvoiceModule.setSupplierLogo(inv,path,{save:false});
      persist();
      refresh();
      toast('Logo guardado');
    }catch(error){
      alert(`No fue posible guardar el logo: ${error?.message||error}`);
    }
  }
  function remove(inv){
    if(!confirm(`¿Quitar el logo de ${inv.proveedor||'este proveedor'}? Volverá a verse la inicial.`))return;
    window.InvoiceModule.setSupplierLogo(inv,'',{save:false});
    persist();
    refresh();
    toast('Logo quitado');
  }

  /* ------------------------------------------------------------- eventos */
  function ensurePicker(){
    if(picker)return picker;
    picker=document.createElement('input');
    picker.type='file';
    picker.accept='image/jpeg,image/png,image/webp';
    picker.hidden=true;
    picker.addEventListener('change',()=>{
      const file=picker.files&&picker.files[0];
      picker.value='';
      const inv=target;
      target=null;
      if(file&&inv)change(inv,file);
    });
    document.body.appendChild(picker);
    return picker;
  }
  function closeMenu(){
    if(menu){menu.remove();menu=null}
  }
  function openMenu(button,inv){
    closeMenu();
    menu=document.createElement('div');
    menu.className='sp-menu';
    menu.setAttribute('role','menu');
    menu.innerHTML='<button type="button" role="menuitem" data-sp-act="change">Cambiar logo</button><button type="button" role="menuitem" data-sp-act="remove" class="bad">Quitar logo</button>';
    document.body.appendChild(menu);
    const rect=button.getBoundingClientRect();
    menu.style.top=`${Math.round(rect.bottom+window.scrollY+6)}px`;
    menu.style.left=`${Math.round(Math.max(8,Math.min(rect.left+window.scrollX,window.innerWidth-menu.offsetWidth-8)))}px`;
    menu.dataset.inv=inv.id;
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-sp-act]');
    if(action&&menu){
      const inv=window.InvoiceModule?.findById?.(menu.dataset.inv);
      closeMenu();
      if(!inv||!canEdit(inv))return;
      if(action.dataset.spAct==='change'){target=inv;ensurePicker().click()}
      else remove(inv);
      return;
    }
    const button=event.target.closest('.sp-btn[data-sp-inv]');
    if(!button){closeMenu();return}
    event.preventDefault();
    const inv=window.InvoiceModule?.findById?.(button.dataset.spInv);
    if(!inv||!canEdit(inv))return;
    if(window.InvoiceModule.supplierLogoPath(inv)){
      if(menu&&menu.dataset.inv===inv.id){closeMenu();return}
      openMenu(button,inv);
    }else{
      closeMenu();
      target=inv;
      ensurePicker().click();
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});

  window.InvoiceLogos={avatar,hydrate,canEdit,processLogo};
})();
