/* Lectura de facturas electrónicas en PDF para completar «Nueva factura».
   Solo lee PDFs con texto (no fotos ni escaneos). No guarda nada: llena el
   formulario y la persona revisa antes de guardar. */
(function(){
'use strict';

const PDFJS_VERSION='3.11.174';
const PDFJS_BASE=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`;
const MAX_BYTES=8*1024*1024;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/* ------------------------------------------------------------ pdf.js */
let libPromise=null;
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('No se pudo cargar el lector de PDF. Revisa tu conexión.'));
    document.head.appendChild(script);
  });
}
async function loadLib(){
  if(window.pdfjsLib&&window.pdfjsLib.getDocument)return window.pdfjsLib;
  if(!libPromise){
    libPromise=(async()=>{
      await loadScript(`${PDFJS_BASE}pdf.min.js`);
      const lib=window.pdfjsLib;
      // El worker debe ser del mismo origen: se descarga y se sirve como blob.
      try{
        const text=await (await fetch(`${PDFJS_BASE}pdf.worker.min.js`)).text();
        lib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
      }catch(_error){
        lib.GlobalWorkerOptions.workerSrc=`${PDFJS_BASE}pdf.worker.min.js`;
      }
      return lib;
    })().catch(error=>{libPromise=null;throw error});
  }
  return libPromise;
}

/* --------------------------------------------------- texto por líneas */
async function extractText(file){
  const lib=await loadLib();
  const data=new Uint8Array(await file.arrayBuffer());
  const doc=await lib.getDocument({data}).promise;
  const pages=[];
  try{
    for(let number=1;number<=Math.min(doc.numPages,4);number++){
      const page=await doc.getPage(number);
      const content=await page.getTextContent();
      const rows=[];
      content.items.forEach(item=>{
        if(!item.str||!item.str.trim())return;
        const x=item.transform[4];
        const y=item.transform[5];
        let row=rows.find(entry=>Math.abs(entry.y-y)<=2.5);
        if(!row){row={y,items:[]};rows.push(row)}
        row.items.push({x,end:x+(item.width||0),str:item.str});
      });
      rows.sort((a,b)=>b.y-a.y);
      pages.push(rows.map(row=>{
        row.items.sort((a,b)=>a.x-b.x);
        let line='';
        let last=null;
        row.items.forEach(item=>{
          if(last!==null){
            const gap=item.x-last;
            line+=gap>12?'   ':gap>1?' ':'';
          }
          line+=item.str.trim();
          last=item.end;
        });
        return line;
      }).join('\n'));
    }
  }finally{doc.destroy&&doc.destroy()}
  return pages.join('\n');
}

/* ---------------------------------------------------------- análisis */
const toInt=text=>{
  const digits=String(text||'').replace(/[^\d]/g,'');
  return digits?parseInt(digits,10):null;
};
function toIso(text){
  const match=/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(text||'');
  if(match){
    const [,d,m,y]=match;
    if(Number(m)<1||Number(m)>12||Number(d)<1||Number(d)>31)return '';
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const iso=/(\d{4})-(\d{2})-(\d{2})/.exec(text||'');
  return iso?iso[0]:'';
}
function parse(text){
  const out={ok:false,supplierName:'',rut:'',folio:'',issueDate:'',dueDate:'',total:null,net:null,iva:null,lines:[],linesSum:null,warnings:[]};
  if(!text||text.replace(/\s/g,'').length<40)return out;
  const lines=text.split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean);

  const rutRe=/R\.?\s?U\.?\s?T\.?\s*:?\s*(\d{1,2}(?:\.?\d{3}){2}-[\dkK])/i;
  const rutMatch=rutRe.exec(text);
  if(rutMatch)out.rut=rutMatch[1];
  const first=lines.find(line=>line.trim());
  if(first)out.supplierName=first.split(/\s{3,}/)[0].replace(/R\.?U\.?T.*$/i,'').trim();

  const folio=/\bN[º°o]\.?\s*(\d{3,})/.exec(text);
  if(folio)out.folio=folio[1];

  const issue=/Fecha\s+(?:de\s+)?Emisi[oó]n\s*:?\s*([0-9\/.\-]{8,10})/i.exec(text);
  const due=/Fecha\s+(?:de\s+)?Vencimiento\s*:?\s*([0-9\/.\-]{8,10})/i.exec(text);
  if(issue)out.issueDate=toIso(issue[1]);
  if(due)out.dueDate=toIso(due[1]);

  const totals=[...text.matchAll(/(?:^|\s)Total\s*\$?\s*([\d.]{4,})/gim)];
  if(totals.length)out.total=toInt(totals[totals.length-1][1]);
  const net=/Monto\s+Neto\s*\$?\s*([\d.]+)/i.exec(text);
  if(net)out.net=toInt(net[1]);
  const iva=/IVA\s*\(\s*\d+\s*%?\s*\)\s*\$?\s*([\d.]+)/i.exec(text);
  if(iva)out.iva=toInt(iva[1]);

  // Líneas de detalle: empiezan con el número de ítem y terminan en cifras.
  lines.forEach(line=>{
    const tokens=line.trim().split(/\s+/);
    if(tokens.length<5||!/^\d{1,3}$/.test(tokens[0]))return;
    let tail=0;
    while(tail<tokens.length-1&&/^\d[\d.,]*$/.test(tokens[tokens.length-1-tail]))tail++;
    if(tail<3)return;
    const amount=toInt(tokens[tokens.length-1]);
    const qtyIndex=tail>=5?tokens.length-5:tokens.length-3;
    const qty=Number(String(tokens[qtyIndex]).replace(',','.'));
    out.lines.push({n:Number(tokens[0]),qty:Number.isFinite(qty)?qty:null,amount});
  });
  if(out.lines.length)out.linesSum=out.lines.reduce((sum,line)=>sum+(line.amount||0),0);

  const hints=[['Tabaco',/tabaco|cigarr/i],['Bebidas',/bebida|cervec|vino|licor|gaseosa/i],['Combustible',/combustible|petr[oó]leo|gasolina/i],['Alimentos',/aliment|abarrote|panader|dulce/i]];
  const hint=hints.find(item=>item[1].test(text));
  out.category=hint?hint[0]:'';
  out.ok=Boolean(out.rut&&out.folio&&out.total);
  if(!out.ok)out.warnings.push('No pude leer todos los datos. Completa los que falten.');
  if(out.net!==null&&out.linesSum!==null&&out.linesSum!==out.net)out.warnings.push('La suma de las líneas no coincide con el monto neto. Revisa el total.');
  return out;
}

/* ---------------------------------------------------------- formulario */
function banner(kind,html){
  const form=$('invoiceForm');
  if(!form)return;
  let box=$('invoicePdfBanner');
  if(!box){
    box=document.createElement('div');
    box.id='invoicePdfBanner';
    box.className='form-group full';
    form.insertBefore(box,form.querySelector('#invoiceId').nextSibling);
  }
  box.innerHTML=html?`<div class="ip-banner ${kind}">${html}</div>`:'';
  box.hidden=!html;
}
function setValue(id,value){
  const field=$(id);
  if(!field||value===null||value===undefined||value==='')return;
  field.value=value;
  // El campo de proveedor no recibe «input»: abriría el menú de sugerencias encima del formulario.
  if(id!=='invoiceProveedor')field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new Event('change',{bubbles:true}));
}
function attach(file){
  const input=$('invoiceAdjunto');
  if(!input)return;
  try{
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
  }catch(_error){}
}
function duplicate(parsed,supplier){
  const key=window.SupplierModule?.rutKey?.(parsed.rut)||'';
  const folio=String(parsed.folio).replace(/^0+/,'');
  return (window.InvoiceModule?.getAll?.()||[]).find(invoice=>{
    const same=String(invoice.numeroFactura||'').replace(/^0+/,'')===folio;
    if(!same)return false;
    const invoiceKey=window.SupplierModule?.rutKey?.(invoice.rutProveedor)||'';
    return (key&&invoiceKey===key)||(supplier&&window.SupplierModule.forInvoice(invoice)?.id===supplier.id);
  })||null;
}
function apply(parsed,file){
  attach(file);
  const M=window.SupplierModule;
  const key=M?.rutKey?.(parsed.rut)||'';
  const supplier=(M&&key)?M.list().find(item=>item.rut_key===key&&item.active)||null:null;
  if(supplier&&window.SupplierInvoice)window.SupplierInvoice.pick(supplier);
  else{
    setValue('invoiceProveedor',parsed.supplierName);
    setValue('invoiceRut',parsed.rut);
  }
  setValue('invoiceNumero',parsed.folio);
  setValue('invoiceFechaEmision',parsed.issueDate);
  setValue('invoiceFechaVencimiento',parsed.dueDate);
  setValue('invoiceMonto',parsed.total);
  if(!supplier&&parsed.category)setValue('invoiceCategoria',parsed.category);
  lastCategory=parsed.category||'';

  const notes=[];
  const parts=[`<b>${esc(parsed.supplierName||'Proveedor')}</b>`,`N° ${esc(parsed.folio)}`];
  if(parsed.lines.length)parts.push(`${parsed.lines.length} línea${parsed.lines.length===1?'':'s'}`);
  notes.push(`Leída del PDF: ${parts.join(' · ')}. Revisa los datos y guarda.`);
  let kind='ok';
  if(!supplier&&M&&M.isAvailable()&&parsed.supplierName){
    notes.push(`Este proveedor aún no está registrado. <button type="button" class="ip-link" data-ip="create">Crear proveedor</button>`);
  }
  const twin=duplicate(parsed,supplier);
  if(twin){kind='warn';notes.push(`Ya existe la factura N° ${esc(twin.numeroFactura)} de este proveedor. Revisa que no sea un duplicado.`)}
  parsed.warnings.forEach(message=>{kind='warn';notes.push(esc(message))});
  banner(kind,notes.join('<br>'));
}

let busy=false;
let lastCategory='';
async function handle(file){
  if(busy||!file)return;
  if(!/pdf$/i.test(file.type)&&!/\.pdf$/i.test(file.name)){alert('Sube la factura en formato PDF.');return}
  if(file.size>MAX_BYTES){alert('El PDF supera los 8 MB.');return}
  if(typeof window.openInvoiceModal==='function'&&!document.getElementById('invoiceModal')?.classList.contains('open')&&!document.getElementById('invoiceModal')?.classList.contains('active')){
    window.openInvoiceModal();
  }
  if($('invoiceId')?.value){alert('Para leer un PDF crea una factura nueva.');return}
  busy=true;
  banner('info','Leyendo el PDF…');
  try{
    if(window.SupplierModule?.isAvailable?.())await window.SupplierModule.load();
    const text=await extractText(file);
    const parsed=parse(text);
    attach(file);
    if(!text||text.replace(/\s/g,'').length<40){
      banner('warn','Este PDF no tiene texto legible (parece un escaneo o una foto). Completa los datos a mano; el archivo se adjunta igual como respaldo.');
    }else apply(parsed,file);
  }catch(error){
    attach(file);
    banner('warn',`${esc(error?.message||'No se pudo leer el PDF.')} Completa los datos a mano; el archivo se adjunta igual.`);
  }finally{busy=false}
}

function chooser(){
  let input=$('invoicePdfPicker');
  if(!input){
    input=document.createElement('input');
    input.type='file';
    input.id='invoicePdfPicker';
    input.accept='application/pdf,.pdf';
    input.hidden=true;
    input.addEventListener('change',()=>{const file=input.files&&input.files[0];input.value='';if(file)handle(file)});
    document.body.appendChild(input);
  }
  return input;
}
function pick(){chooser().click()}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ip]');
  if(!button)return;
  if(button.dataset.ip==='create'&&window.SupplierInvoice?.create)window.SupplierInvoice.create({category:lastCategory}).then(()=>banner('ok','Proveedor creado. Revisa los datos y guarda la factura.'));
  if(button.dataset.ip==='pick')pick();
});

// Arrastrar y soltar el PDF sobre el formulario.
function initDrop(){
  const card=document.querySelector('#invoiceModal .modal-card');
  if(!card)return;
  ['dragover','drop'].forEach(name=>card.addEventListener(name,event=>{
    if(!event.dataTransfer||![...event.dataTransfer.types||[]].includes('Files'))return;
    event.preventDefault();
    if(name==='drop'){const file=event.dataTransfer.files[0];if(file)handle(file)}
  }));
}
initDrop();

window.InvoicePdf={pick,handle,parse,extractText};
})();
