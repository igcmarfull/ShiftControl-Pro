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

  const originalSave = window.save;

  if (typeof originalSave === 'function') {
    window.save = function () {
      originalSave.apply(this, arguments);

      const companyId = window.AuthContext?.get?.()?.companyId;
      if (ready && companyId && companyId === activeCompanyId) {
        writeTenantState(
          companyId,
          window.ShiftControlState.get()
        );
      }

      schedulePush();
    };
  } else {
    warn('No se encontró la función principal save().');
  }

  window.ShiftControlStorage = Object.freeze({
    pushState,
    bootstrap,
    isReady: () => ready,
    getActiveCompanyId: () => activeCompanyId,
    getTenantLocalKey
  });
})();
