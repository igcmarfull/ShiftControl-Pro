// Run: node tests/storage-legacy-guard.test.cjs
// Offline test: verifies the real storage wrapper rejects area-chief saves
// BEFORE the original legacy save can write localStorage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/storage.js'), 'utf8');

function fixture(role, area) {
  const context = { companyId: 'company-test', role, area };
  let originalSaves = 0;
  let localWrites = 0;
  const storage = {
    setItem() { localWrites++; },
    getItem() { return null; }
  };
  const window = {
    SHIFTCONTROL_CONFIG: { stateKey: 'state' },
    AuthContext: { get: () => context },
    save() { originalSaves++; },
    ShiftControlState: { get: () => ({ employees: [], plans: [] }) }
  };
  const sandbox = vm.createContext({
    window, localStorage: storage,
    console: { info() {}, warn() {} },
    clearTimeout() {}, setTimeout() { throw new Error('Unexpected remote sync'); }
  });
  vm.runInContext(source, sandbox);
  return { window, getOriginalSaves: () => originalSaves, getLocalWrites: () => localWrites };
}

for (const area of ['ESTACION', 'TIENDA']) {
  const chief = fixture('CHIEF', area);
  assert.throws(() => chief.window.save(), /acceso por área todavía no está habilitado/);
  assert.equal(chief.getOriginalSaves(), 0);
  assert.equal(chief.getLocalWrites(), 0);
}
const admin = fixture('ADMIN', null);
admin.window.save();
assert.equal(admin.getOriginalSaves(), 1);
assert.equal(admin.getLocalWrites(), 0); // not bootstrapped yet
console.log('PASS: legacy save blocked for both area CHIEFs before local writes.');
console.log('NOT COVERED: browser integration, Supabase RLS or production cutover.');
