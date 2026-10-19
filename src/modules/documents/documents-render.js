/* Convierte un documento (lista de bloques de documents-data.js) a HTML: vista previa en pantalla y hoja para
   imprimir o guardar como PDF, con el membrete de la empresa. Sin dependencias del DOM. */
(function(root){
'use strict';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function runHtml(run,highlight){
  const text=esc(run.text);
  let out=run.b?`<b>${text}</b>`:text;
  if(run.f&&highlight)out=`<span class="dc-hl${run.empty?' empty':''}">${out}</span>`;
  return out;
}
const runsHtml=(runs,highlight)=>(runs||[]).map(run=>runHtml(run,highlight)).join('');

function blockHtml(block,highlight){
  switch(block.t){
    case 'title':return `<h2 class="dc-title">${esc(block.text)}</h2>`;
    case 'heading':return `<h3 class="dc-heading">${esc(block.text)}</h3>`;
    case 'p':return `<p class="dc-p${block.align?` al-${block.align}`:''}${block.indent?' in':''}"${block.after!==undefined?` style="margin-bottom:${block.after}px"`:''}>${runsHtml(block.runs,highlight)}</p>`;
    case 'amounts':return `<table class="dc-amounts"><tbody>${block.rows.map(row=>`<tr class="${row.bold?'tot':''}"><td>${esc(row.label)}</td><td>${esc(row.amount)}</td></tr>`).join('')}</tbody></table>`;
    case 'sign':return `<div class="dc-sign cols-${block.cols.length}">${block.cols.map(col=>`<div><span class="line"></span>${col.filter(Boolean).map((line,i)=>i===0?`<b>${esc(line)}</b>`:`<span>${esc(line)}</span>`).join('')}</div>`).join('')}</div>`;
    case 'spacer':return `<div style="height:${block.h||10}px"></div>`;
    case 'break':return '<div class="dc-break"></div>';
    default:return '';
  }
}

function letterheadHtml(company,logoUrl){
  return `<div class="dc-lh">${logoUrl?`<img src="${esc(logoUrl)}" alt="${esc(company.name)}">`:'<span></span>'}<div class="dc-co"><b>${esc(company.name)}</b><span>RUT ${esc(company.rut)}</span><span>${esc(company.address)} · ${esc(company.city)}</span></div></div>`;
}
function footerHtml(company,title){
  return `<div class="dc-foot"><span>${esc(company.name)} · RUT ${esc(company.rut)} · ${esc(company.address)}, ${esc(company.city)}</span><span>${esc(title)}</span></div>`;
}

// Contenido de la hoja (membrete + bloques + pie) para la vista previa en pantalla.
function pageHtml(doc,{company,logoUrl,highlight=true}={}){
  return `${letterheadHtml(company,logoUrl)}<div class="dc-body">${doc.blocks.map(block=>blockHtml(block,highlight)).join('')}</div>${footerHtml(company,doc.title)}`;
}

const PAGE_CSS=`
.dc-lh{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #0f4c9c;padding-bottom:10px;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif}
.dc-lh img{width:64px;height:auto}.dc-co{text-align:right;font-size:10.5px;color:#52607a;line-height:1.5;display:grid}.dc-co b{color:#0f4c9c;font-size:13px}
.dc-title{text-align:center;letter-spacing:.14em;font-size:14.5px;margin:6px 0 14px;font-family:Arial,Helvetica,sans-serif;color:#0f4c9c}
.dc-heading{text-align:center;letter-spacing:.14em;font-size:14px;margin:4px 0 12px;font-family:Arial,Helvetica,sans-serif;color:#0f4c9c}
.dc-p{margin:0 0 8px}.dc-p.in{margin-left:22px}.al-justify{text-align:justify}.al-right{text-align:right}.al-center{text-align:center}
.dc-amounts{border-collapse:collapse;margin:2px 0 8px 22px;min-width:60%}.dc-amounts td{padding:1px 22px 1px 0}.dc-amounts td:last-child{text-align:right;padding-right:0;white-space:nowrap}.dc-amounts tr.tot td{font-weight:bold;border-top:1px solid #555}
.dc-sign{display:grid;gap:46px;margin-top:34px;text-align:center;font-size:.92em;page-break-inside:avoid;break-inside:avoid}.dc-sign.cols-1{grid-template-columns:1fr;justify-items:center;width:50%;margin-left:25%}.dc-sign.cols-2{grid-template-columns:1fr 1fr}
.dc-sign>div{display:grid;gap:1px}.dc-sign .line{display:block;border-top:1px solid #555;margin-bottom:4px}
.dc-foot{margin-top:24px;border-top:1px solid #cfd6e6;padding-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#7a869c;display:flex;justify-content:space-between;gap:12px}
.dc-break{page-break-after:always;break-after:page;height:0}
.dc-hl.empty{color:#9aa4b8}`;

// Documento completo listo para imprimir (hoja carta). El navegador ofrece «Guardar como PDF».
function printHtml(doc,{company,logoUrl}={}){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(doc.fileName||doc.title)}</title><style>
@page{size:Letter;margin:15mm 20mm 18mm}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:"Times New Roman",Times,serif;font-size:10.8pt;line-height:1.38;color:#111}
${PAGE_CSS}
.dc-foot{position:fixed;left:0;right:0;bottom:0;margin:0;background:#fff}
.dc-body{padding-bottom:26px}
</style></head><body>${letterheadHtml(company,logoUrl)}<div class="dc-body">${doc.blocks.map(block=>blockHtml(block,false)).join('')}</div>${footerHtml(company,doc.title)}</body></html>`;
}

const api={pageHtml,printHtml,PAGE_CSS,esc};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.DocumentRender=api;
})(typeof window!=='undefined'?window:globalThis);
