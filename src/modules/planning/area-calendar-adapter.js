// Area calendar read adapter. Opt-in only; never hydrates legacy company state.
// Load after auth.js and storage.js when the area UI is ready.
(function () {
  'use strict';
  const KEY = 'main';
  function session() {
    const context = window.AuthContext?.get?.();
    if (!context?.companyId || context.role !== 'CHIEF' ||
        !['ESTACION', 'TIENDA'].includes(context.area) || !context.userId) {
      throw new Error('Se requiere una jefatura con área y sesión válida.');
    }
    return context;
  }
  async function load(key) {
    const before = session();
    const storage = window.ShiftControlStorage;
    if (typeof storage?.readOwnAreaState !== 'function') {
      throw new Error('El almacenamiento por área no está disponible.');
    }
    const row = await storage.readOwnAreaState(key || KEY);
    const after = session();
    if (after.userId !== before.userId || after.companyId !== before.companyId ||
        after.role !== before.role || after.area !== before.area) {
      throw new Error('La sesión cambió durante la carga del calendario.');
    }
    if (!row) return null;
    const data = row.data;
    // Storage validates the ownership of all five operational collections.
    // Return a detached view model; never write into window.state or cache.
    return {
      area: after.area,
      revision: row.revision,
      employees: structuredClone(data.employees),
      plans: structuredClone(data.plans),
      executions: structuredClone(data.executions),
      additional: structuredClone(data.additional),
      absences: structuredClone(data.absences)
    };
  }
  // Explicit save, separate from the legacy global save() path.
  // The caller must supply the revision returned by load(); null is only
  // valid for creating a new area row after confirming it does not exist.
  async function save(view, key) {
    const before = session();
    if (!view || view.area !== before.area ||
        !['employees', 'plans', 'executions', 'additional', 'absences']
          .every(name => Array.isArray(view[name]))) {
      throw new Error('El calendario no corresponde al área activa.');
    }
    if (view.revision === undefined ||
        (view.revision !== null &&
         (!Number.isSafeInteger(view.revision) || view.revision < 1))) {
      throw new Error('Revisión de calendario inválida.');
    }
    const storage = window.ShiftControlStorage;
    if (typeof storage?.writeOwnAreaState !== 'function') {
      throw new Error('El guardado por área no está disponible.');
    }
    const payload = {};
    for (const name of ['employees', 'plans', 'executions', 'additional', 'absences']) {
      payload[name] = structuredClone(view[name]);
    }
    const revision = await storage.writeOwnAreaState(key || KEY, payload, view.revision);
    const after = session();
    if (after.userId !== before.userId || after.companyId !== before.companyId ||
        after.role !== before.role || after.area !== before.area) {
      throw new Error('La sesión cambió durante el guardado del calendario.');
    }
    return { ...structuredClone(payload), area: after.area, revision };
  }

  window.ShiftControlAreaCalendar = Object.freeze({ load, save });
})();
