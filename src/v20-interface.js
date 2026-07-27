(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function go(view){window.v19CloseCommandCenter();if(typeof window.showView==='function')window.showView(view)}
  function clickExisting(selector,fallbackView){window.v19CloseCommandCenter();const el=document.querySelector(selector);if(el){el.click();return}if(fallbackView)go(fallbackView)}
  function syncMobileLauncher(open){
    document.body.classList.toggle('v51-center-open',open);
    const launcher=document.querySelector('.v48-mobile-nav .mobile-nav-center');
    if(launcher){launcher.classList.toggle('active',open);launcher.setAttribute('aria-label',open?'Cerrar Centro de acciones':'Abrir Centro de acciones');launcher.setAttribute('aria-expanded',open?'true':'false')}
  }
  window.v19OpenCommandCenter=function(){render();$('v19CommandCenter')?.classList.add('open');$('v19CommandBackdrop')?.classList.add('open');document.body.style.overflow='hidden';syncMobileLauncher(true)};
  window.v19CloseCommandCenter=function(){$('v19CommandCenter')?.classList.remove('open');$('v19CommandBackdrop')?.classList.remove('open');document.body.style.overflow='';syncMobileLauncher(false)};
  window.v19SetCommandTab=function(name){document.querySelectorAll('[data-v19-tab]').forEach(x=>x.classList.toggle('active',x.dataset.v19Tab===name));document.querySelectorAll('.v19-pane').forEach(x=>x.classList.remove('active'));$('v19Pane'+name[0].toUpperCase()+name.slice(1))?.classList.add('active');render()};
  window.v19Action=function(action){
    const map={attendance:()=>go('today'),replacement:()=>go('absences'),incident:()=>go('incidents'),employee:()=>clickExisting('#employees .topbar .btn.primary','employees'),evaluation:()=>go('evaluations'),finance:()=>go('finance'),task:()=>{window.v19CloseCommandCenter();if(typeof window.v17AddTask==='function')window.v17AddTask();else go('dashboard')},notifications:()=>{window.v19CloseCommandCenter();if(typeof window.v16OpenNotifications==='function')window.v16OpenNotifications()}};
    (map[action]||(()=>{}))();
  };
  function noticeCount(){const old=$('v16NotificationCount');const n=parseInt(old?.textContent||'0',10);return Number.isFinite(n)?n:0}
  function taskCount(){const txt=$('v17TaskCount')?.textContent||'';const n=parseInt(txt,10);return Number.isFinite(n)?n:0}
  function render(){
    const n=noticeCount(),t=taskCount(),total=n+t,badge=$('v19CommandBadge');if(badge){badge.textContent=total;badge.style.display=total?'grid':'none'}
    const title=$('v50CenterTitle');if(title){const h=new Date().getHours();const greeting=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';const name=($('roleName')?.textContent||'').trim().split(' ')[0];title.textContent=name?`${greeting}, ${name}`:greeting}
    const role=window.ShiftControlPermissions?.getRole?.();
    const home=role==='ADMIN'
      ?{view:'admin-inbox',label:'Bandeja ADMIN',description:'Pendientes críticos y revisión operacional'}
      :{view:'operational-home',label:'Inicio operativo',description:'Estado del turno y alertas clave'};
    const canOpen=view=>window.ShiftControlPermissions?.canOpenView?.(view)===true;
    const showOperationalHome=home.view!=='operational-home'&&canOpen('operational-home');
    const group=(title,items)=>{
      const buttons=items.filter(item=>canOpen(item.view)).map(item=>`<button class="v50-center-item" onclick="v19Go('${item.view}')"><span>${item.icon}</span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></button>`).join('');
      return buttons?`<div class="v50-center-group"><div class="v50-center-group-title">${esc(title)}</div><div class="v50-center-list">${buttons}</div></div>`:'';
    };
    const actions=$('v19PaneActions');if(actions)actions.innerHTML=`
      <div class="v50-center-greeting"><strong>Centro de control</strong><small>Todos los módulos importantes, reunidos en un solo lugar.</small></div>
      <div class="v50-center-group"><div class="v50-center-group-title">Inicio</div><div class="v50-center-list">
        <button class="v50-center-item v50-wide" onclick="v19Go('${home.view}')"><span>◆</span><div><strong>${esc(home.label)}</strong><small>${esc(home.description)}</small></div><span class="v50-center-arrow">›</span></button>
        ${showOperationalHome?`<button class="v50-center-item v50-wide" onclick="v19Go('operational-home')"><span>◆</span><div><strong>Inicio operativo</strong><small>Centro operacional del turno</small></div><span class="v50-center-arrow">›</span></button>`:''}
      </div></div>
      ${group('Operación',[
        {view:'actual',icon:'◷',label:'Asistencia',description:'Registro real y excepciones'},
        {view:'checklists',icon:'✓',label:'Checklist',description:'Control de Jefa de Isla'},
        {view:'incidents',icon:'!',label:'Incidencias',description:'Registrar y dar seguimiento'},
        {view:'handoff',icon:'⇄',label:'Entrega de turno',description:'Cierre y traspaso operacional'}
      ])}
      ${group('Personal',[
        {view:'employees',icon:'◉',label:'Trabajadores',description:'Fichas y datos del equipo'},
        {view:'planning',icon:'▦',label:'Planificación',description:'Turnos y descansos'},
        {view:'absences',icon:'✚',label:'Ausencias',description:'Cobertura y reemplazos'},
        {view:'evaluations',icon:'★',label:'Evaluaciones',description:'Desempeño mensual'}
      ])}
      ${group('Administración',[
        {view:'finance',icon:'$',label:'Finanzas',description:'Caja, ventas y depósitos'},
        {view:'additional',icon:'＋',label:'Jornadas adicionales',description:'Turnos extra y pagos'},
        {view:'reports',icon:'↗',label:'Reportes',description:'Informes y exportaciones'},
        {view:'settings',icon:'⚙',label:'Configuración',description:'Preferencias del sistema'}
      ])}
      <div class="v19-section-title">Trabajo pendiente</div><div class="v19-summary-list"><div class="v19-summary-item" onclick="v19Action('notifications')"><span class="v19-summary-icon">🔔</span><div><strong>Notificaciones</strong><small>Alertas e información del sistema</small></div><span class="v19-count-chip">${n}</span></div><div class="v19-summary-item" onclick="v19Action('task')"><span class="v19-summary-icon">☑</span><div><strong>Pendientes</strong><small>Tareas que requieren una acción</small></div><span class="v19-count-chip">${t}</span></div></div>`;
    const notices=$('v19PaneNotices');if(notices)notices.innerHTML=`<div class="v19-section-title">Resumen</div><div class="v19-summary-list"><div class="v19-summary-item" onclick="v19Action('notifications')"><span class="v19-summary-icon">🔔</span><div><strong>${n?n+' asunto(s) por revisar':'Todo al día'}</strong><small>${n?'Abrir el centro completo de notificaciones':'No hay alertas relevantes'}</small></div><span>↗</span></div><div class="v19-summary-item" onclick="v19Action('task')"><span class="v19-summary-icon">☑</span><div><strong>${t?t+' pendiente(s)':'Sin pendientes manuales'}</strong><small>Crear o revisar tareas operativas</small></div><span>↗</span></div></div>`;
    const nav=$('v19PaneNavigate');if(nav){const links=[[role==='ADMIN'?'▧':'◆',home.label,home.view],...(showOperationalHome?[['◆','Inicio operativo','operational-home']]:[]),['◉','Operación del día','today'],['◫','Centro ejecutivo','dashboard'],['◷','Registro real','actual'],['▦','Planificación','planning'],['◉','Trabajadores','employees'],['$','Finanzas','finance'],['↗','Reportes','reports'],['≡','Historial de actividad','audit'],['⚙','Configuración','settings']].filter(x=>canOpen(x[2]));nav.innerHTML=`<div class="v19-section-title">Accesos rápidos</div><div class="v19-nav-list">${links.map(x=>`<div class="v19-nav-item" onclick="v19Go('${x[2]}')"><span class="v19-summary-icon">${x[0]}</span><div><strong>${esc(x[1])}</strong><small>Abrir módulo</small></div><span>↗</span></div>`).join('')}</div>`}
  }
  window.v19Go=go;
  function installWorkerSearch(){const sec=$('employees');if(!sec||sec.querySelector('.v19-worker-toolbar'))return;const input=$('employeeSearch');if(!input)return;const wrap=document.createElement('div');wrap.className='v19-worker-toolbar';const toggle=document.createElement('button');toggle.className='v19-search-toggle';toggle.type='button';toggle.title='Buscar trabajador';toggle.setAttribute('aria-label','Buscar trabajador');toggle.textContent='⌕';toggle.onclick=()=>{wrap.classList.toggle('search-open');if(wrap.classList.contains('search-open'))setTimeout(()=>input.focus(),20);else{input.value='';if(typeof window.renderEmployees==='function')window.renderEmployees()}};input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);wrap.appendChild(toggle)}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')window.v19CloseCommandCenter();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();window.v19OpenCommandCenter()}});
  function init(){document.querySelector('.v18-station-context')?.remove();document.querySelector('.v18-notification-fab')?.remove();installWorkerSearch();render();setInterval(render,1500)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));setTimeout(init,700);
})();

