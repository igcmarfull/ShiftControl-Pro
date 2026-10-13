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
    assertUniquePlans(view.plans);
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

  function assertUniquePlans(plans) {
    const seen = new Set();
    for (const plan of plans) {
      const key = plan.employeeId + ':' + plan.date;
      if (seen.has(key)) {
        throw new Error('Hay turnos duplicados en el calendario. Solicita corregirlos antes de guardar.');
      }
      seen.add(key);
    }
  }

  // Scoped calendar mutations. Never use the legacy PlanningModule or
  // company-wide ShiftControlState; optimistic save rejects stale revisions.
  async function upsertPlan(plan, key) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
        !plan.employeeId || typeof plan.date !== 'string' ||
        !isCalendarDate(plan.date)) {
      throw new Error('Se requiere un turno con trabajador y fecha válidos.');
    }
    const view = await load(key);
    if (!view) {
      throw new Error('No existe calendario migrado para esta área.');
    }
    assertUniquePlans(view.plans);
    if (!view.employees.some(employee => employee.id === plan.employeeId)) {
      throw new Error('El trabajador no pertenece al área de esta jefatura.');
    }
    const index = view.plans.findIndex(item =>
      item.employeeId === plan.employeeId && item.date === plan.date);
    const allowedCodes = new Set(['A','B','C','D','L','V','P','X','Libre','Licencia','Vacaciones','Permiso']);
    if (!allowedCodes.has(plan.code)) throw new Error('Código de turno no autorizado.');
    // Only accept editable shift fields; callers cannot inject IDs or
    // overwrite area-scoped metadata through a calendar cell.
    const incoming = { employeeId: plan.employeeId, date: plan.date, code: plan.code };
    if (index >= 0) {
      // Keep the existing identity when editing an established shift.
      incoming.id = view.plans[index].id;
      view.plans[index] = { ...view.plans[index], ...incoming };
    } else {
      incoming.id = crypto.randomUUID();
      view.plans.push(incoming);
    }
    return save(view, key);
  }

  async function removePlan(employeeId, date, key) {
    if (!employeeId || typeof date !== 'string' ||
        !isCalendarDate(date)) {
      throw new Error('Se requiere trabajador y fecha válidos.');
    }
    const view = await load(key);
    if (!view) throw new Error('No existe calendario migrado para esta área.');
    assertUniquePlans(view.plans);
    if (!view.employees.some(employee => employee.id === employeeId)) {
      throw new Error('El trabajador no pertenece al área de esta jefatura.');
    }
    const filtered = view.plans.filter(plan =>
      !(plan.employeeId === employeeId && plan.date === date));
    if (filtered.length === view.plans.length) return view;
    view.plans = filtered;
    return save(view, key);
  }

  // One area-scoped transaction for the original panel's pattern, bulk and
  // duplicate-month actions. All assignments are validated before any write.
  function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  async function applyPlanChanges(changes, key) {
    if (!Array.isArray(changes) || !changes.length || changes.length > 2000) {
      throw new Error('Se requiere una lista de cambios de turnos válida.');
    }
    const view = await load(key);
    if (!view) throw new Error('No existe calendario migrado para esta área.');
    assertUniquePlans(view.plans);
    const employees = new Set(view.employees.map(employee => employee.id));
    const allowedCodes = new Set(['A', 'B', 'C', 'D', 'L', 'V', 'P', 'X', 'Libre', 'Licencia', 'Vacaciones', 'Permiso']);
    const normalized = changes.map(change => {
      if (!change || !employees.has(change.employeeId) ||
          typeof change.date !== 'string' ||
          !isCalendarDate(change.date) ||
          (change.code !== null && !allowedCodes.has(change.code))) {
        throw new Error('La asignación contiene trabajadores, fechas o turnos no autorizados.');
      }
      return { employeeId: change.employeeId, date: change.date, code: change.code };
    });
    // Last assignment wins within the same batch; deleting and re-adding
    // the same day must not create duplicates or overwrite an unrelated row.
    const plans = new Map(view.plans.map(plan =>
      [plan.employeeId + ':' + plan.date, plan]));
    for (const change of normalized) {
      const lookup = change.employeeId + ':' + change.date;
      if (change.code === null) {
        plans.delete(lookup);
      } else {
        const previous = plans.get(lookup);
        plans.set(lookup, previous
          ? { ...previous, code: change.code }
          : { id: crypto.randomUUID(), employeeId: change.employeeId,
              date: change.date, code: change.code });
      }
    }
    view.plans = [...plans.values()];
    return save(view, key);
  }

  window.ShiftControlAreaCalendar = Object.freeze({ load, save, upsertPlan, removePlan, applyPlanChanges });
})();
