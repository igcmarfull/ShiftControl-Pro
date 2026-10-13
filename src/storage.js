(function () {
  'use strict';

  const config = window.SHIFTCONTROL_CONFIG;
  const LOCAL_SYNC_KEY = 'shiftcontrol_supabase_last_sync';
  const ACTIVE_COMPANY_KEY = 'shiftcontrol_local_state_company_v1';
  let ready = false;
  let activeCompanyId = null;
  let pendingSave = false;
  let saveTimer = null;
  let bootstrapPromise = null;

  function log(message, detail) {
    console.info(`[ShiftControl Sync] ${message}`, detail || '');
  }

  function warn(message, error) {
    console.warn(`[ShiftControl Sync] ${message}`, error || '');
  }

  function getClient() {
    if (!window.ShiftControlAuth?.getClient) {
      throw new Error('No se cargó la autenticación de Supabase.');
    }

    return window.ShiftControlAuth.getClient();
  }

  function getBaseLocalKey() {
    return typeof KEYS !== 'undefined' && KEYS?.data
      ? KEYS.data
      : 'shiftcontrol_pro_v2_all_replacement_candidates';
  }

  function getTenantLocalKey(companyId) {
    return `${getBaseLocalKey()}:company:${companyId}`;
  }

  function getTenantSyncKey(companyId) {
    return `${LOCAL_SYNC_KEY}:company:${companyId}`;
  }

  function readTenantState(companyId) {
    try {
      const raw = localStorage.getItem(getTenantLocalKey(companyId));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      warn('No fue posible leer la caché local de la empresa.', error);
      return null;
    }
  }

  function writeTenantState(companyId, nextState, syncedAt) {
    const serialized = JSON.stringify(nextState);
    const timestamp = syncedAt || new Date().toISOString();

    try {
      localStorage.setItem(getTenantLocalKey(companyId), serialized);
      localStorage.setItem(getBaseLocalKey(), serialized);
      localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
      localStorage.setItem(getTenantSyncKey(companyId), timestamp);
      localStorage.setItem(LOCAL_SYNC_KEY, timestamp);
    } catch (error) {
      warn('No fue posible actualizar la caché local de la empresa.', error);
    }
  }

  function tenantStateError(companyId) {
    const error = new Error(
      'La empresa no tiene un estado operacional inicializado.'
    );
    error.code = 'AUTH_COMPANY_STATE_UNAVAILABLE';
    error.companyId = companyId;
    return error;
  }

  function legacyStateFor(companyId) {
    const localCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);

    if (localCompanyId && localCompanyId !== companyId) {
      return null;
    }

    return window.ShiftControlState?.get?.() || null;
  }

  function applyState(companyId, nextState, syncedAt) {
    const currentState = window.ShiftControlState.replace(nextState);
    writeTenantState(companyId, currentState, syncedAt);

    if (typeof renderAll === 'function') {
      renderAll();
    }

    return currentState;
  }

  async function resolveContext() {
    let context = window.AuthContext?.get?.() || null;
    if (context) return context;

    if (window.ShiftControlAuth?.isInvitationPending?.()) {
      return null;
    }

    if (window.ShiftControlAuth?.initialize) {
      await window.ShiftControlAuth.initialize();
      context = window.AuthContext?.get?.() || null;
    }

    return context;
  }

  // Safety gate: area-scoped CHIEFs must never access the legacy
  // company-wide JSON or its shared localStorage cache.
  function assertLegacyStateAccess(context) {
    if (context?.role === 'CHIEF' && context?.area) {
      const error = new Error(
        'El acceso por área todavía no está habilitado. Contacta al administrador.'
      );
      error.code = 'AUTH_AREA_STORAGE_CUTOVER_REQUIRED';
      throw error;
    }
  }

  function assertBootstrapSession(context) {
    const current = window.AuthContext?.get?.() || null;
    if (!current || current.companyId !== context.companyId ||
        current.userId !== context.userId || current.role !== context.role ||
        current.area !== context.area) {
      const error = new Error('La sesión cambió durante la carga. Vuelve a ingresar.');
      error.code = 'AUTH_SESSION_CHANGED_DURING_BOOTSTRAP';
      throw error;
    }
  }

  async function pushState() {
    const context = window.AuthContext?.get?.() || null;

    if (
      !ready ||
      !context?.companyId ||
      context.companyId !== activeCompanyId
    ) {
      pendingSave = true;
      return null;
    }

    try {
      assertLegacyStateAccess(context);
      const currentState = window.ShiftControlState.get();
      const updatedAt = new Date().toISOString();

      writeTenantState(context.companyId, currentState, updatedAt);

      const { error } = await getClient()
        .from('app_state')
        .upsert(
          {
            company_id: context.companyId,
            key: config.stateKey,
            data: currentState,
            updated_at: updatedAt
          },
          { onConflict: 'company_id,key' }
        );

      if (error) throw error;

      log('Estado de la empresa sincronizado con Supabase.');
      return currentState;
    } catch (error) {
      warn(
        'No fue posible sincronizar. Los datos siguen guardados localmente.',
        error
      );
      return null;
    }
  }

  function schedulePush() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushState, 500);
  }

  async function bootstrap() {
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async function () {
      const context = await resolveContext();

      if (!context?.companyId) {
        ready = false;
        activeCompanyId = null;
        return null;
      }

      assertLegacyStateAccess(context);

      if (ready && activeCompanyId === context.companyId) {
        return window.ShiftControlState.get();
      }

      ready = false;
      activeCompanyId = context.companyId;

      try {
        const { data, error } = await getClient()
          .from('app_state')
          .select('data, updated_at')
          .eq('company_id', context.companyId)
          .eq('key', config.stateKey)
          .maybeSingle();

        assertBootstrapSession(context);
        if (error) throw error;

        if (data?.data) {
          const currentState = applyState(
            context.companyId,
            data.data,
            data.updated_at
          );

          ready = true;
          log('Estado de la empresa recuperado desde Supabase.');
          return currentState;
        }

        const tenantState =
          readTenantState(context.companyId) ||
          legacyStateFor(context.companyId);

        if (!tenantState) {
          throw tenantStateError(context.companyId);
        }

        const currentState = applyState(
          context.companyId,
          tenantState
        );

        ready = true;
        log('Inicializando el estado remoto de la empresa desde localStorage.');
        await pushState();
        return currentState;
      } catch (error) {
        // Never recover another account's cached company data after logout
        // or a company switch while the network request was pending.
        assertBootstrapSession(context);
        const tenantState =
          readTenantState(context.companyId) ||
          legacyStateFor(context.companyId);

        if (tenantState) {
          const currentState = applyState(
            context.companyId,
            tenantState
          );

          ready = true;
          warn(
            'Se continuará con la caché local aislada de la empresa.',
            error
          );
          return currentState;
        }

        ready = false;
        activeCompanyId = null;
        throw error;
      } finally {
        if (ready && pendingSave) {
          pendingSave = false;
          schedulePush();
        }
      }
    })();

    try {
      return await bootstrapPromise;
    } finally {
      bootstrapPromise = null;
    }
  }

  // API de preparación para el nuevo almacenamiento por área.
  // No se conecta todavía al estado global de la SPA: hacerlo antes de
  // particionar cada módulo expondría o sobrescribiría datos de otra área.
  const VALID_AREAS = ['ESTACION', 'TIENDA'];

  function requireAreaAdmin(area) {
    const context = window.AuthContext?.get?.() || null;
    if (!context?.companyId || context.companyId !== activeCompanyId) {
      throw new Error('La empresa activa no coincide con la sesión.');
    }
    if (context.role !== 'ADMIN') {
      throw new Error('La migración de datos por área requiere un ADMIN.');
    }
    if (!VALID_AREAS.includes(area)) {
      throw new Error('Área inválida.');
    }
    return context;
  }

  async function readAreaState(area, key) {
    const context = requireAreaAdmin(area);
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Clave de almacenamiento inválida.');
    }
    const { data, error } = await getClient()
      .from('area_state')
      .select('data, updated_at, revision')
      .eq('company_id', context.companyId)
      .eq('area', area)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function writeAreaState(area, key, nextData, expectedRevision) {
    const context = requireAreaAdmin(area);
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Clave de almacenamiento inválida.');
    }
    if (nextData === undefined || nextData === null) {
      throw new Error('No se puede guardar un estado vacío.');
    }
    if (expectedRevision !== null &&
        (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
      throw new Error('Se requiere una revisión válida o null para crear.');
    }
    if (expectedRevision === undefined) {
      throw new Error('Indica la revisión leída; null solo para registros nuevos.');
    }
    const { data, error } = await getClient()
      .rpc('save_area_state', {
        p_company_id: context.companyId,
        p_area: area,
        p_key: key,
        p_data: nextData,
        p_expected_revision: expectedRevision
      });
    if (error) throw error;
    return data;
  }

  // Read-only isolated API for area CHIEFs. Never hydrate the legacy global
  // company state or localStorage from this response.
  async function readOwnAreaState(key) {
    const context = window.AuthContext?.get?.() || null;
    if (!context?.companyId || context.role !== 'CHIEF' ||
        !VALID_AREAS.includes(context.area)) {
      throw new Error('Se requiere una jefatura con área asignada.');
    }
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Clave de almacenamiento inválida.');
    }
    const { data, error } = await getClient()
      .from('area_state')
      .select('data, updated_at, revision')
      .eq('company_id', context.companyId)
      .eq('area', context.area)
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    // A sign-out or account switch while the request was in flight must
    // never deliver the previous chief's records to the new session.
    const current = window.AuthContext?.get?.() || null;
    if (!current || current.companyId !== context.companyId ||
        current.userId !== context.userId ||
        current.role !== context.role || current.area !== context.area) {
      throw new Error('La sesión cambió durante la consulta. Vuelve a ingresar.');
    }
    if (!data) return null;
    // Fail closed if an incorrectly populated row contains another area's
    // operational records. Never hand it to a calendar or another module.
    validateOwnAreaPayload(data.data, context.area);
    return structuredClone(data);
  }

  // Reject accidental cross-area or orphan operational records before an
  // area-scoped write. The server must still enforce row-level authorization.
  function validateOwnAreaPayload(data, area) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Se requiere un estado de área válido.');
    }
    const collections = ['employees', 'plans', 'executions', 'additional', 'absences'];
    // The scoped format is intentionally closed: unknown top-level keys
    // could contain shared settings, another area's schedule or audit data.
    for (const name of Object.keys(data)) {
      if (!collections.includes(name)) {
        throw new Error('Colección no autorizada en estado de área: ' + name);
      }
    }
    for (const name of collections) {
      if (!Array.isArray(data[name])) {
        throw new Error('Falta una colección de área válida: ' + name);
      }
    }
    const ids = new Set();
    for (const employee of data.employees) {
      if (!employee || employee.id == null || employee.area !== area ||
          ids.has(employee.id)) {
        throw new Error('Trabajador duplicado o fuera del área autorizada.');
      }
      ids.add(employee.id);
    }
    for (const name of collections.slice(1)) {
      for (const item of data[name]) {
        if (!item || !ids.has(item.employeeId)) {
          throw new Error('Registro de ' + name + ' sin trabajador del área.');
        }
      }
    }
    // Shared/unassigned data belongs to ADMIN and must never be included.
    if ('UNASSIGNED' in data || 'sharedHolidays' in data ||
        'unresolvedPlans' in data || 'holidays' in data) {
      throw new Error('El estado contiene datos fuera del área.');
    }
  }

  // Explicit area-scoped RPC, not connected to legacy save() or global state.
  // Optimistic revision prevents overwriting another editor's changes.
  async function writeOwnAreaState(key, nextData, expectedRevision) {
    const context = window.AuthContext?.get?.() || null;
    if (!context?.companyId || context.role !== 'CHIEF' ||
        !VALID_AREAS.includes(context.area)) {
      throw new Error('Se requiere una jefatura con área asignada.');
    }
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Clave de almacenamiento inválida.');
    }
    if (nextData === undefined || nextData === null) {
      throw new Error('No se puede guardar un estado vacío.');
    }
    if (expectedRevision === undefined ||
        (expectedRevision !== null &&
         (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1))) {
      throw new Error('Se requiere una revisión válida o null para crear.');
    }
    validateOwnAreaPayload(nextData, context.area);
    const payload = structuredClone(nextData);
    // The RPC independently checks company membership and area on the server.
    const { data, error } = await getClient().rpc('save_area_state', {
      p_company_id: context.companyId,
      p_area: context.area,
      p_key: key,
      p_data: payload,
      p_expected_revision: expectedRevision
    });
    if (error) throw error;
    const current = window.AuthContext?.get?.() || null;
    if (!current || current.companyId !== context.companyId ||
        current.userId !== context.userId ||
        current.role !== context.role || current.area !== context.area) {
      throw new Error('La sesión cambió durante el guardado. Verifica antes de reintentar.');
    }
    return data;
  }

  const originalSave = window.save;

  if (typeof originalSave === 'function') {
    window.save = function () {
      const context = window.AuthContext?.get?.() || null;
      // Reject before the legacy save() writes company-wide localStorage.
      // This is defense-in-depth, not a replacement for database RLS.
      assertLegacyStateAccess(context);
      const result = originalSave.apply(this, arguments);

      if (ready && context.companyId && context.companyId === activeCompanyId) {
        writeTenantState(
          context.companyId,
          window.ShiftControlState.get()
        );
        schedulePush();
      }

      return result;
    };
  } else {
    warn('No se encontró la función principal save().');
  }

  window.ShiftControlStorage = Object.freeze({
    pushState,
    bootstrap,
    isReady: () => ready,
    getActiveCompanyId: () => activeCompanyId,
    getTenantLocalKey,
    readAreaState,
    writeAreaState,
    readOwnAreaState,
    writeOwnAreaState
  });
})();
