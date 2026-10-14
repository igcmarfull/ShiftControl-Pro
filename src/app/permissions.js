(function(){
  'use strict';

  const ROLE_PERMISSIONS=Object.freeze({
    ADMIN:Object.freeze({
      views:'*',
      actions:'*'
    }),
    CHIEF:Object.freeze({
      views:Object.freeze([
        'operational-home',
        'today',
        'actual',
        'execution',
        'absences',
        'incidents',
        'checklists',
        'handoff',
        'planning',
        'weekly',
        'employees',
        'evaluations',
        'reports',
        'additional',
        'inventory'
      ]),
      actions:Object.freeze([
        'attendance.manage',
        'planning.manage',
        'absences.manage',
        'incidents.manage',
        'checklists.manage',
        'handoff.manage',
        'employees.manage',
        'evaluations.manage',
        'reports.operational',
        'additional.create'
      ])
    }),
    // La Jefa de Tienda tiene las mismas funciones que la Jefa de Isla, sobre
    // el personal, las incidencias, el checklist y las entregas de la tienda.
    // Además registra facturas de tienda, que el administrador aprueba.
    CHIEF_TIENDA:Object.freeze({
      views:Object.freeze([
        'operational-home',
        'today',
        'actual',
        'execution',
        'absences',
        'incidents',
        'checklists',
        'handoff',
        'planning',
        'weekly',
        'employees',
        'evaluations',
        'reports',
        'additional',
        'invoices',
        'inventory'
      ]),
      actions:Object.freeze([
        'attendance.manage',
        'planning.manage',
        'absences.manage',
        'invoices.submit',
        'incidents.manage',
        'checklists.manage',
        'handoff.manage',
        'employees.manage',
        'evaluations.manage',
        'reports.operational',
        'additional.create'
      ])
    })
  });

  function getContext(){
    return window.AuthContext?.get?.() || null;
  }

  function normalizeRole(role){
    const normalized=String(role||'').trim().toUpperCase();
    if(normalized==='ADMIN')return 'ADMIN';
    if(normalized==='CHIEF')return 'CHIEF';
    return null;
  }

  function getRole(){
    return normalizeRole(getContext()?.role);
  }

  function getArea(){
    if(getRole()!=='CHIEF')return null;
    // Cualquier área distinta de tienda (ISLA, ESTACION o vacía) es la isla.
    return String(getContext()?.area||'').trim().toUpperCase()==='TIENDA'
      ?'TIENDA'
      :'ISLA';
  }

  function permissionKey(){
    const role=getRole();
    return role==='CHIEF'&&getArea()==='TIENDA'?'CHIEF_TIENDA':role;
  }

  function getLegacyRole(){
    const role=getRole();
    if(role==='ADMIN')return 'admin';
    if(role==='CHIEF')return 'chief';
    return null;
  }

  function hasAccess(collection,value){
    const permissions=ROLE_PERMISSIONS[permissionKey()];
    if(!permissions)return false;
    if(permissions[collection]==='*')return true;
    return permissions[collection].includes(value);
  }

  function canOpenView(viewId){
    return hasAccess('views',viewId);
  }

  function canUseAction(action){
    return hasAccess('actions',action);
  }

  function requireAction(
    action,
    message='Esta acción está disponible solo para el administrador.'
  ){
    if(canUseAction(action))return true;
    window.alert?.(message);
    return false;
  }

  window.ShiftControlPermissions=Object.freeze({
    getRole,
    getArea,
    getLegacyRole,
    canOpenView,
    canUseAction,
    requireAction
  });
})();
