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
    const at=(x,y)=>{const k=(y*w+x)*4;return [data[k],data[k+1],data[k+2]]};
    const far=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));
    // Caja que contiene todo lo que se distingue del fondo `bg` (dentro de `area`).
    const boxOf=(bg,tol,area)=>{
      let a=area.x1,b=area.y1,c=area.x0,d=area.y0;
      for(let y=area.y0;y<=area.y1;y+=2){
        for(let x=area.x0;x<=area.x1;x+=2){
          if(far(at(x,y),bg)>tol){if(x<a)a=x;if(x>c)c=x;if(y<b)b=y;if(y>d)d=y}
        }
      }
      return c<a?null:{x0:a,y0:b,x1:c,y1:d};
    };
    const whole={x0:0,y0:0,x1:w-1,y1:h-1};
    let box=boxOf([255,255,255],11,whole)||whole;
    let fill=[255,255,255];
    let solid=false;
    // ¿La imagen es un bloque de color sin espacio blanco (como un logo azul con letras blancas)?
    // Entonces el recuadro se llena con ese color y las letras se agrandan hasta ocuparlo.
    const ring=[];
    for(let x=box.x0+1;x<=box.x1-1;x+=3){ring.push(at(x,box.y0+1),at(x,box.y1-1))}
    for(let y=box.y0+1;y<=box.y1-1;y+=3){ring.push(at(box.x0+1,y),at(box.x1-1,y))}
    if(ring.length>8){
      const white=[255,255,255];
      const colored=ring.filter(c=>far(c,white)>11);
      if(colored.length/ring.length>=0.75){
        const median=index=>{const v=colored.map(c=>c[index]).sort((m,n)=>m-n);return v[Math.floor(v.length/2)]};
        const base=[median(0),median(1),median(2)];
        if(colored.filter(c=>far(c,base)<=28).length/colored.length>=0.9){
          // Se ignoran los bordes (esquinas redondeadas con fondo blanco no son parte del logo).
          const ix=Math.round((box.x1-box.x0)*0.12),iy=Math.round((box.y1-box.y0)*0.12);
          const inner=boxOf(base,40,{x0:box.x0+ix,y0:box.y0+iy,x1:box.x1-ix,y1:box.y1-iy});
          if(inner){
            const margin=Math.round(Math.max(inner.x1-inner.x0,inner.y1-inner.y0)*0.18);
            box={x0:Math.max(box.x0,inner.x0-margin),y0:Math.max(box.y0,inner.y0-margin),x1:Math.min(box.x1,inner.x1+margin),y1:Math.min(box.y1,inner.y1+margin)};
            fill=base;solid=true;
          }
        }
      }
    }
    if(!solid){
      const pad=Math.round(Math.max(box.x1-box.x0,box.y1-box.y0)*0.03);
      box={x0:Math.max(0,box.x0-pad),y0:Math.max(0,box.y0-pad),x1:Math.min(w-1,box.x1+pad),y1:Math.min(h-1,box.y1+pad)};
    }
    const cw=box.x1-box.x0+1,ch=box.y1-box.y0+1;
    const k=(solid?SIZE:SIZE*0.96)/Math.max(cw,ch);
    const out=document.createElement('canvas');
    out.width=SIZE;out.height=SIZE;
    const octx=out.getContext('2d');
    octx.fillStyle=`rgb(${fill[0]},${fill[1]},${fill[2]})`;
    octx.fillRect(0,0,SIZE,SIZE);
    octx.imageSmoothingQuality='high';
    octx.drawImage(work,box.x0,box.y0,cw,ch,(SIZE-cw*k)/2,(SIZE-ch*k)/2,cw*k,ch*k);
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
