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
