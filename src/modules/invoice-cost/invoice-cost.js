(function(){
'use strict';

// Pantalla «Costo de facturas» (solo administrador): se sube la factura de un proveedor en PDF y se calcula cuánto
// cuesta cada producto, sin IVA. Es una calculadora: no guarda nada en la base ni toca Inventarios. El texto del PDF
// lo entrega InvoicePdf.extractText y el cálculo está en invoice-cost-calc.js.

const EXCELJS_URL='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const LOGO_URL='src/assets/prosercom-logo.png';
const MAX_BYTES=8*1024*1024;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=n=>Math.round(Number(n)||0).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const money1=n=>'$'+(Math.round((Number(n)||0)*10)/10).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
const pct=n=>(Math.round(n*10)/10).toLocaleString('es-CL')+'%';
const dmy=iso=>String(iso||'').split('-').reverse().join('-');
const Calc=()=>window.InvoiceCostCalc;
const isAdmin=()=>window.ShiftControlPermissions?.getRole?.()==='ADMIN';
const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};

const S={parsed:null,fileName:'',flags:[],packs:[],busy:false,message:'',over:false};

function result(){return S.parsed?Calc().compute(S.parsed,{flags:S.flags,packs:S.packs}):null}

/* ------------------------------------------------------------ pantalla */
function dropHtml(){
  return `<label class="ifc-drop${S.over?' over':''}" id="icDrop"><input type="file" id="icFile" accept="application/pdf,.pdf" hidden>
    <b>${S.busy?'Leyendo la factura…':'Subir factura (PDF)'}</b>
    <small>Arrastra el PDF aquí o toca para elegirlo · factura electrónica con texto, hasta 8 MB</small></label>`;
}
function kpisHtml(c,parsed){
  return `<div class="ifc-kpis">
    <div class="ifc-k"><span>Neto de la factura</span><b>${money(c.net)}</b><small>suma de las líneas, ya con descuentos y recargo</small></div>
    <div class="ifc-k"><span>${parsed.extraBreakdown.length?`Impuesto adicional (${parsed.extraBreakdown.map(item=>`${item.rate}%`).join(' + ')})`:'Impuesto adicional'}</span><b>${money(c.extraTax)}</b><small>ILA o similar: es costo, no se recupera</small></div>
    <div class="ifc-k strong"><span>Costo real, sin IVA</span><b>${money(c.real)}</b><small>${c.net?`${pct(c.overPct)} sobre el neto`:''}</small></div>
    <div class="ifc-k muted"><span>IVA</span><b>${c.iva!=null?money(c.iva):'—'}</b><small>crédito fiscal: no es costo</small></div></div>`;
}
function tableHtml(c){
  const rows=c.lines.map(line=>`<div class="ifc-r">
      <div class="ifc-p"><b>${esc(line.name)}</b><small>${esc(line.code)} · ${fmt(line.qty)} ${esc(line.unit)}${line.surcharge?` · recargo ${money(line.surcharge)}`:''}</small></div>
      <div class="ifc-n" data-l="Unid. por pack"><input type="number" min="1" step="1" inputmode="numeric" value="${line.pack}" data-ic-pack="${line.index}" aria-label="Unidades por pack de ${esc(line.name)}"></div>
      <div class="ifc-n" data-l="Neto línea">${money(line.amount)}</div>
      <div class="ifc-n" data-l="Costo por pack">${money(line.packCost)}</div>
      <div class="ifc-n key" data-l="Costo unidad sin ILA"><b>${money1(line.unitNet)}</b></div>
      <div class="ifc-n c" data-l="Lleva ILA"><input type="checkbox" data-ic-tax="${line.index}"${line.hasTax?' checked':''} aria-label="Lleva impuesto adicional: ${esc(line.name)}"></div>
      <div class="ifc-n key2" data-l="Costo unidad con ILA (aprox.)"><b>${money1(line.unitReal)}</b></div></div>`).join('');
  return `<div class="ifc-t"><div class="ifc-h"><span>Producto</span><span>Unid. por pack</span><span>Neto línea</span><span>Costo por pack</span><span>Costo unidad sin ILA</span><span>Lleva ILA</span><span>Costo unidad con ILA (aprox.)</span></div>${rows}</div>`;
}
function reconHtml(c,parsed){
  const diff=parsed.net!=null?c.linesSum-parsed.net:0;
  const ivaCalc=Math.round(c.net*0.19);
  return `<div class="ifc-rec"><h4>Conciliación con la factura</h4>
    <div><span>Suma de las líneas</span><b>${money(c.linesSum)}</b></div>
    <div><span>Monto neto de la factura</span><b>${money(c.net)}</b><em class="${diff?'bad':'ok'}">${diff?`diferencia ${money(diff)}`:'cuadra'}</em></div>
    <div><span>Impuesto adicional</span><b>${money(c.extraTax)}</b></div>
    <div><span>IVA 19% (crédito fiscal)</span><b>${money(c.iva!=null?c.iva:ivaCalc)}</b>${c.iva!=null&&c.iva!==ivaCalc?`<em class="bad">debería ser ${money(ivaCalc)}</em>`:''}</div>
    <div><span>Total de la factura</span><b>${c.total!=null?money(c.total):'—'}</b>${c.total!=null&&c.total!==c.net+c.extraTax+(c.iva||0)?`<em class="bad">neto + impuesto + IVA = ${money(c.net+c.extraTax+(c.iva||0))}</em>`:''}</div>
    <div class="tot"><span>Costo real de esta compra (sin IVA)</span><b>${money(c.real)}</b></div>
    <div><span>Incluido en el neto: recargo / flete</span><b>${money(c.surchargeSum)}</b></div>
    <div><span>Incluido en el neto: descuentos aplicados</span><b>−${money(c.discountSum)}</b></div></div>`;
}
function render(){
  const root=$('invCostRoot');
  if(!root)return;
  if(!isAdmin()){root.innerHTML='<div class="ifc-empty"><b>Solo el administrador ve el costo de las facturas.</b></div>';return}
  const head=`<div class="ifc-head"><div><h1>Costo de facturas</h1><p>Sube la factura de un proveedor en PDF y ve cuánto te cuesta cada producto, sin IVA. Es una calculadora: no guarda la factura ni modifica Inventarios.</p></div></div>`;
  const msg=S.message?`<p class="ifc-err">${esc(S.message)}</p>`:'';
  if(!S.parsed){root.innerHTML=`${head}${msg}${dropHtml()}`;return}
  const parsed=S.parsed,c=result();
  const warnings=parsed.warnings.map(text=>`<p class="ifc-warn">${esc(text)}</p>`).join('');
  root.innerHTML=`${head}${msg}
    <div class="ifc-bar"><div class="ifc-who"><b>${esc(parsed.supplierName||'Proveedor')}</b><small>${esc([parsed.rut,parsed.folio?`Factura Nº ${parsed.folio}`:'',parsed.issueDate?`emitida el ${dmy(parsed.issueDate)}`:'',S.fileName].filter(Boolean).join(' · '))}</small></div>
      <div class="ifc-acts"><button type="button" class="ifc-btn" data-ic="again">Subir otra factura</button><button type="button" class="ifc-btn pri" data-ic="excel"${S.busy?' disabled':''}>${S.busy?'Generando…':'Descargar Excel'}</button></div></div>
    ${warnings}${kpisHtml(c,parsed)}${tableHtml(c)}
    <p class="ifc-note"><b>Cómo leerlo.</b> «Costo unidad sin ILA» es exacto: neto de la línea ÷ unidades (el neto ya trae descuentos y el recargo/flete). La factura trae el impuesto adicional solo como total al pie, sin decir a qué producto corresponde, así que el «costo con ILA» lo reparte en proporción al neto entre las líneas marcadas «Lleva ILA»: es una aproximación. Las unidades por pack salen del nombre (por ejemplo «x 6») y se pueden corregir.</p>
    ${reconHtml(c,parsed)}`;
}

/* ------------------------------------------------------------ lectura */
async function handleFile(file){
  if(!file)return;
  S.message='';
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){S.message='Sube la factura en formato PDF.';render();return}
  if(file.size>MAX_BYTES){S.message='El PDF pesa más de 8 MB.';render();return}
  if(!window.InvoicePdf?.extractText){S.message='El lector de PDF no está disponible.';render();return}
  S.busy=true;render();
  try{
    const text=await window.InvoicePdf.extractText(file);
    const parsed=Calc().parse(text);
    if(!parsed.lines.length){S.parsed=null;S.message=parsed.warnings[0]||'No pude leer esta factura.'}
    else{
      S.parsed=parsed;S.fileName=file.name;
      S.packs=parsed.lines.map(line=>line.packSize);
      S.flags=parsed.lines.map(line=>Calc().defaultHasTax(line.name));
    }
  }catch(error){
    S.parsed=null;
    S.message=/Invalid PDF|Missing PDF|password/i.test(String(error?.message||error?.name))?'No pude abrir este PDF. Sube la factura electrónica original en PDF.':(error?.message||'No se pudo leer el PDF.');
  }finally{S.busy=false;render()}
}

