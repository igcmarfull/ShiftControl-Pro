(function () {
  'use strict';

  // Pure preview only: no database writes, no global state changes.
  // Do not treat this as a complete migration of operational state.
  const AREAS = ['ESTACION', 'TIENDA'];
  function partitionEmployeesAndPlans(source) {
    if (!source || !Array.isArray(source.employees) || !Array.isArray(source.plans)) {
      throw new Error('Se requieren listas de trabajadores y turnos válidas.');
    }
    const output = {
      ESTACION: { employees: [], plans: [] },
      TIENDA: { employees: [], plans: [] },
      UNASSIGNED: { employees: [], plans: [] },
      unresolvedPlans: []
    };
    const owners = new Map();
    for (const employee of source.employees) {
      if (!employee || employee.id === undefined || employee.id === null) {
        throw new Error('Trabajador sin identificador.');
      }
      if (owners.has(employee.id)) {
        throw new Error('Identificador de trabajador duplicado.');
      }
      const area = AREAS.includes(employee.area) ? employee.area : 'UNASSIGNED';
      owners.set(employee.id, area);
      output[area].employees.push(structuredClone(employee));
    }
    for (const plan of source.plans) {
      if (!plan || !owners.has(plan.employeeId)) {
        output.unresolvedPlans.push(structuredClone(plan));
        continue;
      }
      output[owners.get(plan.employeeId)].plans.push(structuredClone(plan));
    }
    // Attendance, additional shifts and absences are employee-owned records.
    // Never guess ownership for missing, empty or unknown employee IDs.
    for (const collection of ['executions', 'additional', 'absences']) {
      if (source[collection] !== undefined && !Array.isArray(source[collection])) {
        throw new Error('Colección inválida: ' + collection);
      }
      for (const area of [...AREAS, 'UNASSIGNED']) {
        output[area][collection] = [];
      }
      output['unresolved' + collection[0].toUpperCase() + collection.slice(1)] = [];
      for (const item of source[collection] || []) {
        const owner = item && owners.get(item.employeeId);
        const target = owner
          ? output[owner][collection]
          : output['unresolved' + collection[0].toUpperCase() + collection.slice(1)];
        target.push(structuredClone(item));
      }
    }
    // Holidays are not assigned to an employee in the current model.
    // They must remain shared/admin-managed; never copy into area buckets.
    if (source.holidays !== undefined && !Array.isArray(source.holidays)) {
      throw new Error('Colección inválida: holidays');
    }
    output.sharedHolidays = structuredClone(source.holidays || []);
    return output;
  }

  // Preflight for an ADMIN-driven migration. No writes are performed.
  // Fail closed while any worker or operational record lacks a clear owner.
  function migrationReadiness(partition) {
    if (!partition || !partition.ESTACION || !partition.TIENDA ||
        !partition.UNASSIGNED) {
      throw new Error('Partición incompleta.');
    }
    const required = [
      ['UNASSIGNED', 'employees'], ['UNASSIGNED', 'plans'],
      ['UNASSIGNED', 'executions'], ['UNASSIGNED', 'additional'],
      ['UNASSIGNED', 'absences'], ['unresolvedPlans'],
      ['unresolvedExecutions'], ['unresolvedAdditional'],
      ['unresolvedAbsences']
    ];
    for (const [bucket, collection] of required) {
      const records = collection ? partition[bucket]?.[collection] : partition[bucket];
      if (!Array.isArray(records)) {
        throw new Error('Partición inválida: ' + bucket +
          (collection ? '.' + collection : ''));
      }
    }
    const counts = {
      unassignedEmployees: partition.UNASSIGNED.employees.length,
      unassignedPlans: partition.UNASSIGNED.plans.length,
      unassignedExecutions: partition.UNASSIGNED.executions.length,
      unassignedAdditional: partition.UNASSIGNED.additional.length,
      unassignedAbsences: partition.UNASSIGNED.absences.length,
      unresolvedPlans: partition.unresolvedPlans.length,
      unresolvedExecutions: partition.unresolvedExecutions.length,
      unresolvedAdditional: partition.unresolvedAdditional.length,
      unresolvedAbsences: partition.unresolvedAbsences.length
    };
    const blockers = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count }));
    return { ready: blockers.length === 0, blockers, counts };
  }

  // Inventory every legacy top-level field before migrating. A field not
  // explicitly accounted for must remain in app_state until reviewed;
  // silently dropping it would risk losing operational information.
  function migrationInventory(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('Estado operacional inválido.');
    }
    const partitioned = ['employees', 'plans', 'executions', 'additional', 'absences'];
    const shared = ['holidays'];
    const known = new Set([...partitioned, ...shared]);
    const unexpected = Object.keys(source).filter(key => !known.has(key)).sort();
    const counts = {};
    for (const key of [...partitioned, ...shared]) {
      if (source[key] !== undefined && !Array.isArray(source[key])) {
        throw new Error('Colección inválida: ' + key);
      }
      counts[key] = (source[key] || []).length;
    }
    return {
      counts,
      unexpected,
      // Readiness for copying is intentionally stricter than the employee
      // ownership report: any unreviewed field blocks automatic cutover.
      complete: unexpected.length === 0
    };
  }

  // Build two immutable-to-the-caller snapshots only after a complete
  // ownership and schema preflight. This NEVER writes to Supabase.
  function prepareAreaSnapshots(source) {
    const inventory = migrationInventory(source);
    const partition = partitionEmployeesAndPlans(source);
    const readiness = migrationReadiness(partition);
    if (!inventory.complete || !readiness.ready) {
      const problems = [
        ...inventory.unexpected.map(key => 'Campo sin mapear: ' + key),
        ...readiness.blockers.map(item => item.name + ': ' + item.count)
      ];
      throw new Error('Migración bloqueada. ' + problems.join('; '));
    }
    const names = ['employees', 'plans', 'executions', 'additional', 'absences'];
    const result = {};
    for (const area of AREAS) {
      const data = {};
      for (const name of names) {
        data[name] = structuredClone(partition[area][name]);
      }
      result[area] = data;
    }
    // Verify no operational record was omitted or duplicated.
    for (const name of names) {
      const original = source[name] || [];
      const count = result.ESTACION[name].length + result.TIENDA[name].length;
      if (count !== original.length) {
        throw new Error('Cantidad inconsistente de ' + name + '.');
      }
    }
    return {
      ESTACION: result.ESTACION,
      TIENDA: result.TIENDA,
      // Holidays are shared and must not leak into area snapshots.
      sharedHolidays: structuredClone(partition.sharedHolidays)
    };
  }

  // A CHIEF receives only a detached, area-scoped snapshot. This is a
  // preparation helper, NOT a substitute for Supabase RLS or secure bootstrap.
  function snapshotForRole(partition, context) {
    if (!context || !context.companyId) {
      throw new Error('Se requiere una sesión de empresa válida.');
    }
    if (context.role === 'ADMIN') {
      return structuredClone(partition);
    }
    if (context.role !== 'CHIEF' || !AREAS.includes(context.area)) {
      throw new Error('No existe acceso autorizado a esta área.');
    }
    const scoped = partition && partition[context.area];
    if (!scoped || !Array.isArray(scoped.employees) || !Array.isArray(scoped.plans)) {
      throw new Error('Datos de área no disponibles.');
    }
    return structuredClone(scoped);
  }

  // Explicit fresh-calendar preview for disposable historical test records.
  // Retains workers, never writes, and reports every collection that would be
  // excluded. This must never be silently substituted for historical migration.
  function prepareFreshCalendars(source) {
    const inventory = migrationInventory(source);
    if (!inventory.complete) {
      throw new Error('Campos sin revisar: ' + inventory.unexpected.join(', '));
    }
    const partition = partitionEmployeesAndPlans(source);
    if (partition.UNASSIGNED.employees.length) {
      throw new Error('Clasifica todos los trabajadores antes de iniciar calendarios nuevos.');
    }
    const result = {};
    for (const area of AREAS) {
      result[area] = {
        employees: structuredClone(partition[area].employees),
        plans: [], executions: [], additional: [], absences: []
      };
    }
    return {
      ESTACION: result.ESTACION,
      TIENDA: result.TIENDA,
      sharedHolidays: structuredClone(partition.sharedHolidays),
      excludedTestRecords: Object.fromEntries(
        ['plans', 'executions', 'additional', 'absences'].map(
          key => [key, (source[key] || []).length]
        )
      ),
      // Require a deliberate ADMIN action and backup before using this output.
      previewOnly: true
    };
  }

  window.ShiftControlAreaPartition = Object.freeze({
    partitionEmployeesAndPlans,
    snapshotForRole,
    migrationReadiness,
    migrationInventory,
    prepareAreaSnapshots,
    prepareFreshCalendars
  });
})();
