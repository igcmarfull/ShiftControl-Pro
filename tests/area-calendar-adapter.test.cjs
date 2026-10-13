'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/modules/planning/area-calendar-adapter.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const areas = ['ESTACION', 'TIENDA'];
async function main() {
  for (const area of areas) {
    let context = { companyId: 'company', userId: 'user', role: 'CHIEF', area };
    let writes = [];
    const row = { revision: 4, data: {
      employees: [{ id: 'e', area }], plans: [{ employeeId: 'e' }],
      executions: [], additional: [], absences: []
    }};
    const window = {
      AuthContext: { get: () => context },
      ShiftControlStorage: {
        readOwnAreaState: async () => row,
        writeOwnAreaState: async (...args) => { writes.push(args); return 5; }
      }
    };
    vm.runInNewContext(source, { window, structuredClone: clone });
    const api = window.ShiftControlAreaCalendar;
    const view = await api.load();
    assert.equal(view.area, area);
    assert.equal(view.revision, 4);
    view.employees[0].name = 'Edited';
    assert.equal(row.data.employees[0].name, undefined, 'load must detach remote data');
    const saved = await api.save(view);
    assert.equal(saved.revision, 5);
    assert.equal(writes[0][2], 4, 'must pass expected revision');
    assert.equal(writes[0][1].employees[0].area, area);
    assert.equal(writes[0][1].employees[0].name, 'Edited');
    await assert.rejects(api.save({ ...view, area: area === 'TIENDA' ? 'ESTACION' : 'TIENDA' }));
    await assert.rejects(api.save({ ...view, revision: undefined }));
    assert.equal(writes.length, 1, 'invalid input must not write');
    context = { ...context, role: 'ADMIN' };
    await assert.rejects(api.load());
    await assert.rejects(api.save(view));
  }
  console.log('Area calendar adapter: all regression assertions passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
