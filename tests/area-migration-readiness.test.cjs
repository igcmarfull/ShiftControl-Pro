'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '../src/modules/area-partition-preview.js'), 'utf8'),
  { window, structuredClone: global.structuredClone }
);
const { partitionEmployeesAndPlans, migrationReadiness, snapshotForRole } =
  window.ShiftControlAreaPartition;

function snapshot(extra = {}) {
  return {
    employees: [{ id: 'e1', area: 'ESTACION' }, { id: 't1', area: 'TIENDA' }],
    plans: [{ employeeId: 'e1' }, { employeeId: 't1' }],
    executions: [{ employeeId: 'e1' }],
    additional: [],
    absences: [],
    ...extra
  };
}
const clean = partitionEmployeesAndPlans(snapshot());
assert.equal(migrationReadiness(clean).ready, true);
assert.equal(snapshotForRole(clean, { companyId: 'c', role: 'CHIEF', area: 'TIENDA' }).employees.length, 1);
const dirty = partitionEmployeesAndPlans(snapshot({
  employees: [...snapshot().employees, { id: 'u1' }],
  plans: [...snapshot().plans, { employeeId: 'u1' }, { employeeId: 'missing' }],
  executions: [{ employeeId: 'missing' }],
  additional: [{ employeeId: 'u1' }],
  absences: [{ employeeId: 'missing' }]
}));
const report = migrationReadiness(dirty);
assert.equal(report.ready, false);
for (const key of [
  'unassignedEmployees', 'unassignedPlans', 'unassignedAdditional',
  'unresolvedPlans', 'unresolvedExecutions', 'unresolvedAbsences'
]) assert.equal(report.counts[key], 1, key);
assert.equal(report.blockers.length, 6);
assert.throws(() => partitionEmployeesAndPlans(snapshot({
  employees: [{ id: 'same', area: 'ESTACION' }, { id: 'same', area: 'TIENDA' }]
})), /duplicado/);
assert.throws(() => snapshotForRole(clean, { companyId: 'c', role: 'CHIEF' }), /autorizado/);
console.log('Area migration readiness tests passed.');
