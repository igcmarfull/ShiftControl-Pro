(function(){
'use strict';

// Pantalla «Documentos» (solo administrador): biblioteca de modelos (contrato, finiquito, cartas, constancias).
// Se elige un modelo, se completa un formulario y se descarga en PDF (imprimir → «Guardar como PDF») o en Word.
// No guarda nada: el documento se arma en el navegador. Los modelos y el cálculo están en documents-data.js, el HTML
// en documents-render.js. Solo recuerda en este navegador quién firma por la empresa (localStorage).

const DOCX_URL='https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
const LOGO_URL='src/assets/prosercom-logo.png';
const PREFS_KEY='shiftcontrol.documents.prefs';
const $=id=>document.getElementById(id);
const Data=()=>window.DocumentData;
const Render=()=>window.DocumentRender;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const isAdmin=()=>window.ShiftControlPermissions?.getRole?.()==='ADMIN';
const toast=text=>{if(typeof window.showToast==='function')window.showToast(text)};
const norm=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

const S={view:'library',cat:'Todos',q:'',tpl:null,values:{},auto:new Set(),employeeId:'',busy:false,message:''};

/* ------------------------------------------------------------ preferencias */
function loadPrefs(){try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}}catch(_error){return {}}}
function savePrefs(){
  try{
    const prefs=loadPrefs();
    (S.tpl?.fields||[]).filter(field=>field.remember).forEach(field=>{prefs[field.key]=S.values[field.key]||''});
    localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  }catch(_error){/* sin almacenamiento */}
}
function employees(){
  const list=(window.state&&Array.isArray(window.state.employees))?window.state.employees:[];
  return list.filter(employee=>employee&&employee.name&&employee.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
}

/* ------------------------------------------------------------ documento */
function currentDoc(){
  if(!S.tpl)return null;
  const values={...S.values};
  return S.tpl.build(values);
}
const company=()=>Data().COMPANY;
const absoluteLogo=()=>new URL(LOGO_URL,window.location.href).href;

/* ------------------------------------------------------------ pantalla */
function libraryHtml(){
  const D=Data();
  const q=norm(S.q);
  const list=D.TEMPLATES.filter(t=>(S.cat==='Todos'||t.cat===S.cat)&&(!q||norm(`${t.name} ${t.desc} ${t.cat}`).includes(q)));
  const chips=['Todos',...D.CATEGORIES].map(c=>`<button type="button" class="dc-chip${S.cat===c?' on':''}" data-dc="cat:${esc(c)}">${esc(c)}</button>`).join('');
  const cards=list.map(t=>`<div class="dc-card"><div class="dc-ico">${esc(t.icon)}</div><span class="dc-tag">${esc(t.cat)}</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><div class="dc-row"><span class="dc-tag">PDF · Word</span><button type="button" class="dc-btn pri" data-dc="use:${esc(t.id)}">Usar modelo</button></div></div>`).join('');
  return `<div class="dc-head"><h1>Documentos</h1><p>Modelos de contratos, finiquitos, cartas y constancias con el membrete de Prosercom. Elige un modelo, completa los datos y descárgalo en PDF o Word, listo para imprimir y firmar.</p></div>
    <div class="dc-tools"><input type="search" id="dcSearch" placeholder="Buscar un modelo…" value="${esc(S.q)}" autocomplete="off">${chips}</div>
    <div class="dc-cards">${cards||'<p class="dc-empty">No hay modelos que coincidan.</p>'}</div>
    <p class="dc-note">Los modelos son un punto de partida. Un asesor laboral debería revisar una vez cada uno antes de darlo por oficial. La app genera el documento: la firma y la ratificación (notaría o Inspección del Trabajo) siguen siendo trámite tuyo. Nada de lo que escribes aquí se guarda en el servidor.</p>`;
}
function fieldHtml(field){
  const value=S.values[field.key];
  const auto=S.auto.has(field.key);
  const id=`dcf-${field.key}`;
  const cls=`dc-in${auto?' auto':''}`;
  let control;
  if(field.type==='textarea')control=`<textarea id="${id}" class="${cls}" rows="3" data-dcf="${field.key}">${esc(value)}</textarea>`;
  else if(field.type==='select')control=`<select id="${id}" class="${cls}" data-dcf="${field.key}">${(field.options||[]).map(option=>{const o=typeof option==='string'?{value:option,label:option}:option;return `<option value="${esc(o.value)}"${o.value===value?' selected':''}>${esc(o.label)}</option>`}).join('')}</select>`;
  else if(field.type==='check')return `<label class="dc-check full"><input type="checkbox" id="${id}" data-dcf="${field.key}"${value?' checked':''}> ${esc(field.label)}</label>`;
  else{
    const type=field.type==='date'?'date':'text';
    const mode=field.type==='money'||field.type==='number'?' inputmode="numeric"':'';
    const shown=field.type==='money'&&value!==''&&value!==undefined?Data().toNum(value).toLocaleString('es-CL'):esc(value);
    control=`<input id="${id}" class="${cls}" type="${type}"${mode} value="${shown}" data-dcf="${field.key}" autocomplete="off">`;
  }
  return `<label class="dc-f${field.full?' full':''}">${esc(field.label)}${auto?' <em>desde Trabajadores</em>':''}${control}${field.hint?`<small>${esc(field.hint)}</small>`:''}</label>`;
}
function formFieldsHtml(){
  return S.tpl.fields.filter(field=>Data().visible(field,S.values)).map(fieldHtml).join('');
}
function formHtml(){
  const t=S.tpl;
  const hasWorker=t.fields.some(field=>field.auto);
  const list=employees();
  const picker=hasWorker?`<label class="dc-f full">Trabajador(a) de la lista<select id="dcEmp" class="dc-in" data-dc-emp="1"><option value="">Escribir a mano…</option>${list.map(employee=>`<option value="${esc(employee.id)}"${String(employee.id)===S.employeeId?' selected':''}>${esc(employee.name)}${employee.role?` · ${esc(employee.role)}`:''}</option>`).join('')}</select><small>Si eliges a alguien, se completan solos su nombre, RUT, cargo y fecha de ingreso.</small></label>`:'';
  return `<div class="dc-head"><button type="button" class="dc-btn" data-dc="back">← Volver a Documentos</button><h1>${esc(t.name)}</h1><p>Completa los datos. Lo que escribes aparece resaltado en la vista previa. Los datos que faltan quedan como línea en blanco.</p></div>
    ${S.message?`<p class="dc-err">${esc(S.message)}</p>`:''}
    <div class="dc-split"><div class="dc-form"><h3>Datos del documento</h3><div class="dc-grid" id="dcFields">${picker}${formFieldsHtml()}</div>
      <div class="dc-acts"><button type="button" class="dc-btn pri" data-dc="pdf">Imprimir / guardar PDF</button><button type="button" class="dc-btn" data-dc="docx"${S.busy?' disabled':''}>${S.busy?'Generando…':'Descargar Word'}</button></div></div>
      <div class="dc-sheetwrap"><p class="dc-pv">Vista previa · hoja carta</p><div class="dc-page" id="dcPage"></div></div></div>`;
}
function renderPreview(){
  const holder=$('dcPage');
  if(!holder||!S.tpl)return;
  holder.innerHTML=Render().pageHtml(currentDoc(),{company:company(),logoUrl:LOGO_URL,highlight:true});
}
function render(){
  const root=$('documentsRoot');
  if(!root)return;
  if(!isAdmin()){root.innerHTML='<div class="dc-empty"><b>Solo el administrador usa los documentos.</b></div>';return}
  root.innerHTML=S.view==='form'&&S.tpl?formHtml():libraryHtml();
  if(S.view==='form')renderPreview();
}

/* ------------------------------------------------------------ acciones */
function openTemplate(id){
  const tpl=Data().get(id);
  if(!tpl)return;
  S.tpl=tpl;S.view='form';S.message='';S.employeeId='';S.auto=new Set();
  S.values=Data().defaults(tpl);
  const prefs=loadPrefs();
  tpl.fields.filter(field=>field.remember&&prefs[field.key]).forEach(field=>{S.values[field.key]=prefs[field.key]});
  render();
  window.scrollTo?.({top:0});
}
function pickEmployee(id){
  S.employeeId=id;S.auto=new Set();
  const employee=employees().find(item=>String(item.id)===String(id));
  if(employee){
    const map={name:employee.name,rut:employee.rut?Data().formatRut(employee.rut):'',role:employee.role||'',start:employee.start||''};
    S.tpl.fields.filter(field=>field.auto).forEach(field=>{
      if(map[field.auto]){S.values[field.key]=map[field.auto];S.auto.add(field.key)}
    });
  }
  render();
}
function onInput(event){
  const target=event.target;
  const key=target.dataset?.dcf;
  if(!key||!S.tpl)return;
  const field=S.tpl.fields.find(item=>item.key===key);
  if(!field)return;
  let value=target.type==='checkbox'?target.checked:target.value;
  if(field.type==='money'){
    const digits=String(value).replace(/[^\d]/g,'');
    value=digits;
    target.value=digits?Number(digits).toLocaleString('es-CL'):'';
  }
  S.values[key]=value;
  if(S.auto.delete(key)){target.classList.remove('auto');target.closest('label')?.querySelector('em')?.remove()}
  if(field.remember)savePrefs();
  // Los campos que muestran u ocultan otros se vuelven a dibujar; el resto solo actualiza la vista previa.
  const affects=S.tpl.fields.some(item=>item.showIf&&item.showIf.key===key);
  if(affects&&(target.tagName==='SELECT'||target.type==='checkbox')){
    const grid=$('dcFields');
    const picker=$('dcEmp')?.closest('label')?.outerHTML||'';
    if(grid)grid.innerHTML=picker+formFieldsHtml();
  }
  renderPreview();
}

/* ---- PDF: hoja carta lista para imprimir; el navegador ofrece «Guardar como PDF» */
function printDoc(){
  const doc=currentDoc();
  if(!doc)return;
  const html=Render().printHtml(doc,{company:company(),logoUrl:absoluteLogo()});
  const frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(frame);
  const win=frame.contentWindow;
  win.document.open();win.document.write(html);win.document.close();
  const go=()=>{try{win.focus();win.print()}finally{setTimeout(()=>frame.remove(),60000)}};
  const img=win.document.querySelector('img');
  if(img&&!img.complete){img.onload=go;img.onerror=go}else setTimeout(go,60);
}

/* ---- Word */
let libPromise=null;
function loadDocx(){
  if(window.docx)return Promise.resolve(window.docx);
  if(!libPromise){
    libPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=DOCX_URL;
      script.onload=()=>resolve(window.docx);
      script.onerror=()=>{libPromise=null;reject(new Error('No se pudo cargar el generador de Word. Revisa tu conexión.'))};
      document.head.appendChild(script);
    });
  }
  return libPromise;
}
async function logoData(){
  try{
    const response=await fetch(LOGO_URL);
    if(!response.ok)return null;
    const buffer=await response.arrayBuffer();
    const size=await new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve({w:image.naturalWidth,h:image.naturalHeight});
      image.onerror=()=>resolve({w:3,h:2});
      image.src=URL.createObjectURL(new Blob([buffer],{type:'image/png'}));
    });
    return {data:new Uint8Array(buffer),w:size.w,h:size.h};
  }catch(_error){return null}
}
function buildDocx(lib,doc,logo){
  const {Document,Paragraph,TextRun,AlignmentType,Table,TableRow,TableCell,WidthType,BorderStyle,Header,Footer,ImageRun,PageNumber,PageBreak,VerticalAlign}=lib;
  const FONT='Times New Roman',SIZE=22,BLUE='0F4C9C',GREY='667085';
  const co=company();
  const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
  const noBorders={top:none,bottom:none,left:none,right:none};
  const align={justify:AlignmentType.JUSTIFIED,right:AlignmentType.RIGHT,center:AlignmentType.CENTER};
  const runs=list=>list.map(run=>new TextRun({text:run.text,bold:!!run.b,font:FONT,size:SIZE}));
  const children=[];
  doc.blocks.forEach(block=>{
    if(block.t==='title'||block.t==='heading')children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:240},children:[new TextRun({text:block.text,bold:true,color:BLUE,font:'Arial',size:27,characterSpacing:20})]}));
    else if(block.t==='p')children.push(new Paragraph({alignment:align[block.align]||AlignmentType.LEFT,indent:block.indent?{left:440}:undefined,spacing:{after:block.after!==undefined?block.after*15:140,line:276},children:runs(block.runs)}));
    else if(block.t==='amounts')children.push(new Table({width:{size:82,type:WidthType.PERCENTAGE},indent:{size:440,type:WidthType.DXA},borders:{...noBorders,insideHorizontal:none,insideVertical:none},rows:block.rows.map(row=>new TableRow({children:[
      new TableCell({borders:{...noBorders,top:row.bold?{style:BorderStyle.SINGLE,size:6,color:'555555'}:none},width:{size:72,type:WidthType.PERCENTAGE},children:[new Paragraph({children:[new TextRun({text:row.label,bold:!!row.bold,font:FONT,size:SIZE})]})]}),
      new TableCell({borders:{...noBorders,top:row.bold?{style:BorderStyle.SINGLE,size:6,color:'555555'}:none},width:{size:28,type:WidthType.PERCENTAGE},children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:row.amount,bold:!!row.bold,font:FONT,size:SIZE})]})]})]}))}));
    else if(block.t==='sign'){
      children.push(new Paragraph({spacing:{before:420,after:0},children:[]}));
      const n=block.cols.length;
      children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{...noBorders,insideHorizontal:none,insideVertical:none},rows:[new TableRow({cantSplit:true,children:block.cols.map(col=>new TableCell({borders:noBorders,width:{size:Math.floor(100/n),type:WidthType.PERCENTAGE},verticalAlign:VerticalAlign.TOP,
        children:[new Paragraph({alignment:AlignmentType.CENTER,border:{top:{style:BorderStyle.SINGLE,size:6,color:'555555',space:4}},spacing:{before:0,after:40},children:[new TextRun({text:'',font:FONT,size:SIZE})]}),
          ...col.filter(Boolean).map((line,i)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:line,bold:i===0,font:FONT,size:21})]}))]}))})]}));
      children.push(new Paragraph({spacing:{after:160},children:[]}));
    }
    else if(block.t==='break')children.push(new Paragraph({children:[new PageBreak()]}));
    else if(block.t==='spacer')children.push(new Paragraph({spacing:{after:(block.h||10)*15},children:[]}));
  });
  const logoCell=new TableCell({borders:noBorders,width:{size:30,type:WidthType.PERCENTAGE},children:[new Paragraph({children:logo?[new ImageRun({type:'png',data:logo.data,transformation:{width:64,height:Math.round(64*logo.h/logo.w)}})]:[]})]});
  const header=new Header({children:[
    new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{...noBorders,insideHorizontal:none,insideVertical:none},rows:[new TableRow({children:[logoCell,
      new TableCell({borders:noBorders,width:{size:70,type:WidthType.PERCENTAGE},verticalAlign:VerticalAlign.CENTER,children:[
        new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:0},children:[new TextRun({text:co.name,bold:true,color:BLUE,font:'Arial',size:24})]}),
        new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:0},children:[new TextRun({text:`RUT ${co.rut}`,color:GREY,font:'Arial',size:18})]}),
        new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:0},children:[new TextRun({text:`${co.address} · ${co.city}`,color:GREY,font:'Arial',size:18})]})]})]})]}),
    new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:18,color:BLUE,space:4}},spacing:{after:120},children:[]})]});
  const footer=new Footer({children:[new Paragraph({border:{top:{style:BorderStyle.SINGLE,size:4,color:'CFD6E6',space:4}},children:[
    new TextRun({text:`${co.name} · RUT ${co.rut} · ${doc.title}`,color:GREY,font:'Arial',size:16}),
    new TextRun({text:'\tPágina ',color:GREY,font:'Arial',size:16}),new TextRun({children:[PageNumber.CURRENT],color:GREY,font:'Arial',size:16}),
    new TextRun({text:' de ',color:GREY,font:'Arial',size:16}),new TextRun({children:[PageNumber.TOTAL_PAGES],color:GREY,font:'Arial',size:16})],
    tabStops:[{type:'right',position:9300}]})]});
  return new Document({creator:co.name,title:doc.title,styles:{default:{document:{run:{font:FONT,size:SIZE}}}},
    sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1650,bottom:1200,left:1300,right:1300,header:500,footer:500}}},headers:{default:header},footers:{default:footer},children}]});
}
async function downloadDocx(){
  const doc=currentDoc();
  if(!doc||S.busy)return;
  S.busy=true;S.message='';render();
  try{
    const lib=await loadDocx();
    const logo=await logoData();
    const blob=await lib.Packer.toBlob(buildDocx(lib,doc,logo));
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=`${doc.fileName||'documento'}.docx`;link.style.display='none';
    document.body.appendChild(link);link.click();
    setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},1500);
    toast('Word generado.');
  }catch(error){
    S.message=error?.message||'No se pudo generar el Word.';
  }finally{S.busy=false;render()}
}

