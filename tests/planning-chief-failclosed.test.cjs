'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/modules/planning/planning.js', 'utf8');
for (const area of [null, 'ESTACION', 'TIENDA']) {
  let saves = 0;
  const state = { plans: [{ id: 'p1', employeeId: 'e1', date: '2026-10-13', code: 'A' }] };
  const window = {
    AuthContext: { get: () => ({ companyId: 'c1', userId: 'chief', role: 'CHIEF', area }) },
    ShiftControlState: { get: () => state, save: () => { saves++; } }
  };
  vm.runInNewContext(source, { window, console, crypto: { randomUUID: () => 'new' } });
  const planner = window.PlanningModule;
  for (const mutate of [
    () => planner.create({ employeeId: 'e1', date: '2026-10-13', code: 'B' }),
    () => planner.remove('p1'),
    () => planner.clearEmployee('e1', '2026-10-13'),
    () => planner.removeEmployeePlans('e1')
  ]) assert.throws(mutate, /calendario de tu área/);
  assert.equal(state.plans.length, 1);
  assert.equal(state.plans[0].code, 'A');
  assert.equal(saves, 0);
}
console.log('Legacy chief mutations fail closed regardless of area assignment.');
