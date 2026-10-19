/* Reportes mensuales en Excel (.xlsx) con formato Prosercom.
   Reutiliza los datos de los reportes de la página Reportes (accountingRows, monthlyOperationalRows y
   reportPrintContext); no calcula nada propio. Cada pestaña exporta su propio libro:
   «Contabilidad» (reports.financial) u «Operativo» (reports.operational; jornadas y monto solo con reports.financial).
   ExcelJS se carga solo al exportar, igual que SheetJS en la importación de ventas. */
(function(){
'use strict';

const EXCELJS_URL='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const LOGO_URL='src/assets/prosercom-logo.png';
const BLUE='FF0F4C9C',BLUE_SOFT='FFE8EFFB',GREY='FF667085',INK='FF14213D',LINE='FFD9DFEB',ZEBRA='FFF6F8FC';
const FONT='Calibri';
const CLP='"$"#,##0';

let libPromise=null;
function loadLib(){
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

const can=permission=>typeof window.canUseAppPermission==='function'?window.canUseAppPermission(permission):false;
const say=message=>{if(typeof window.toast==='function')window.toast(message)};

// 12345678-9 / 12.345.678-9 → 12.345.678-9. Vacío si no tiene el largo mínimo.
function formatRut(value){
  const clean=String(value||'').replace(/[^0-9kK]/g,'').toUpperCase();
  if(clean.length<2)return '';
  const body=clean.slice(0,-1).replace(/^0+/,'')||'0';
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}-${clean.slice(-1)}`;
}

const fill=argb=>({type:'pattern',pattern:'solid',fgColor:{argb}});
const colName=n=>{let s='';while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};

async function loadLogo(workbook){
  try{
    const response=await fetch(LOGO_URL);
    if(!response.ok)return null;
    return workbook.addImage({buffer:await response.arrayBuffer(),extension:'png'});
  }catch(_error){return null}
}

function setupSheet(ws,{title,subtitle,columns,logoId}){
  const total=columns.length;
  ws.views=[{state:'frozen',xSplit:1,ySplit:5,showGridLines:false}];
  columns.forEach((col,index)=>{ws.getColumn(index+1).width=col.width});
  [1,2,3].forEach(row=>{ws.getRow(row).height=row===2?32:22});
  ws.mergeCells(1,3,1,total);ws.mergeCells(2,3,2,total);ws.mergeCells(3,3,3,total);
  ws.getCell(1,3).value='Prosercom · Operaciones';
  ws.getCell(1,3).font={name:FONT,size:11,bold:true,color:{argb:GREY}};
  ws.getCell(2,3).value=title;
  ws.getCell(2,3).font={name:FONT,size:20,bold:true,color:{argb:BLUE}};
  ws.getCell(3,3).value=subtitle;
  ws.getCell(3,3).font={name:FONT,size:10.5,color:{argb:GREY}};
  for(let c=1;c<=total;c++)ws.getCell(3,c).border={bottom:{style:'medium',color:{argb:BLUE}}};
  if(logoId!=null)ws.addImage(logoId,{tl:{col:0.1,row:0.1},ext:{width:62,height:44}});
  const head=ws.getRow(5);
  head.height=columns.some(col=>col.header.length>12)?42:28;
  columns.forEach((col,index)=>{
    const cell=head.getCell(index+1);
    cell.value=col.header;
    cell.font={name:FONT,size:10.5,bold:true,color:{argb:'FFFFFFFF'}};
    cell.fill=fill(BLUE);
    cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
  });
  ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'5:5',
    margins:{left:0.4,right:0.4,top:0.5,bottom:0.8,header:0.3,footer:0.3}};
  ws.headerFooter.oddFooter='&L&"Calibri"&9Prosercom · Operaciones&C&"Calibri"&9&D&R&"Calibri"&9Página &P de &N';
}

// rows: matrices de valores; kinds: 'text' | 'center' | 'int' | 'time' | 'money' | 'formula:<fx>' por columna.
function fillTable(ws,columns,rows){
  const first=6,last=first+rows.length-1;
  rows.forEach((values,index)=>{
    const r=first+index,row=ws.getRow(r);
    row.height=20;
    columns.forEach((col,ci)=>{
      const cell=row.getCell(ci+1);
      cell.value=col.formula?{formula:col.formula(r),result:values[ci]}:values[ci];
      cell.font={name:FONT,size:10.5,color:{argb:INK},bold:Boolean(col.bold)};
      cell.alignment={horizontal:col.align||'center',vertical:'middle'};
      cell.border={bottom:{style:'thin',color:{argb:LINE}}};
      if(index%2===1)cell.fill=fill(ZEBRA);
      if(col.numFmt)cell.numFmt=col.numFmt;
    });
  });
  const totalRow=ws.getRow(last+1);
  totalRow.height=22;
  columns.forEach((col,ci)=>{
    const cell=totalRow.getCell(ci+1);
    if(ci===0)cell.value='Total';
    else if(col.total){
      const letter=colName(ci+1);
      const result=rows.reduce((sum,values)=>sum+Number(values[ci]||0),0);
      const range=`${letter}${first}:${letter}${last}`;
      cell.value={formula:col.total==='time'?`SUM(${range})`:`SUBTOTAL(109,${range})`,result};
      cell.numFmt=col.total==='time'?'[h]:mm':col.numFmt;
    }
    cell.font={name:FONT,size:11,bold:true,color:{argb:BLUE}};
    cell.fill=fill(BLUE_SOFT);
    cell.border={top:{style:'medium',color:{argb:BLUE}}};
    cell.alignment={horizontal:ci===0?'left':(col.align||'center'),vertical:'middle'};
  });
  ws.autoFilter={from:{row:5,column:1},to:{row:Math.max(last,5),column:columns.length}};
  return {first,last,totalRow:last+1};
}

function note(ws,row,text){
  const cell=ws.getCell(row,1);
  cell.value=text;
  cell.font={name:FONT,size:9,italic:true,color:{argb:GREY}};
}

function highlight(ws,ref,{color,bg}){
  ws.addConditionalFormatting({ref,rules:[{type:'cellIs',operator:'greaterThan',formulae:[0],
    style:{font:{bold:true,color:{argb:color}},fill:{type:'pattern',pattern:'solid',bgColor:{argb:bg}}}}]});
}

function accountingSheet(workbook,ctx,subtitle,logoId){
  const employees=window.EmployeeModule?.getAll?.()||[];
  const byId=new Map(employees.map(worker=>[worker.id,worker]));
  const rows=(window.accountingRows?window.accountingRows():[]).map(row=>{
    const worker=byId.get(row.employeeId)||{};
    const minutes=Number(row.lateMinutes||0);
    return [row.name||'',formatRut(worker.rut),worker.role||'',worker.area||'',row.attendance,row.absences,row.sundays,
      row.holidays,row.medical,row.vacations,minutes/1440];
  });
  const columns=[
    {header:'Trabajador',width:26,align:'left'},{header:'RUT',width:14},{header:'Cargo',width:17},{header:'Área',width:15},
    {header:'Días asistidos',width:10,total:true,numFmt:'0'},{header:'Ausencias',width:10,total:true,numFmt:'0'},
    {header:'Domingos trabajados',width:12,total:true,numFmt:'0'},{header:'Feriados trabajados',width:12,total:true,numFmt:'0'},
    {header:'Licencia médica (días)',width:13,total:true,numFmt:'0'},{header:'Vacaciones (días)',width:12,total:true,numFmt:'0'},
    {header:'Atraso (h:mm)',width:12,total:'time',numFmt:'h:mm'}
  ];
  const ws=workbook.addWorksheet('Contabilidad');
  setupSheet(ws,{title:'Reporte para contabilidad',subtitle,columns,logoId});
  const {first,last,totalRow}=fillTable(ws,columns,rows);
  if(rows.length){
    highlight(ws,`F${first}:F${last}`,{color:'FFB42318',bg:'FFFDE8E6'});
    highlight(ws,`I${first}:I${last}`,{color:'FFA15C00',bg:'FFFFF2DC'});
  }
  note(ws,totalRow+2,'Días asistidos = presentes + atrasados. El total se recalcula al filtrar.');
  return rows.length;
}

function operationalSheet(workbook,ctx,subtitle,logoId,financial){
  const report=window.monthlyOperationalRows?window.monthlyOperationalRows():{rows:[[]]};
  const data=report.rows.slice(1);
  // Posiciones de monthlyOperationalRows: 0-3 datos, 4-6 turnos, 7 descansos, 8-13 estados, 14 jornadas, 15 monto (solo financiero).
  const rows=data.map(r=>{
    const out=[r[0],formatRut(r[1]),r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],
      Number(r[4]||0)+Number(r[5]||0)+Number(r[6]||0)];
    if(financial)out.push(Number(r[14]||0),Number(r[15]||0));
    return out;
  });
  const columns=[
    {header:'Trabajador',width:26,align:'left'},{header:'RUT',width:14},{header:'Cargo',width:17},{header:'Área',width:15},
    {header:'Turno A',width:9,total:true,numFmt:'0'},{header:'Turno B',width:9,total:true,numFmt:'0'},
    {header:'Turno C',width:9,total:true,numFmt:'0'},{header:'Descansos',width:11,total:true,numFmt:'0'},
    {header:'Presente',width:10,total:true,numFmt:'0'},{header:'Atrasado',width:10,total:true,numFmt:'0'},
    {header:'Ausente',width:10,total:true,numFmt:'0'},{header:'Licencia',width:10,total:true,numFmt:'0'},
    {header:'Vacaciones',width:12,total:true,numFmt:'0'},{header:'Permisos',width:10,total:true,numFmt:'0'},
    {header:'Total turnos',width:12,total:true,numFmt:'0',bold:true,formula:r=>`E${r}+F${r}+G${r}`}
  ];
  if(financial){
    columns.push({header:'Jornadas adicionales',width:12,total:true,numFmt:'0'});
    columns.push({header:'Monto pendiente',width:15,align:'right',total:true,numFmt:CLP});
  }
  const ws=workbook.addWorksheet('Operativo');
  setupSheet(ws,{title:'Reporte operativo',subtitle,columns,logoId});
  const {totalRow}=fillTable(ws,columns,rows);
  note(ws,totalRow+2,'Total turnos = turnos A + B + C planificados. Presente incluye las jornadas adicionales trabajadas.');
  return rows.length;
}

// kind: 'operational' (hoja Operativo) o 'accounting' (hoja Contabilidad), igual que los CSV de cada pestaña.
async function download(kind){
  const accounting=kind==='accounting';
  const financial=can('reports.financial');
  if(accounting&&!financial){say('Solo el administrador exporta el reporte para contabilidad.');return false}
  if(!accounting&&!can('reports.operational')){say('Tu perfil no puede exportar el reporte operativo.');return false}
  if(typeof window.reportPrintContext!=='function'){say('Los reportes todavía no están disponibles.');return false}
  say('Generando Excel…');
  let ExcelJS;
  try{ExcelJS=await loadLib()}catch(error){say(error.message);return false}
  try{
    const ctx=window.reportPrintContext();
    const subtitle=`${ctx.monthLabel} · ${ctx.station} · Período ${ctx.period.replace(/\//g,'-')} · Generado el ${ctx.generated} por ${ctx.generatedBy}`;
    const workbook=new ExcelJS.Workbook();
    workbook.creator='Prosercom · Operaciones';
    workbook.created=new Date();
    const logoId=await loadLogo(workbook);
    if(accounting)accountingSheet(workbook,ctx,subtitle,logoId);
    else operationalSheet(workbook,ctx,subtitle,logoId,financial);
    const buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    const name=`${accounting?'reporte_contabilidad':'reporte_operativo'}_${ctx.year}_${ctx.month}.xlsx`;
    link.href=url;link.download=name;link.style.display='none';
    document.body.appendChild(link);link.click();
    setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},500);
    if(typeof window.log==='function'){
      window.log(`Reporte ${accounting?'de contabilidad':'operativo'} en Excel exportado para ${ctx.year}-${ctx.month}`);
      if(typeof window.save==='function')window.save();
      if(typeof window.renderAudit==='function')window.renderAudit();
    }
    say(`Excel descargado: ${name}`);
    return true;
  }catch(error){
    console.warn('Reporte en Excel',error);
    say('No se pudo generar el Excel.');
    return false;
  }
}

window.ReportExcel=Object.freeze({download,formatRut});
})();
