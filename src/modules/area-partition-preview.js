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

  window.ShiftControlAreaPartition = Object.freeze({
    partitionEmployeesAndPlans,
    snapshotForRole,
    migrationReadiness
  });
})();
