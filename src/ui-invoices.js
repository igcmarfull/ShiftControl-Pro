(function(){
  'use strict';
  // Facturas y compras: solo presentación. Envuelve renderInvoices() para mostrar el contador de cada pestaña
  // (mismos criterios de filtro que renderInvoices) y el total dentro del anillo por categoría.
  // El listado, las acciones y los permisos siguen en index.html y src/modules/invoices.
  const $=id=>document.getElementById(id);
  let original=null;

  function counts(){
    const all=window.InvoiceModule?.getAll?.()||[];
    const approved=typeof window.invoiceIsApproved==='function'?window.invoiceIsApproved:()=>true;
    const status=typeof window.invoiceDisplayStatus==='function'?window.invoiceDisplayStatus:inv=>inv.estado;
    return {
      todas:all.length,
      pendiente:all.filter(inv=>inv.estado==='pendiente'&&approved(inv)).length,
      pagada:all.filter(inv=>inv.estado==='pagada'&&approved(inv)).length,
      vencida:all.filter(inv=>status(inv)==='vencida').length,
      aprobacion:all.filter(inv=>!approved(inv)).length
    };
  }
  function compact(text){
    const value=Number(String(text||'').replace(/[^\d]/g,''));
    if(!value)return '$0';
    if(value>=1e6)return `$${(value/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})} M`;
    if(value>=1e3)return `$${Math.round(value/1e3).toLocaleString('es-CL')} mil`;
    return `$${value.toLocaleString('es-CL')}`;
  }
  function enhance(){
    const labels={todas:'Todas',pendiente:'Pendientes',pagada:'Pagadas',vencida:'Vencidas',aprobacion:'Por aprobar'};
    const total=counts();
    document.querySelectorAll('#invoicesTabs .invoices-tab').forEach(tab=>{
      const key=tab.dataset.tab;
      if(key in labels)tab.innerHTML=`${labels[key]}<em class="inv-count">${total[key]}</em>`;
    });
    const donut=$('invoiceCategoryDonut');
    const totalEl=$('invoiceCategoryDonutTotal');
    if(donut&&totalEl)donut.dataset.total=compact(totalEl.textContent);
    insights();
    window.InvoiceLogos?.hydrate?.();
  }

  /* ---------------------------------------------------------------------
     Tarjetas nuevas: calendario de pagos, antigüedad, por categoría y principales
     proveedores. Se calculan con las mismas facturas y reglas que el resto de la pantalla.
     --------------------------------------------------------------------- */
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const cash=value=>typeof window.money==='function'?window.money(value):'$'+Math.round(Number(value)||0).toLocaleString('es-CL');
  const amount=invoice=>Number(invoice.montoTotal||0);
  const ymd=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const WEEKDAYS=['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
  const CAT_COLORS=['var(--purple)','var(--blue)','var(--green)','var(--orange)','var(--yellow)','var(--muted)'];

  function today(){
    return typeof window.invoiceTodayMidnight==='function'?window.invoiceTodayMidnight():(()=>{const now=new Date();now.setHours(0,0,0,0);return now})();
  }
  function daysLeft(invoice){
    return Math.ceil((new Date(`${invoice.fechaVencimiento}T00:00:00`)-today())/86400000);
  }
  function calendarHtml(unpaid){
    const start=today();
    const days=Array.from({length:14},(_,index)=>{
      const date=new Date(start);
      date.setDate(date.getDate()+index);
      const list=unpaid.filter(invoice=>invoice.fechaVencimiento===ymd(date));
      return {date,sum:list.reduce((total,invoice)=>total+amount(invoice),0),count:list.length};
    });
    const max=Math.max(1,...days.map(day=>day.sum));
    const upcoming=days.reduce((total,day)=>total+day.sum,0);
    const overdue=unpaid.filter(invoice=>daysLeft(invoice)<0).reduce((total,invoice)=>total+amount(invoice),0);
    return `<header><div><span class="fv-k">Pagos</span><h3>Próximos 14 días</h3></div><div class="fv-sum"><b>${cash(upcoming)}</b><small>por pagar${overdue?` · <i class="r">${cash(overdue)} vencido</i>`:''}</small></div></header>
      <div class="fv-days">${days.map((day,index)=>`<div class="fv-day${day.sum?' has':''}${index===0?' today':''}${day.sum&&index<=2?' soon':''}" style="--a:${day.sum?Math.max(.14,day.sum/max*.7).toFixed(2):0}" title="${day.count?`${day.count} factura(s) · ${cash(day.sum)}`:'Sin vencimientos'}"><small>${WEEKDAYS[day.date.getDay()]}</small><b>${day.date.getDate()}</b><span>${day.sum?compact(String(day.sum)):'·'}</span></div>`).join('')}</div>`;
  }
  function agingHtml(unpaid){
    const sum=list=>list.reduce((total,invoice)=>total+amount(invoice),0);
    const withDue=unpaid.filter(invoice=>invoice.fechaVencimiento);
    const buckets=[
      ['Al día',withDue.filter(invoice=>daysLeft(invoice)>7),'g'],
      ['Vence en 7 días o menos',withDue.filter(invoice=>{const d=daysLeft(invoice);return d>=0&&d<=7}),'y'],
      ['Vencida 1 a 30 días',withDue.filter(invoice=>{const d=daysLeft(invoice);return d<0&&d>=-30}),'o'],
      ['Vencida más de 30 días',withDue.filter(invoice=>daysLeft(invoice)<-30),'r']
    ].map(([label,list,tone])=>[label,sum(list),tone,list.length]);
    const total=buckets.reduce((acc,bucket)=>acc+bucket[1],0);
    return `<header><div><span class="fv-k">Cuentas por pagar</span><h3>Antigüedad</h3></div><div class="fv-sum"><b>${cash(total)}</b></div></header>
      <div class="fv-bar" role="img" aria-label="Antigüedad de las facturas por pagar">${buckets.filter(bucket=>bucket[1]>0).map(([label,value,tone])=>`<i class="${tone}" style="flex:${value}"></i>`).join('')||'<i class="e" style="flex:1"></i>'}</div>
      <div class="fv-leg">${buckets.map(([label,value,tone,count])=>`<div><i class="${tone}"></i><span>${label}</span><b>${cash(value)}</b></div>`).join('')}</div>`;
  }
  function monthInvoices(all){
    const prefix=typeof window.invoicePaymentPrefix==='function'?window.invoicePaymentPrefix():'';
    return all.filter(invoice=>(invoice.fechaEmision||'').startsWith(prefix));
  }
  function categoryHtml(month){
    const by={};
    month.forEach(invoice=>{const key=invoice.categoria||'Otros';by[key]=(by[key]||0)+amount(invoice)});
    const list=Object.entries(by).sort((a,b)=>b[1]-a[1]);
    const total=list.reduce((acc,entry)=>acc+entry[1],0);
    if(!list.length)return `<header><div><span class="fv-k">Compras</span><h3>Por categoría</h3></div><div class="fv-sum"><b>${cash(0)}</b></div></header><p class="fv-empty">Sin compras este mes.</p>`;
    return `<header><div><span class="fv-k">Compras</span><h3>Por categoría</h3></div><div class="fv-sum"><b>${cash(total)}</b></div></header>
      <div class="fv-bar" role="img" aria-label="Compras del mes por categoría">${list.map(([name,value],index)=>`<i style="flex:${value};background:${CAT_COLORS[index%CAT_COLORS.length]}"></i>`).join('')}</div>
      <div class="fv-leg">${list.map(([name,value],index)=>`<div class="cat"><i style="background:${CAT_COLORS[index%CAT_COLORS.length]}"></i><span>${esc(name)}</span><b>${total?Math.round(value/total*100):0}%</b><small>${cash(value)}</small></div>`).join('')}</div>`;
  }
  function suppliersHtml(month){
    const by=new Map();
    month.forEach(invoice=>{
      const key=window.InvoiceModule?.supplierKey?.(invoice)||invoice.proveedor||'';
      if(!key)return;
      const row=by.get(key)||{invoice,total:0,count:0};
      row.total+=amount(invoice);
      row.count+=1;
      by.set(key,row);
    });
    const list=[...by.values()].sort((a,b)=>b.total-a.total).slice(0,5);
    const total=list.reduce((acc,row)=>acc+row.total,0);
    const head=`<div class="dashboard-panel-head"><div><span class="section-kicker">Compras</span><h3>Principales proveedores</h3><p>Monto comprado este mes, por proveedor.</p></div></div>`;
    if(!list.length)return `${head}<p class="muted">Sin compras este mes.</p>`;
    const max=list[0].total||1;
    const avatarOf=invoice=>typeof window.invoiceAvatar==='function'?window.invoiceAvatar(invoice.proveedor,invoice):'';
    return `${head}<div class="fv-top">${list.map((row,index)=>`<div class="fv-row">${avatarOf(row.invoice)}<div class="fv-nm"><strong>${esc(row.invoice.proveedor||'—')}</strong><small>${row.count} factura${row.count===1?'':'s'}</small></div><b>${cash(row.total)}</b><div class="fv-pb"><i style="width:${Math.max(4,row.total/max*100).toFixed(1)}%;--c:${CAT_COLORS[index%CAT_COLORS.length]}"></i></div></div>`).join('')}</div>
      <div class="fv-tot"><span>Total</span><b>${cash(total)}</b></div>`;
  }
  function insights(){
    const all=window.InvoiceModule?.getAll?.()||[];
    const approved=typeof window.invoiceIsApproved==='function'?window.invoiceIsApproved:()=>true;
    const unpaid=all.filter(invoice=>invoice.estado==='pendiente'&&approved(invoice)&&invoice.fechaVencimiento);
    const month=monthInvoices(all);
    const calendar=$('invoiceCalendar');
    if(calendar)calendar.innerHTML=calendarHtml(unpaid);
    const two=$('invoiceInsights');
    if(two)two.innerHTML=`<section class="fv-card">${agingHtml(unpaid)}</section><section class="fv-card">${categoryHtml(month)}</section>`;
    const top=$('invoiceTopSuppliers');
    if(top)top.innerHTML=suppliersHtml(month);
  }
  function install(){
    if(typeof window.renderInvoices!=='function'||original)return;
    original=window.renderInvoices;
    window.renderInvoices=function(){
      const result=original.apply(this,arguments);
      try{enhance()}catch(error){console.warn('Facturas',error)}
      return result;
    };
  }
  install();
})();
