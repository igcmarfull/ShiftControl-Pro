const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/modules/area-partition-preview.js', 'utf8');
const sandbox = { window: {}, structuredClone };
vm.runInNewContext(source, sandbox);
const api = sandbox.window.ShiftControlAreaPartition;
const example = () => ({
  employees: [{ id: 'e1', area: 'ESTACION' }, { id: 't1', area: 'TIENDA' }],
  plans: [{ employeeId: 'e1', date: '2026-10-14' }, { employeeId: 't1', date: '2026-10-14' }],
  executions: [{ employeeId: 'e1' }],
  additional: [{ employeeId: 't1' }],
  absences: [{ employeeId: 'e1' }],
  holidays: [{ date: '2026-09-18' }]
});
test('preserves counts and never exposes other-area workers or shared holidays', () => {
  const input = example();
  const output = api.prepareAreaSnapshots(input);
  assert.equal(output.ESTACION.plans.length, 1);
  assert.equal(output.TIENDA.plans.length, 1);
  assert.equal(output.ESTACION.employees[0].id, 'e1');
  assert.equal(output.TIENDA.employees[0].id, 't1');
  assert.equal(output.ESTACION.holidays, undefined);
  assert.equal(output.TIENDA.holidays, undefined);
  assert.equal(output.sharedHolidays.length, 1);
  output.ESTACION.employees[0].id = 'modified';
  assert.equal(input.employees[0].id, 'e1');
});
test('refuses unassigned employees', () => {
  const input = example();
  delete input.employees[0].area;
  assert.throws(() => api.prepareAreaSnapshots(input), /Migración bloqueada/);
});
test('refuses orphan plans', () => {
  const input = example();
  input.plans.push({ employeeId: 'unknown' });
  assert.throws(() => api.prepareAreaSnapshots(input), /unresolvedPlans/);
});
test('refuses unreviewed legacy fields rather than silently discarding them', () => {
  const input = example();
  input.settings = { critical: true };
  assert.throws(() => api.prepareAreaSnapshots(input), /Campo sin mapear: settings/);
});
test('refuses duplicated worker IDs', () => {
  const input = example();
  input.employees.push({ id: 'e1', area: 'TIENDA' });
  assert.throws(() => api.prepareAreaSnapshots(input), /duplicado/);
});
test('refuses orphan attendance', () => {
  const input = example();
  input.executions.push({ employeeId: 'missing' });
  assert.throws(() => api.prepareAreaSnapshots(input), /unresolvedExecutions/);
});
