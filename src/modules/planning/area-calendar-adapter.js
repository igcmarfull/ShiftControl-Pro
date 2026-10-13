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
    if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
      throw new Error('El calendario remoto no tiene una revisión válida.');
    }
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
    // A missing row must be initialized through a separate ADMIN-reviewed
    // migration, not by a CHIEF creating an empty calendar by accident.
    if (!Number.isSafeInteger(view.revision) || view.revision < 1) {
      throw new Error('El calendario debe existir y tener una revisión válida antes de guardar.');
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

  // Scoped calendar mutations. Never use the legacy PlanningModule or
  // company-wide ShiftControlState; optimistic save rejects stale revisions.
  async function upsertPlan(plan, key) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
        !plan.employeeId || typeof plan.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) {
      throw new Error('Se requiere un turno con trabajador y fecha válidos.');
    }
    const view = await load(key);
    if (!view) {
      throw new Error('No existe calendario migrado para esta área.');
    }
    if (!view.employees.some(employee => employee.id === plan.employeeId)) {
      throw new Error('El trabajador no pertenece al área de esta jefatura.');
    }
    const index = view.plans.findIndex(item =>
      item.employeeId === plan.employeeId && item.date === plan.date);
    const incoming = structuredClone(plan);
    if (index >= 0) {
      // Keep the existing identity when editing an established shift.
      incoming.id = view.plans[index].id;
      view.plans[index] = { ...view.plans[index], ...incoming };
    } else {
      incoming.id = incoming.id || crypto.randomUUID();
      view.plans.push(incoming);
    }
    return save(view, key);
  }

  async function removePlan(employeeId, date, key) {
    if (!employeeId || typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Se requiere trabajador y fecha válidos.');
    }
    const view = await load(key);
    if (!view) throw new Error('No existe calendario migrado para esta área.');
    if (!view.employees.some(employee => employee.id === employeeId)) {
      throw new Error('El trabajador no pertenece al área de esta jefatura.');
    }
    const filtered = view.plans.filter(plan =>
      !(plan.employeeId === employeeId && plan.date === date));
    if (filtered.length === view.plans.length) return view;
    view.plans = filtered;
    return save(view, key);
  }

  window.ShiftControlAreaCalendar = Object.freeze({ load, save, upsertPlan, removePlan });
})();
