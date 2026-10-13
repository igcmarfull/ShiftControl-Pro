// Run: node tests/area-modules.test.cjs
// Dependency-free smoke tests against the real browser modules, without Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(role, area) {
  const state = {
    employees: [
      { id: 'e1', name: 'Estación', area: 'ESTACION' },
      { id: 'e2', name: 'Tienda', area: 'TIENDA' },
      { id: 'e3', name: 'Pendiente' }
    ],
    plans: [
      { id: 'p1', employeeId: 'e1', date: '2026-10-12' },
      { id: 'p2', employeeId: 'e2', date: '2026-10-12' }
    ]
  };
  let saves = 0;
  const context = { companyId: 'test-company', role, area };
  const window = {
    AuthContext: { get: () => context },
    ShiftControlState: { get: () => state, save: () => { saves++; } }
  };
  const sandbox = vm.createContext({ window, console, crypto: require('node:crypto').webcrypto });
  for (const file of ['src/modules/employees/employees.js', 'src/modules/planning/planning.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return { state, window, context, getSaves: () => saves };
}

const admin = fixture('ADMIN', null);
assert.equal(admin.window.EmployeeModule.getByArea('ESTACION').length, 1);
assert.equal(admin.window.EmployeeModule.getByArea('TIENDA').length, 1);
assert.equal(admin.window.EmployeeModule.getUnassigned().length, 1);
assert.equal(admin.window.PlanningModule.getByArea('ESTACION').length, 1);
assert.equal(admin.window.PlanningModule.getByArea('TIENDA').length, 1);
assert.equal(admin.window.EmployeeModule.getAreaSummary().total, 3);
admin.window.EmployeeModule.assignArea('e3', 'TIENDA');
assert.equal(admin.window.EmployeeModule.getAreaSummary().TIENDA, 2);
assert.equal(admin.getSaves(), 1);
assert.throws(() => admin.window.EmployeeModule.assignArea('e3', 'INVALID'), /Area invalida/);

for (const area of ['ESTACION', 'TIENDA']) {
  const chief = fixture('CHIEF', area);
  const before = JSON.stringify(chief.state);
  assert.throws(() => chief.window.EmployeeModule.assignArea('e3', area), /Solo ADMIN/);
  assert.throws(() => chief.window.EmployeeModule.create({ name: 'Nuevo' }), /aún no están habilitados/);
  assert.throws(() => chief.window.EmployeeModule.update('e1', { name: 'Otro' }), /aún no están habilitados/);
  assert.throws(() => chief.window.EmployeeModule.remove('e1'), /aún no están habilitados/);
  assert.throws(() => chief.window.PlanningModule.create({ employeeId: 'e1', date: '2026-10-13' }), /calendario de tu área/);
  assert.throws(() => chief.window.PlanningModule.remove('p1'), /calendario de tu área/);
  assert.throws(() => chief.window.PlanningModule.clearEmployee('e1', '2026-10-12'), /calendario de tu área/);
  assert.throws(() => chief.window.PlanningModule.removeEmployeePlans('e1'), /calendario de tu área/);
  assert.equal(JSON.stringify(chief.state), before);
  assert.equal(chief.getSaves(), 0);
}

console.log('PASS: ADMIN classification, area filters, CHIEF mutation guards (offline).');
console.log('NOT COVERED: Supabase RLS, RPC, browser integration, production cutover.');
