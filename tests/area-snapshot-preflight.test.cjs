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

test('fresh-calendar preview retains classified workers but explicitly excludes historical test records', () => {
  const input = example();
  const output = api.prepareFreshCalendars(input);
  assert.equal(output.previewOnly, true);
  assert.equal(output.ESTACION.employees.length, 1);
  assert.equal(output.TIENDA.employees.length, 1);
  for (const area of ['ESTACION', 'TIENDA']) {
    for (const collection of ['plans', 'executions', 'additional', 'absences']) {
      assert.equal(output[area][collection].length, 0);
    }
  }
  assert.equal(output.excludedTestRecords.plans, 2);
  assert.equal(output.excludedTestRecords.executions, 1);
  assert.equal(output.excludedTestRecords.additional, 1);
  assert.equal(output.excludedTestRecords.absences, 1);
  assert.equal(output.sharedHolidays.length, 1);
  assert.equal(input.plans.length, 2);
});
test('fresh-calendar preview blocks unassigned workers and unknown fields', () => {
  const input = example();
  input.employees[0].area = null;
  assert.throws(() => api.prepareFreshCalendars(input), /Clasifica todos/);
  input.employees[0].area = 'ESTACION';
  input.settings = { flag: true };
  assert.throws(() => api.prepareFreshCalendars(input), /Campos sin revisar/);
});

test('legacy Isla workers map to station without mutating original employees', () => {
  const input = example();
  input.employees[0].area = 'Isla';
  const migrated = api.prepareAreaSnapshots(input);
  const fresh = api.prepareFreshCalendars(input);
  assert.equal(migrated.ESTACION.employees[0].area, 'ESTACION');
  assert.equal(fresh.ESTACION.employees[0].area, 'ESTACION');
  assert.equal(fresh.TIENDA.employees.length, 1);
  assert.equal(input.employees[0].area, 'Isla');
});
test('unknown area still blocks migration', () => {
  const input = example();
  input.employees[0].area = 'BODEGA';
  assert.throws(() => api.prepareFreshCalendars(input), /Clasifica todos/);
});

test('legacy 13 Isla employees are recognized while unmapped fields block cutover', () => {
  const input = {
    employees: Array.from({length:13},(_,i)=>({id:'isla-'+i,area:'Isla'})),
    plans: [], executions: [], additional: [], absences: [], holidays: [],
    settings: {preserve:true}
  };
  const report = api.migrationFieldReport(input);
  assert.equal(report.stationWorkers,13);
  assert.equal(report.storeWorkers,0);
  assert.equal(report.unassignedWorkers,0);
  assert.equal(report.totalFields,7);
  assert.equal(report.recognizedFields,6);
  assert.equal(report.unmappedFields[0],'settings');
  assert.equal(report.safeToPrepare,false);
  assert.equal(input.employees[0].area,'Isla');
  assert.throws(()=>api.prepareFreshCalendars(input),/Campos sin revisar/);
});

test('preserving fresh preview keeps every administrative field in untouched legacy source', () => {
  const input = example();
  input.employees[0].area = 'Isla';
  input.audit = [{id:'a'}];
  input.cashShortages = [{id:'c'}];
  input.settings = {sensitive:'admin'};
  input.incidents = [{id:'i'}];
  const original = structuredClone(input);
  const preview = api.preparePreservingFreshCalendars(input);
  assert.equal(preview.previewOnly,true);
  assert.equal(preview.requiresBackupAndAdminReview,true);
  assert.equal(preview.ESTACION.employees[0].area,'ESTACION');
  assert.equal(preview.TIENDA.employees.length,1);
  assert.equal(preview.ESTACION.plans.length,0);
  assert.equal(preview.TIENDA.plans.length,0);
  for (const key of ['audit','cashShortages','settings','incidents']) {
    assert.ok(preview.preservedInLegacy.includes(key));
    assert.equal(preview.ESTACION[key],undefined);
    assert.equal(preview.TIENDA[key],undefined);
  }
  assert.deepEqual(input,original);
});
test('preserving fresh preview rejects unknown employee areas', () => {
  const input = example();
  input.employees[0].area='UNKNOWN';
  assert.throws(()=>api.preparePreservingFreshCalendars(input),/sin área/);
});