/* ------------------------------------------------------------ eventos */
function onClick(event){
  const button=event.target.closest('[data-dc]');
  if(!button)return;
  const [action,arg]=button.dataset.dc.split(/:(.*)/s);
  if(action==='use')openTemplate(arg);
  else if(action==='back'){S.view='library';S.tpl=null;S.message='';render()}
  else if(action==='cat'){S.cat=arg;render()}
  else if(action==='pdf')printDoc();
  else if(action==='docx')downloadDocx();
}
function init(){
  const section=$('documents');
  if(!section||!Data()||!Render())return;
  if(!$('dcPageCss')){const style=document.createElement('style');style.id='dcPageCss';style.textContent=Render().PAGE_CSS;document.head.appendChild(style)}
  section.addEventListener('click',onClick);
  section.addEventListener('input',event=>{
    if(event.target.id==='dcSearch'){
      S.q=event.target.value;
      const pos=event.target.selectionStart;
      render();
      const field=$('dcSearch');
      if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch(_error){}}
      return;
    }
    if(event.target.tagName!=='SELECT')onInput(event);
  });
  section.addEventListener('change',event=>{
    if(event.target.dataset?.dcEmp){pickEmployee(event.target.value);return}
    if(event.target.tagName==='SELECT'||event.target.type==='checkbox'||event.target.type==='date')onInput(event);
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
window.DocumentsUI={init,render,state:S,currentDoc,buildDocx,openTemplate,pickEmployee};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
