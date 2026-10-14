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
  let baseState = null;
  let remoteUpdatedAt = null;
  let pushPromise = null;
  let pushAgain = false;
  let pollTimer = null;
  const POLL_INTERVAL_MS = 15000;
  const MAX_PUSH_ATTEMPTS = 5;

  // Colecciones cuyos registros son únicos por trabajador y fecha. Se
  // identifican así al combinar cambios, para que dos usuarios que editan
  // la misma celda no generen registros duplicados.
  const RECORD_IDENTITY = {
    plans: item => item?.employeeId && item?.date
      ? `${item.employeeId}|${item.date}`
      : null,
    executions: item => item?.employeeId && item?.date
      ? `${item.employeeId}|${item.date}`
      : null
  };

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

  function getTenantBaseKey(companyId) {
    return `${getTenantLocalKey(companyId)}:base`;
  }

  function getTenantDirtyKey(companyId) {
    return `${getTenantLocalKey(companyId)}:pending`;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  // Supabase guarda el estado como jsonb, que reordena las claves de los
  // objetos. La comparación ignora ese orden.
  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map(item => stableStringify(item === undefined ? null : item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
      return `{${Object.keys(value)
        .filter(key => value[key] !== undefined)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function same(a, b) {
    return stableStringify(a) === stableStringify(b);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function recordKey(collection, item) {
    const custom = RECORD_IDENTITY[collection]?.(item);
    if (custom) return `k:${custom}`;
    if (isPlainObject(item) && item.id !== undefined && item.id !== null) {
      return `id:${item.id}`;
    }
    return `v:${stableStringify(item)}`;
  }

  function indexRecords(collection, list) {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach(item => {
      const key = recordKey(collection, item);
      if (!map.has(key)) map.set(key, item);
    });
    return map;
  }

  function mergeRecords(collection, base, local, remote) {
    const baseMap = indexRecords(collection, base);
    const localMap = indexRecords(collection, local);
    const remoteMap = indexRecords(collection, remote);
    const result = [];
    const seen = new Set();

    function resolve(key) {
      const b = baseMap.get(key);
      const l = localMap.get(key);
      const r = remoteMap.get(key);

      if (l === undefined && r === undefined) return undefined;

      if (b !== undefined) {
        if (l === undefined) return same(r, b) ? undefined : r;
        if (r === undefined) return same(l, b) ? undefined : l;
      }

      if (l === undefined) return r;
      if (r === undefined) return l;
      return mergeValue(collection, b, l, r);
    }

    [remote, local].forEach(list => {
      (Array.isArray(list) ? list : []).forEach(item => {
        const key = recordKey(collection, item);
        if (seen.has(key)) return;
        seen.add(key);
        const value = resolve(key);
        if (value !== undefined) result.push(value);
      });
    });

    return result;
  }

  // Combinación a tres bandas: base es el último estado acordado con
  // Supabase, local contiene los cambios de este navegador y remote los de
  // otros usuarios. Si ambos cambiaron el mismo dato, prevalece el local.
  function mergeValue(name, base, local, remote) {
    if (same(local, base)) return remote;
    if (same(remote, base) || same(local, remote)) return local;

    if (Array.isArray(local) && Array.isArray(remote)) {
      return mergeRecords(
        name,
        Array.isArray(base) ? base : [],
        local,
        remote
      );
    }

    if (isPlainObject(local) && isPlainObject(remote)) {
      const baseObject = isPlainObject(base) ? base : {};
      const result = {};
      new Set([...Object.keys(remote), ...Object.keys(local)]).forEach(key => {
        const value = mergeValue(
          key,
          baseObject[key],
          local[key],
          remote[key]
        );
        if (value !== undefined) result[key] = value;
      });
      return result;
    }

    return local;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function rememberBase(companyId, nextBase, updatedAt) {
    baseState = clone(nextBase);
    remoteUpdatedAt = updatedAt || null;

    try {
      localStorage.setItem(
        getTenantBaseKey(companyId),
        JSON.stringify({ updatedAt: remoteUpdatedAt, data: baseState })
      );
    } catch (_error) {
      try {
        localStorage.removeItem(getTenantBaseKey(companyId));
      } catch (_ignored) {}
    }
  }

  function setDirty(companyId, dirty) {
    try {
      if (dirty) localStorage.setItem(getTenantDirtyKey(companyId), 'true');
      else localStorage.removeItem(getTenantDirtyKey(companyId));
    } catch (_error) {}
  }

  function isDirty(companyId) {
    try {
      return localStorage.getItem(getTenantDirtyKey(companyId)) === 'true';
    } catch (_error) {
      return false;
    }
  }

  function setSyncStatus(status) {
    const labels = {
      synced: 'Sincronizado',
      saving: 'Guardando…',
      offline: 'Sin conexión · guardado en este equipo'
    };
    const element = document.querySelector('.save-status');
    const label = element?.querySelector('span:last-child');
    if (!element || !label || !labels[status]) return;
    element.dataset.syncStatus = status;
    label.textContent = labels[status];
  }

  function isUserEditing() {
    if (document.querySelector('.modal.open')) return true;
    const active = document.activeElement;
    return Boolean(
      active &&
      active !== document.body &&
      active.matches?.('input, select, textarea, [contenteditable="true"]')
    );
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

  function stateQuery(client, companyId) {
    return client
      .from('app_state')
      .select('data, updated_at')
      .eq('company_id', companyId)
      .eq('key', config.stateKey)
      .maybeSingle();
  }

  async function writeRemote(client, companyId, row, nextState) {
    const updatedAt = new Date().toISOString();

    if (!row) {
      const { data, error } = await client
        .from('app_state')
        .insert({
          company_id: companyId,
          key: config.stateKey,
          data: nextState,
          updated_at: updatedAt
        })
        .select('updated_at');

      if (error?.code === '23505') return null;
      if (error) throw error;
      return data?.[0]?.updated_at || updatedAt;
    }

    // Escritura condicional: solo se aplica si nadie guardó desde la
    // lectura. Si otro usuario se adelantó, se vuelve a leer y combinar.
    let request = client
      .from('app_state')
      .update({ data: nextState, updated_at: updatedAt })
      .eq('company_id', companyId)
      .eq('key', config.stateKey);

    request = row.updated_at
      ? request.eq('updated_at', row.updated_at)
      : request.is('updated_at', null);

    const { data, error } = await request.select('updated_at');

    if (error) throw error;
    if (!data || !data.length) return null;
    return data[0].updated_at || updatedAt;
  }

  function adoptSyncedState(companyId, syncedState, updatedAt, sentSnapshot) {
    rememberBase(companyId, syncedState, updatedAt);

    const liveState = window.ShiftControlState.get();
    const liveChanged = !same(liveState, sentSnapshot);

    if (same(syncedState, sentSnapshot)) {
      writeTenantState(companyId, liveState, updatedAt);
    } else {
      // Se incorporaron cambios de otro usuario. Si además hubo ediciones
      // locales mientras se enviaba, se conservan sobre el resultado.
      const nextState = liveChanged
        ? mergeValue(null, sentSnapshot, liveState, syncedState)
        : clone(syncedState);
      applyState(companyId, nextState, updatedAt);
    }

    if (!liveChanged) setDirty(companyId, false);
    return liveChanged;
  }

  async function pushOnce() {
    const context = window.AuthContext?.get?.() || null;

    if (
      !ready ||
      !context?.companyId ||
      context.companyId !== activeCompanyId
    ) {
      pendingSave = true;
      return null;
    }

    const companyId = context.companyId;
    setSyncStatus('saving');

    try {
      const client = getClient();

      for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt += 1) {
        const sentSnapshot = clone(window.ShiftControlState.get());
        const { data: row, error } = await stateQuery(client, companyId);

        if (error) throw error;

        const remoteChanged = Boolean(
          row && (row.updated_at || null) !== remoteUpdatedAt
        );
        const nextState = remoteChanged
          ? mergeValue(null, baseState || undefined, sentSnapshot, row.data)
          : sentSnapshot;

        if (remoteChanged) {
          log('Se combinaron cambios guardados por otro usuario.');
        }

        const writtenAt = await writeRemote(client, companyId, row, nextState);
        if (!writtenAt) continue;

        const liveChanged = adoptSyncedState(
          companyId,
          nextState,
          writtenAt,
          sentSnapshot
        );

        log('Estado de la empresa sincronizado con Supabase.');
        if (liveChanged) pushAgain = true;
        else setSyncStatus('synced');
        return window.ShiftControlState.get();
      }

      throw new Error('Otro usuario está guardando cambios; se reintentará.');
    } catch (error) {
      setSyncStatus('offline');
      warn(
        'No fue posible sincronizar. Los datos siguen guardados localmente.',
        error
      );
      return null;
    }
  }

  async function pushState() {
    if (pushPromise) {
      pushAgain = true;
      return pushPromise;
    }

    pushPromise = pushOnce();

    try {
      return await pushPromise;
    } finally {
      pushPromise = null;
      if (pushAgain) {
        pushAgain = false;
        schedulePush();
      }
    }
  }

  function schedulePush() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      pushState();
    }, 500);
  }

  // Trae los cambios guardados por otros usuarios sin recargar la página.
  async function pullRemote() {
    const context = window.AuthContext?.get?.() || null;

    if (
      !ready ||
      pushPromise ||
      saveTimer ||
      document.hidden ||
      !context?.companyId ||
      context.companyId !== activeCompanyId
    ) {
      return false;
    }

    const companyId = context.companyId;

    try {
      const client = getClient();
      const { data: meta, error: metaError } = await client
        .from('app_state')
        .select('updated_at')
        .eq('company_id', companyId)
        .eq('key', config.stateKey)
        .maybeSingle();

      if (metaError) throw metaError;
      if (!meta || (meta.updated_at || null) === remoteUpdatedAt) {
        if (!isDirty(companyId)) setSyncStatus('synced');
        return false;
      }
      if (isUserEditing()) return false;

      const { data: row, error } = await stateQuery(client, companyId);
      if (error) throw error;
      if (!row?.data || pushPromise || saveTimer || isUserEditing()) {
        return false;
      }
      if (context.companyId !== activeCompanyId) return false;

      const liveState = window.ShiftControlState.get();
      const nextState = baseState
        ? mergeValue(null, baseState, liveState, row.data)
        : clone(row.data);

      rememberBase(companyId, row.data, row.updated_at);

      if (!same(nextState, liveState)) {
        applyState(companyId, nextState, row.updated_at);
        log('Se cargaron cambios guardados por otro usuario.');
      }

      if (same(nextState, row.data)) {
        setDirty(companyId, false);
        setSyncStatus('synced');
      } else {
        schedulePush();
      }

      return true;
    } catch (error) {
      setSyncStatus('offline');
      warn('No fue posible consultar cambios remotos.', error);
      return false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pullRemote, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pullRemote();
    });
    window.addEventListener('focus', () => pullRemote());
    window.addEventListener('online', () => {
      if (activeCompanyId && isDirty(activeCompanyId)) schedulePush();
      else pullRemote();
    });
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
      const storedBase = readJson(getTenantBaseKey(context.companyId));
      baseState = storedBase?.data || null;
      remoteUpdatedAt = storedBase?.updatedAt || null;

      try {
        const { data, error } = await stateQuery(
          getClient(),
          context.companyId
        );

        if (error) throw error;

        if (data?.data) {
          // Si quedaron cambios locales sin subir (por ejemplo, sin
          // conexión), se combinan con lo remoto en vez de descartarlos.
          const pendingLocal = isDirty(context.companyId)
            ? readTenantState(context.companyId)
            : null;
          const nextState = pendingLocal
            ? mergeValue(null, baseState || undefined, pendingLocal, data.data)
            : data.data;

          rememberBase(context.companyId, data.data, data.updated_at);

          const currentState = applyState(
            context.companyId,
            nextState,
            data.updated_at
          );

          ready = true;
          startPolling();

          if (pendingLocal && !same(nextState, data.data)) {
            log('Se recuperaron cambios locales pendientes de sincronizar.');
            schedulePush();
          } else {
            setDirty(context.companyId, false);
            setSyncStatus('synced');
          }

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
        startPolling();
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
          startPolling();
          setSyncStatus('offline');
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
        setDirty(companyId, true);
      }

      schedulePush();
    };
  } else {
    warn('No se encontró la función principal save().');
  }

  window.ShiftControlStorage = Object.freeze({
    pushState,
    pullRemote,
    bootstrap,
    isReady: () => ready,
    getActiveCompanyId: () => activeCompanyId,
    getTenantLocalKey
  });
})();
