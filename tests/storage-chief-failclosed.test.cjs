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
    await assert.rejects(window.ShiftControlStorage.bootstrap(), error =>
      error.code === 'AUTH_AREA_STORAGE_CUTOVER_REQUIRED');
    assert.equal(queries, 0);
    assert.equal(cacheWrites, 0);
  }
  console.log('Legacy CHIEF bootstrap fails closed for all area assignments.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