/* -------------------------------------------------------------- Excel */
let libPromise=null;
function loadExcel(){
  if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
  if(!libPromise){
    libPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=EXCELJS_URL;
      script.onload=()=>resolve(window.ExcelJS);
      script.onerror=()=>{libPromise=null;reject(new Error('No se pudo cargar el generador de Excel. Revisa tu conexión.'))};
      document.head.appendChild(script);
    });
  }
  return libPromise;
}
async function download(){
  if(!S.parsed||S.busy)return;
  S.busy=true;S.message='';render();
  try{
    const ExcelJS=await loadExcel();
    const parsed=S.parsed,c=result();
    const BLUE='FF0F4C9C',SOFT='FFE8EFFB',GREY='FF667085',INK='FF14213D',LINE='FFD9DFEB',ZEBRA='FFF6F8FC',CLP='"$"#,##0',CLP1='"$"#,##0.0';
    const FONT='Calibri';
    const wb=new ExcelJS.Workbook();
    wb.creator='Prosercom · ShiftControl';
    const ws=wb.addWorksheet('Costo unitario',{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.4,right:.4,top:.5,bottom:.5,header:.2,footer:.2}},views:[{showGridLines:false}]});
    const widths=[11,40,8,10,9,13,14,14,13,15];
    widths.forEach((w,i)=>{ws.getColumn(i+1).width=w});
    try{
      const res=await fetch(LOGO_URL);
      if(res.ok){const id=wb.addImage({buffer:await res.arrayBuffer(),extension:'png'});ws.addImage(id,{tl:{col:0.1,row:0.1},ext:{width:62,height:44}})}
    }catch(_error){/* sin logo */}
    ws.mergeCells('C1:J1');ws.mergeCells('C2:J2');ws.mergeCells('C3:J3');
    ws.getCell('C1').value='Prosercom · Operaciones';ws.getCell('C1').font={name:FONT,size:11,bold:true,color:{argb:GREY}};
    ws.getCell('C2').value=`Costo unitario · ${parsed.supplierName||'Factura'}${parsed.folio?` Nº ${parsed.folio}`:''}`;ws.getCell('C2').font={name:FONT,size:18,bold:true,color:{argb:BLUE}};
    ws.getCell('C3').value=`${parsed.issueDate?`Emitida el ${dmy(parsed.issueDate)} · `:''}Valores en pesos chilenos NETOS (sin IVA) · el costo con ILA es aproximado`;ws.getCell('C3').font={name:FONT,size:10.5,color:{argb:GREY}};
    ws.getRow(2).height=30;
    for(let col=1;col<=10;col++)ws.getCell(3,col).border={bottom:{style:'medium',color:{argb:BLUE}}};

    const headers=['Código','Producto','Cant.','Unid. por pack','Unidades','Neto línea','Costo por pack (neto)','Costo unidad sin ILA','ILA asignado (aprox.)','Costo unidad con ILA (aprox.)'];
    const hr=5;
    ws.getRow(hr).height=42;
    headers.forEach((text,i)=>{
      const cell=ws.getCell(hr,i+1);cell.value=text;
      cell.font={name:FONT,size:10,bold:true,color:{argb:'FFFFFFFF'}};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:BLUE}};
      cell.alignment={vertical:'middle',horizontal:i<2?'left':'center',wrapText:true};
    });
    const first=hr+1,last=hr+c.lines.length;
    c.lines.forEach((line,index)=>{
      const r=first+index;
      const values=[line.code,line.name,line.qty,line.pack,{formula:`C${r}*D${r}`},line.amount,{formula:`F${r}/C${r}`},{formula:`F${r}/E${r}`},line.tax,{formula:`(F${r}+I${r})/E${r}`}];
      values.forEach((value,i)=>{
        const cell=ws.getCell(r,i+1);cell.value=value;
        cell.font={name:FONT,size:10,color:{argb:INK},bold:i===7||i===9};
        cell.border={bottom:{style:'thin',color:{argb:LINE}}};
        if(index%2)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ZEBRA}};
        if(i>=5)cell.numFmt=i===7||i===9?CLP1:CLP;
        if(i>=2&&i<=4)cell.alignment={horizontal:'center'};
      });
    });
    const tr=last+1;
    ws.getCell(tr,2).value='Total';
    [[6,`SUM(F${first}:F${last})`],[9,`SUM(I${first}:I${last})`]].forEach(([col,formula])=>{ws.getCell(tr,col).value={formula};ws.getCell(tr,col).numFmt=CLP});
    for(let col=1;col<=10;col++){const cell=ws.getCell(tr,col);cell.font={name:FONT,size:10.5,bold:true,color:{argb:BLUE}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:SOFT}};cell.border={top:{style:'thin',color:{argb:BLUE}}}}

    let r=tr+2;
    ws.getCell(r,2).value='Conciliación con la factura';ws.getCell(r,2).font={name:FONT,size:12,bold:true,color:{argb:BLUE}};r++;
    const recon=[
      ['Monto neto de la factura (suma de «Neto línea»)',{formula:`F${tr}`}],
      ['Impuesto adicional (ILA o similar)',c.extraTax],
      ['IVA 19% (crédito fiscal: NO es costo)',{formula:`ROUND(F${r}*0.19,0)`}],
      ['Total según la factura',{formula:`F${r}+F${r+1}+F${r+2}`}],
      ['COSTO REAL de esta compra, sin IVA',{formula:`F${r}+F${r+1}`}],
      ['Costo real sobre el neto de la factura',{formula:`F${r+4}/F${r}-1`}]
    ];
    recon.forEach(([label,value],i)=>{
      const row=r+i;
      ws.mergeCells(row,2,row,5);
      ws.getCell(row,2).value=label;ws.getCell(row,2).font={name:FONT,size:10.5,bold:i===4,color:{argb:INK}};
      const cell=ws.getCell(row,6);cell.value=value;cell.numFmt=i===5?'0.0%':CLP;cell.font={name:FONT,size:10.5,bold:i===4,color:{argb:i===4?BLUE:INK}};
      for(let col=2;col<=6;col++)ws.getCell(row,col).border={bottom:{style:'thin',color:{argb:LINE}}};
    });
    r+=recon.length+1;
    ws.mergeCells(r,2,r+2,10);
    [0,1,2].forEach(offset=>{ws.getRow(r+offset).height=24});
    const note=ws.getCell(r,2);
    note.value='«Neto línea» = cantidad × precio − descuento + recargo (ya incluye el recargo/flete y es la base del IVA). El impuesto adicional solo viene como total al pie de la factura: aquí se reparte en proporción al neto entre las líneas marcadas, así que el total cuadra pero el valor por producto es una aproximación. El «Costo unidad sin ILA» es exacto.';
    note.font={name:FONT,size:9.5,italic:true,color:{argb:GREY}};note.alignment={wrapText:true,vertical:'top'};

    const buffer=await wb.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    const safe=String(parsed.supplierName||'factura').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
    link.href=url;link.download=`Costo_unitario_${safe}${parsed.folio?`_${parsed.folio}`:''}.xlsx`;link.style.display='none';
    document.body.appendChild(link);link.click();
    setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},1500);
    toast('Excel generado.');
  }catch(error){
    S.message=error?.message||'No se pudo generar el Excel.';
  }finally{S.busy=false;render()}
}

