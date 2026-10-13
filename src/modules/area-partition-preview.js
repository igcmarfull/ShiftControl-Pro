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
    return output;
  }

  window.ShiftControlAreaPartition = Object.freeze({ partitionEmployeesAndPlans });
})();
