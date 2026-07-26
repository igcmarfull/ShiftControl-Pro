(function () {
  'use strict';

  const config = window.SHIFTCONTROL_CONFIG;
  const LOCAL_SYNC_KEY = 'shiftcontrol_supabase_last_sync';
  let client = null;
  let ready = false;
  let pendingSave = false;
  let saveTimer = null;

  function log(message, detail) {
    console.info(`[ShiftControl Sync] ${message}`, detail || '');
  }

  function warn(message, error) {
    console.warn(`[ShiftControl Sync] ${message}`, error || '');
  }

  function getClient() {
    if (client) return client;

    if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
      throw new Error('Falta la configuración de Supabase.');
    }

    if (!window.supabase?.createClient) {
      throw new Error('No se cargó la librería de Supabase.');
    }

    client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    return client;
  }

  async function pushState() {
    if (!ready) {
      pendingSave = true;
      return;
    }

    try {
      const { error } = await getClient()
        .from('app_state')
        .upsert(
          {
            key: config.stateKey,
            data: state,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      localStorage.setItem(LOCAL_SYNC_KEY, new Date().toISOString());
      log('Estado sincronizado con Supabase.');
    } catch (error) {
      warn('No fue posible sincronizar. Los datos siguen guardados localmente.', error);
    }
  }

  function schedulePush() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushState, 500);
  }

  async function bootstrap() {
    try {
      const { data, error } = await getClient()
        .from('app_state')
        .select('data, updated_at')
        .eq('key', config.stateKey)
        .maybeSingle();

      if (error) throw error;

      if (data?.data) {

        Object.keys(state).forEach(key=>{
          delete state[key];
        });

        Object.assign(state, data.data);

        window.state = state;

        if(window.ShiftControlState){
          window.ShiftControlState.set(state);
        }

        localStorage.setItem(KEYS.data, JSON.stringify(state));
        localStorage.setItem(
          LOCAL_SYNC_KEY,
          data.updated_at || new Date().toISOString()
        );

        if (typeof renderAll === 'function') {
          renderAll();
        }

        log('Estado recuperado desde Supabase.');
      } else {
        log('Supabase está vacío. Subiendo los datos locales iniciales.');
        ready = true;
        await pushState();
        return;
      }
    } catch (error) {
      warn('Se continuará trabajando con localStorage.', error);
    } finally {
      ready = true;

      if (pendingSave) {
        pendingSave = false;
        schedulePush();
      }
    }
  }

  const originalSave = window.save;

  if (typeof originalSave === 'function') {
    window.save = function () {
      originalSave.apply(this, arguments);
      schedulePush();
    };
  } else {
    warn('No se encontró la función principal save().');
  }

  window.ShiftControlStorage = Object.freeze({
    pushState,
    bootstrap,
    isReady: () => ready
  });

  bootstrap();
})();