/* -------------------------------------------------------------- eventos */
function onClick(event){
  const button=event.target.closest('[data-ic]');
  if(!button)return;
  if(button.dataset.ic==='again'){S.parsed=null;S.message='';render()}
  if(button.dataset.ic==='excel')download();
}
function onChange(event){
  const target=event.target;
  if(target.id==='icFile'){handleFile(target.files&&target.files[0]);target.value='';return}
  if(target.dataset.icPack!==undefined){
    const value=Math.max(1,Math.round(Number(target.value)||1));
    S.packs[Number(target.dataset.icPack)]=value;render();return;
  }
  if(target.dataset.icTax!==undefined){S.flags[Number(target.dataset.icTax)]=target.checked;render()}
}
function init(){
  const section=$('invcost');
  if(!section)return;
  section.addEventListener('click',onClick);
  section.addEventListener('change',onChange);
  section.addEventListener('dragover',event=>{if(!S.parsed&&event.target.closest('#icDrop')){event.preventDefault();if(!S.over){S.over=true;$('icDrop')?.classList.add('over')}}});
  section.addEventListener('dragleave',event=>{if(event.target.closest('#icDrop')){S.over=false;$('icDrop')?.classList.remove('over')}});
  section.addEventListener('drop',event=>{
    if(!event.target.closest('#icDrop'))return;
    event.preventDefault();S.over=false;
    handleFile(event.dataTransfer?.files?.[0]);
  });
  let was=false;
  const sync=()=>{
    const active=section.classList.contains('active');
    if(active&&!was)render();
    was=active;
  };
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
  sync();
}
window.InvoiceCostUI={init,render,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
