'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/storage.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
async function main() {
  let context = { companyId: 'company-a', userId: 'admin-a', role: 'ADMIN', area: null };
  let resolveRemote;
  let upserts = 0;
  let cacheWrites = 0;
  let replacements = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({
          maybeSingle: () => new Promise(resolve => { resolveRemote = resolve; })
        }) })
      }),
      upsert: async () => { upserts++; return { error: null }; }
    })
  };
  const window = {
    SHIFTCONTROL_CONFIG: { stateKey: 'main' },
    AuthContext: { get: () => context },
    ShiftControlAuth: { getClient: () => client },
    ShiftControlState: {
      get: () => ({ employees: [] }),
      replace: value => { replacements++; return value; }
    }
  };
  const localStorage = {
    getItem: () => null,
    setItem: () => { cacheWrites++; }
  };
  vm.runInNewContext(source, {
    window, localStorage, structuredClone: clone,
    console: { info() {}, warn() {} },
    setTimeout: () => 1, clearTimeout() {}
  });
  const storage = window.ShiftControlStorage;
  await storage.pushState();
  assert.equal(upserts, 0);
  const bootstrap = storage.bootstrap();
  for (let i = 0; i < 50 && !resolveRemote; i++) await Promise.resolve();
  assert.equal(typeof resolveRemote, 'function');
  context = { ...context, userId: 'admin-b' };
  resolveRemote({ data: { data: { employees: [] } }, error: null });
  await assert.rejects(bootstrap, error =>
    error.code === 'AUTH_SESSION_CHANGED_DURING_BOOTSTRAP');
  assert.equal(replacements, 0);
  assert.equal(cacheWrites, 0);
  await storage.pushState();
  assert.equal(upserts, 0);
  assert.equal(cacheWrites, 0);
  console.log('Storage account-switch isolation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
