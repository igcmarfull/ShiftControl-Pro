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
        'additional'
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

  // The original ISLA panel is shared by both chiefs; only its area scope changes.
  // Never derive scope from a client-side dropdown: RLS is the authority.
  function getChiefArea(){
    const context=getContext();
    if(normalizeRole(context?.role)!=='CHIEF')return null;
    if(context.area==='ESTACION')return 'Isla';
    if(context.area==='TIENDA')return 'Tienda';
    return null;
  }

  function getLegacyRole(){
    const role=getRole();
    if(role==='ADMIN')return 'admin';
    if(role==='CHIEF')return 'chief';
    return null;
  }

  function hasAccess(collection,value){
    const permissions=ROLE_PERMISSIONS[getRole()];
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
    getLegacyRole,
    getChiefArea,
    canOpenView,
    canUseAction,
    requireAction
  });
})();
