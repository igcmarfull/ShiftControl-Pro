'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/storage.js'), 'utf8');
async function main() {
  for (const area of [null, 'ESTACION', 'TIENDA']) {
    let queries = 0;
    let cacheWrites = 0;
    const window = {
      SHIFTCONTROL_CONFIG: { stateKey: 'main' },
      AuthContext: { get: () => ({
        companyId: 'company', userId: 'chief', role: 'CHIEF', area
      }) },
      ShiftControlAuth: { getClient: () => { queries++; throw Error('Unexpected query'); } },
      ShiftControlState: { get: () => ({ employees: [] }) }
    };
    vm.runInNewContext(source, {
      window, localStorage: {
        getItem: () => null,
        setItem: () => { cacheWrites++; }
      },
      structuredClone: value => JSON.parse(JSON.stringify(value)),
      console: { info() {}, warn() {} },
      setTimeout: () => 1, clearTimeout() {}
    });
    assert.equal(await window.ShiftControlStorage.bootstrap(), null);
    assert.equal(window.ShiftControlStorage.isReady(), false);
    assert.equal(window.ShiftControlStorage.getActiveCompanyId(), null);
    assert.equal(queries, 0);
    assert.equal(cacheWrites, 0);
  }
  console.log('Legacy CHIEF bootstrap skips company-wide state for all area assignments.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