/* V31 · Registro real móvil compacto */
(function(){
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mobile=()=>window.matchMedia('(max-width: 767px)').matches;
  function syncPeriodSelect(){
    const select=document.getElementById('v31ActualPeriod');
    const month=document.getElementById('actualMonth');
    const year=document.getElementById('actualYear');
    if(select&&month&&year) select.value=year.value+'-'+month.value;
  }
  function buildPeriodOptions(select){
    if(select.options.length)return;
    const year=document.getElementById('actualYear');
    const years=year?[...year.options].map(o=>o.value):[];
    years.forEach(y=>monthNames.forEach((name,index)=>{
      const option=document.createElement('option');
      option.value=y+'-'+String(index+1).padStart(2,'0');
      option.textContent=name+' '+y;
      select.appendChild(option);
    }));
  }
  function changePeriod(value){
    const [year,month]=String(value).split('-');
    const monthSelect=document.getElementById('actualMonth');
    const yearSelect=document.getElementById('actualYear');
    if(!monthSelect||!yearSelect)return;
    monthSelect.value=month;
    yearSelect.value=year;
    if(typeof window.renderActualCalendar==='function')window.renderActualCalendar();
  }
  function moveNotice(){
    const section=document.getElementById('actual');
    const notice=section?.querySelector(':scope > .notice');
    const shell=section?.querySelector('.calendar-shell');
    const toolbar=section?.querySelector('.toolbar');
    if(!notice||!shell||!toolbar)return;
    if(mobile()){
      if(shell.nextElementSibling!==notice)shell.insertAdjacentElement('afterend',notice);
    }else if(toolbar.nextElementSibling!==notice){
      toolbar.insertAdjacentElement('afterend',notice);
    }
  }
  function install(){
    const section=document.getElementById('actual');
    if(!section)return;
    const heading=section.querySelector('.topbar > div:first-child');
    if(heading&&!heading.querySelector('.v31-actual-today')){
      const today=document.createElement('button');
      today.type='button';
      today.className='v31-actual-today';
      today.textContent='Hoy';
      today.onclick=()=>{if(typeof window.goActualCurrentMonth==='function')window.goActualCurrentMonth()};
      heading.appendChild(today);
    }
    if(!section.querySelector('.v31-actual-mobile-nav')){
      const nav=document.createElement('div');
      nav.className='v31-actual-mobile-nav';
      nav.innerHTML='<button type="button" aria-label="Mes anterior">‹</button><select id="v31ActualPeriod" class="v31-actual-period" aria-label="Mes y año"></select><button type="button" aria-label="Mes siguiente">›</button>';
      const toolbar=section.querySelector('.toolbar');
      toolbar?.insertAdjacentElement('beforebegin',nav);
      const buttons=nav.querySelectorAll('button');
      buttons[0].onclick=()=>{if(typeof window.moveActualMonth==='function')window.moveActualMonth(-1)};
      buttons[1].onclick=()=>{if(typeof window.moveActualMonth==='function')window.moveActualMonth(1)};
      const select=nav.querySelector('select');
      buildPeriodOptions(select);
      select.onchange=e=>changePeriod(e.target.value);
    }
    syncPeriodSelect();
    moveNotice();
  }
  const oldRender=window.renderActualCalendar;
  if(typeof oldRender==='function'){
    window.renderActualCalendar=function(){
      const result=oldRender.apply(this,arguments);
      setTimeout(()=>{install();syncPeriodSelect();moveNotice()},0);
      return result;
    };
  }
  window.addEventListener('resize',()=>setTimeout(moveNotice,40));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,220));
  setTimeout(install,850);
})();
