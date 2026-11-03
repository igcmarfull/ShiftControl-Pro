/* Análisis de ventas: lectura del «Reporte de Transacciones Realizadas» del POS y búsqueda de patrones.
   Funciones puras, sin DOM ni red: la pantalla (sales-analysis.js) lee el Excel y llama a parse() y analyze().
   Las alertas son indicios para revisar, no pruebas: una venta redonda o repetida puede ser perfectamente normal. */
(function(root){
'use strict';

const LEVEL_RANK={high:0,mid:1,info:2};
const DEFAULTS={minRepeat:3,share:40,minOperatorSales:5,roundPct:70,roundMin:5,roundStep:10000,sameDay:3,reissueMinutes:15};

const norm=text=>String(text??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
const num=value=>{
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  const n=Number(String(value??'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n)?n:0;
};
const pad=n=>String(n).padStart(2,'0');
const isoOf=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
function addDays(iso,days){
  const date=new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate()+days);
  return isoOf(date.getFullYear(),date.getMonth()+1,date.getDate());
}

/* Fecha y hora de una celda: texto «dd/mm/aaaa hh:mm:ss» o Date. */
function parseDateTime(value){
  if(value instanceof Date&&!isNaN(value)){
    return {date:isoOf(value.getFullYear(),value.getMonth()+1,value.getDate()),minutes:value.getHours()*60+value.getMinutes()};
  }
  const m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(String(value??'').trim());
  if(!m)return null;
  return {date:isoOf(m[3],m[2],m[1]),minutes:Number(m[4]||0)*60+Number(m[5]||0)};
}
const timeOf=minutes=>`${pad(Math.floor(minutes/60))}:${pad(minutes%60)}`;

/* «781213950 - NOMBRE SPA» → {rut, name}. */
function parseClient(text){
  const raw=String(text??'').trim();
  const m=/^([0-9][0-9.]*-?[0-9kK])\s+-\s+(.+)$/.exec(raw)||/^([0-9][0-9.]*-?[0-9kK])\s*-\s*(\D.*)$/.exec(raw);
  if(m)return {rut:m[1].replace(/\./g,''),name:m[2].trim()};
  return {rut:'',name:raw};
}

/* rows: filas del Excel como arreglos (sheet_to_json con header:1). */
function parse(rows){
  const list=Array.isArray(rows)?rows:[];
  const headerAt=list.findIndex(row=>row&&row.some(cell=>norm(cell).startsWith('fecha trans'))&&row.some(cell=>norm(cell)==='operador')&&row.some(cell=>norm(cell)==='cliente'));
  if(headerAt<0)return {ok:false,error:'No reconozco este archivo. Sube el «Reporte de Transacciones Realizadas» tal como sale del POS.',transactions:[]};
  const head=list[headerAt].map(norm);
  const at=(...names)=>head.findIndex(cell=>names.includes(cell));
  const col={
    date:head.findIndex(cell=>cell.startsWith('fecha trans')),receipt:at('nro de comprobante'),terminal:at('terminal'),
    client:at('cliente'),operator:at('operador'),total:head.findIndex(cell=>cell.includes('total ticket')),
    iva:at('$iva'),cancelled:at('cancelada'),kind:at('tipo trx')
  };
  if(col.total<0)return {ok:false,error:'El archivo no trae la columna «$Total ticket».',transactions:[]};
  const transactions=[];
  let nonSale=0;
  let noDate=0;
  list.slice(headerAt+1).forEach(row=>{
    if(!row||!row.some(cell=>cell!==null&&cell!==''))return;
    const operator=String(row[col.operator]??'').trim();
    if(!operator)return;
    const kind=col.kind>=0?norm(row[col.kind]):'sale';
    if(kind&&kind!=='sale'){nonSale++;return}
    const when=parseDateTime(row[col.date]);
    if(!when){noDate++;return}
    const client=parseClient(row[col.client]);
    transactions.push({
      index:transactions.length,date:when.date,minutes:when.minutes,time:timeOf(when.minutes),
      receipt:String(row[col.receipt]??'').trim(),terminal:row[col.terminal]??'',
      rut:client.rut,client:client.name||'(sin cliente)',clientKey:client.rut||norm(client.name),
      operator,operatorKey:norm(operator),total:num(row[col.total]),iva:col.iva>=0?num(row[col.iva]):0,
      cancelled:col.cancelled>=0&&norm(row[col.cancelled])==='si'
    });
  });
  if(!transactions.length)return {ok:false,error:'No encontré ventas en el archivo.',transactions:[]};
  const dates=transactions.map(t=>t.date).sort();
  return {ok:true,transactions,nonSale,noDate,period:{from:dates[0],to:dates[dates.length-1]}};
}

/* Nombre del POS → trabajador de la app: todas las palabras del nombre del trabajador están en el del POS y es único. */
function suggestEmployee(operatorName,employees){
  const words=new Set(norm(operatorName).split(' ').filter(Boolean));
  const found=(employees||[]).filter(employee=>{
    const parts=norm(employee.name).split(' ').filter(Boolean);
    return parts.length>=2&&parts.every(part=>words.has(part));
  });
  return found.length===1?found[0]:null;
}

function pushAlert(alerts,alert){alerts.push({id:`a${alerts.length+1}`,...alert})}
const ref=t=>({date:t.date,time:t.time,receipt:t.receipt,client:t.client,operator:t.operator,amount:t.total});

function analyze(transactions,options={}){
  const opt={...DEFAULTS,...options};
  const ignored=new Set(opt.ignoreClients||[]);
  const sales=transactions.filter(t=>!t.cancelled);
  const cancelled=transactions.filter(t=>t.cancelled);
  const total=list=>list.reduce((sum,t)=>sum+t.total,0);
  const isRound=t=>t.total>0&&t.total%opt.roundStep===0;

  const byOperator=new Map();
  sales.forEach(t=>{
    if(!byOperator.has(t.operatorKey))byOperator.set(t.operatorKey,{operator:t.operator,key:t.operatorKey,sales:[]});
    byOperator.get(t.operatorKey).sales.push(t);
  });

  const operators=[...byOperator.values()].map(group=>{
    const byClient=new Map();
    group.sales.forEach(t=>{
      if(!byClient.has(t.clientKey))byClient.set(t.clientKey,{key:t.clientKey,client:t.client,rut:t.rut,sales:[]});
      byClient.get(t.clientKey).sales.push(t);
    });
    const clients=[...byClient.values()].map(c=>({...c,count:c.sales.length,total:total(c.sales)})).sort((a,b)=>b.total-a.total);
    const amount=total(group.sales);
    const rounds=group.sales.filter(isRound).length;
    return {operator:group.operator,key:group.key,n:group.sales.length,total:amount,clients:clients.length,rounds,
      roundPct:group.sales.length?rounds/group.sales.length*100:0,
      top:clients[0]?{client:clients[0].client,count:clients[0].count,total:clients[0].total,share:amount?clients[0].total/amount*100:0}:null,
      clientList:clients,sales:group.sales};
  }).sort((a,b)=>b.total-a.total);

  const alerts=[];

  /* 1 · Un mismo cliente con una misma operadora. */
  operators.forEach(op=>{
    op.clientList.forEach(c=>{
      if(ignored.has(c.key))return;
      const share=op.total?c.total/op.total*100:0;
      const repeated=c.count>=opt.minRepeat;
      const concentrated=op.n>=opt.minOperatorSales&&c.count>=2&&share>=opt.share;
      if(!repeated&&!concentrated)return;
      const level=repeated&&concentrated&&share>=60?'high':concentrated?'mid':'info';
      const reasons=[];
      if(repeated)reasons.push(`${c.count} ventas al mismo cliente`);
      if(concentrated)reasons.push(`${Math.round(share)} % de todo lo que vendió (${op.n} ventas)`);
      pushAlert(alerts,{level,kind:'concentracion',operator:op.operator,client:c.client,clientKey:c.key,count:c.count,amount:c.total,
        title:`${op.operator} → ${c.client}`,detail:reasons.join(' · '),refs:c.sales.map(ref)});
    });
  });

  /* 2 · Un cliente con muchas ventas el mismo día (con cualquier operadora). */
  const byDayClient=new Map();
  sales.forEach(t=>{
    const key=`${t.date}|${t.clientKey}`;
    if(!byDayClient.has(key))byDayClient.set(key,[]);
    byDayClient.get(key).push(t);
  });
  byDayClient.forEach(list=>{
    if(list.length<opt.sameDay||ignored.has(list[0].clientKey))return;
    const names=[...new Set(list.map(t=>t.operator))];
    pushAlert(alerts,{level:'info',kind:'mismo-dia',operator:names.length===1?names[0]:'',client:list[0].client,clientKey:list[0].clientKey,count:list.length,amount:total(list),
      title:`${list[0].client}: ${list.length} ventas el mismo día`,detail:`${list[0].date.split('-').reverse().join('-')} · ${names.length===1?names[0]:`${names.length} operadoras`}`,refs:list.map(ref)});
  });

  /* 3 · Operadora con casi todas las ventas en montos redondos. */
  operators.forEach(op=>{
    if(op.n<opt.roundMin||op.roundPct<opt.roundPct)return;
    pushAlert(alerts,{level:'info',kind:'redondos',operator:op.operator,client:'',count:op.rounds,amount:total(op.sales.filter(isRound)),
      title:`${op.operator}: ${Math.round(op.roundPct)} % de ventas en montos redondos`,
      detail:`${op.rounds} de ${op.n} ventas son múltiplos de $${opt.roundStep.toLocaleString('es-CL')}. Cargar montos redondos es normal; sirve para comparar con las demás.`,
      refs:op.sales.filter(isRound).map(ref)});
  });

  /* 4 · Venta anulada y emitida de nuevo con el mismo monto. */
  cancelled.forEach(c=>{
    const again=sales.find(t=>t.operatorKey===c.operatorKey&&t.total===c.total&&t.date===c.date&&t.minutes>=c.minutes&&t.minutes-c.minutes<=opt.reissueMinutes);
    pushAlert(alerts,{level:'info',kind:'anulada',operator:c.operator,client:c.client,count:1,amount:c.total,
      title:`Venta anulada: ${c.client}`,
      detail:again?`Se volvió a emitir por el mismo monto a las ${again.time}.`:'No hay una venta igual después.',refs:[ref(c)]});
  });

  /* 5 · Venta fuera del turno planificado (necesita trabajadores y planificación). */
  if(opt.plans&&opt.operatorMap&&typeof opt.shiftAt==='function'){
    const groups=new Map();
    sales.forEach(t=>{
      const employee=opt.operatorMap[t.operatorKey];
      if(!employee)return;
      const shift=opt.shiftAt(t.minutes);
      const planDate=shift.wraps&&t.minutes>=shift.start?addDays(t.date,1):t.date;
      const monthPlans=opt.plans.filter(p=>p.employeeId===employee.id&&String(p.date).startsWith(planDate.slice(0,7)));
      if(!monthPlans.length)return;
      const plan=monthPlans.find(p=>p.date===planDate);
      const code=plan?plan.code:'';
      let level='',label='';
      if(['L','V','P','X'].includes(code)){level='high';label={L:'con licencia',V:'de vacaciones',P:'con permiso',X:'con ausencia registrada'}[code]}
      else if(code==='D'||!code){level='mid';label='en su día de descanso'}
      else if(code!==shift.code){level='info';label=`en el turno ${shift.code} (tenía el ${code})`}
      if(!level)return;
      const key=`${t.operatorKey}|${label}`;
      if(!groups.has(key))groups.set(key,{level,label,operator:t.operator,list:[]});
      groups.get(key).list.push(t);
    });
    groups.forEach(g=>pushAlert(alerts,{level:g.level,kind:'turno',operator:g.operator,client:'',count:g.list.length,amount:total(g.list),
      title:`${g.operator} vendió ${g.label}`,
      detail:`${g.list.length} ${g.list.length===1?'venta':'ventas'} que no coinciden con la planificación.${g.level==='info'?' Puede ser un reemplazo.':''}`,refs:g.list.map(ref)}));
  }

  alerts.sort((a,b)=>LEVEL_RANK[a.level]-LEVEL_RANK[b.level]||b.amount-a.amount);

  /* Clientes con más compras. */
  const byClient=new Map();
  sales.forEach(t=>{
    if(!byClient.has(t.clientKey))byClient.set(t.clientKey,{client:t.client,rut:t.rut,sales:[]});
    byClient.get(t.clientKey).sales.push(t);
  });
  const clients=[...byClient.values()].map(c=>{
    const ops=new Map();
    c.sales.forEach(t=>ops.set(t.operator,(ops.get(t.operator)||0)+1));
    return {client:c.client,rut:c.rut,n:c.sales.length,total:total(c.sales),operators:[...ops.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)};
  }).sort((a,b)=>b.total-a.total);

  const dates=transactions.map(t=>t.date).sort();
  return {
    summary:{n:sales.length,total:total(sales),clients:clients.length,operators:operators.length,cancelled:cancelled.length,
      roundPct:sales.length?sales.filter(isRound).length/sales.length*100:0,from:dates[0]||'',to:dates[dates.length-1]||''},
    operators:operators.map(({sales:_s,clientList:_c,...rest})=>rest),
    clients,alerts,options:opt
  };
}

const api={parse,analyze,suggestEmployee,parseClient,parseDateTime,addDays,norm,DEFAULTS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SalesAnalysisCalc=api;
})(typeof window!=='undefined'?window:globalThis);
