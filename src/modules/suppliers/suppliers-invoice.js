/* Selector de proveedor en «Nueva factura». Si los proveedores no están
   disponibles, el campo sigue siendo texto libre como antes. */
(function(){
'use strict';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const $=id=>document.getElementById(id);
const M=()=>window.SupplierModule;
const TONES=['#2f6fed','#17a673','#e07b1f','#7a4fd6','#d6455f','#0e8fa6','#c77e08','#5a6b7d'];
const toneOf=name=>{let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))>>>0;return TONES[h%TONES.length]};
const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();

let panel=null;
let hint=null;
let manualDue=false;
let busy=false;

function mini(supplier){
  const url=M().logoUrl(supplier.logo_path);
  if(url)return `<span class="si-logo"><img src="${esc(url)}" alt="" decoding="async"></span>`;
  return `<span class="si-logo ini" style="--c:${toneOf(supplier.name)}">${esc(initials(supplier.name))}</span>`;
}
function creditText(days){
  if(days===null||days===undefined||days==='')return '';
  return Number(days)===0?'Contado':`Crédito ${days} días`;
}
function enabled(){
  const input=$('invoiceProveedor');
  // Con proveedores disponibles se usa este selector en lugar de la lista nativa.
  if(input&&M()&&M().isReady())input.removeAttribute('list');
  return Boolean(M()&&M().isAvailable()&&input&&!input.disabled);
}
function addDays(iso,days){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  if(!match)return '';
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3])+Number(days));
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}
function selected(){
  const id=$('invoiceSupplierId')?.value;
  return id?M().get(id):null;
}

/* ------------------------------------------------------------- panel */
function ensure(){
  const input=$('invoiceProveedor');
  if(!input||panel)return;
  const group=input.closest('.form-group');
  group.classList.add('si-group');
  panel=document.createElement('div');
  panel.className='si-panel';
  panel.hidden=true;
  hint=document.createElement('div');
  hint.className='si-hint';
  hint.hidden=true;
  group.appendChild(panel);
  group.appendChild(hint);
}
function close(){if(panel)panel.hidden=true}
function matches(){
  const text=M().norm($('invoiceProveedor').value);
  const key=M().rutKey($('invoiceProveedor').value);
  return M().active().filter(item=>!text||M().norm(item.name).includes(text)||(key&&item.rut_key&&item.rut_key.includes(key)));
}
function open(){
  if(!enabled()){close();return}
  ensure();
  const text=$('invoiceProveedor').value.trim();
  const list=matches().slice(0,8);
  const exact=M().list().some(item=>M().norm(item.name)===M().norm(text));
  const rows=list.map(item=>{
    const sub=[item.rut,item.category,creditText(item.credit_days)].filter(Boolean).join(' · ');
    return `<button type="button" class="si-row" data-si="pick" data-id="${esc(item.id)}">${mini(item)}<span><b>${esc(item.name)}</b><small>${esc(sub||'Sin más datos')}</small></span></button>`;
  });
  if(text&&!exact)rows.push(`<button type="button" class="si-row new" data-si="create"><span class="si-plus">＋</span><span><b>Crear proveedor «${esc(text)}»</b><small>Se guarda en Proveedores con el RUT y la categoría de este formulario</small></span></button>`);
  if(!rows.length){close();return}
  panel.innerHTML=rows.join('');
  panel.hidden=false;
}

/* ------------------------------------------------------------ elegir */
function showHint(supplier){
  ensure();
  if(!hint)return;
  if(!supplier){hint.hidden=true;hint.textContent='';return}
  const parts=[`Proveedor registrado: ${supplier.name}`];
  const credit=creditText(supplier.credit_days);
  if(credit)parts.push(`${credit}${supplier.credit_days?' · el vencimiento se calcula desde la emisión':''}`);
  hint.textContent=parts.join(' · ');
  hint.hidden=false;
}
function applyDue(){
  const supplier=selected();
  if(!supplier||supplier.credit_days===null||supplier.credit_days===undefined||manualDue)return;
  const emission=$('invoiceFechaEmision')?.value;
  if(!emission)return;
  const due=addDays(emission,supplier.credit_days);
  if(due)$('invoiceFechaVencimiento').value=due;
}
function pick(supplier,{fromOpen=false}={}){
  $('invoiceSupplierId').value=supplier.id;
  $('invoiceProveedor').value=supplier.name;
  if(!fromOpen||!$('invoiceRut').value.trim())$('invoiceRut').value=supplier.rut||$('invoiceRut').value;
  const category=$('invoiceCategoria');
  if(!fromOpen&&supplier.category&&category&&[...category.options].some(option=>option.value===supplier.category))category.value=supplier.category;
  if(!fromOpen)applyDue();
  showHint(supplier);
  close();
}
async function create(options){
  if(busy)return;
  const name=$('invoiceProveedor').value.trim();
  if(!name)return;
  busy=true;
  try{
    const fields={name,category:options&&'category' in options?options.category:($('invoiceCategoria')?.value||null)};
    const rut=$('invoiceRut').value.trim();
    if(rut)fields.rut=rut;
    const row=await M().save(fields);
    pick(row);
    if(typeof window.showToast==='function')window.showToast('Proveedor creado');
  }catch(error){
    alert(error?.message||'No se pudo crear el proveedor.');
  }finally{busy=false}
}

/* -------------------------------------------------------- integración */
function init(){
  const input=$('invoiceProveedor');
  if(!input||!M())return;
  input.setAttribute('autocomplete','off');
  input.addEventListener('focus',()=>{if(enabled())open()});
  input.addEventListener('input',()=>{
    const current=selected();
    if(current&&M().norm(current.name)!==M().norm(input.value)){$('invoiceSupplierId').value='';showHint(null)}
    open();
  });
  $('invoiceFechaEmision')?.addEventListener('change',applyDue);
  $('invoiceFechaVencimiento')?.addEventListener('input',()=>{manualDue=true});
  document.addEventListener('mousedown',event=>{
    if(!panel||panel.hidden)return;
    if(event.target.closest('.si-panel')||event.target===input)return;
    close();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-si]');
    if(!button||!panel||!panel.contains(button))return;
    event.preventDefault();
    if(button.dataset.si==='create'){create();return}
    const supplier=M().get(button.dataset.id);
    if(supplier)pick(supplier);
  });
  window.addEventListener('suppliers:logos',()=>{if(panel&&!panel.hidden)open()});

  const original=window.openInvoiceModal;
  if(typeof original==='function'){
    window.openInvoiceModal=function(id){
      const result=original.apply(this,arguments);
      manualDue=Boolean(id);
      $('invoiceSupplierId').value='';
      close();
      showHint(null);
      if(M().isAvailable())M().load().then(()=>{
        if(!id)return;
        const invoice=window.InvoiceModule?.findById?.(id);
        const supplier=invoice?M().forInvoice(invoice):null;
        if(supplier){$('invoiceSupplierId').value=supplier.id;showHint(supplier)}
      });
      return result;
    };
  }
  // Desde la ficha del proveedor: abre una factura nueva con el proveedor ya elegido.
  window.openInvoiceModalForSupplier=function(id){
    window.openInvoiceModal();
    const supplier=M().get(id);
    if(supplier)pick(supplier,{fromOpen:false});
  };
  if(M().isAvailable())M().load();
}

window.SupplierInvoice={init,pick,applyDue,create};
init();
})();
