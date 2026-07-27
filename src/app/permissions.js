(function(){
  'use strict';

  const ROLE_PERMISSIONS=Object.freeze({
    ADMIN:Object.freeze({
      views:'*',
      actions:'*'
    }),
    CHIEF:Object.freeze({
      views:Object.freeze([
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

  function getRole(){
    return getContext()?.role || null;
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
    canOpenView,
    canUseAction,
    requireAction
  });
})();
