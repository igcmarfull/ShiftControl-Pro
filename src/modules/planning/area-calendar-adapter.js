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
  window.ShiftControlAreaCalendar = Object.freeze({ load });
})();
