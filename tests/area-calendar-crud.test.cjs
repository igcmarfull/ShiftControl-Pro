'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/modules/planning/area-calendar-adapter.js'), 'utf8');
const clone = x => JSON.parse(JSON.stringify(x));
async function main() {
  for (const area of ['ESTACION', 'TIENDA']) {
    const context = { companyId: 'c', userId: 'u', role: 'CHIEF', area };
    let remote = { revision: 1, data: {
      employees: [{ id: 'own', area }], plans: [],
      executions: [], additional: [], absences: []
    } };
    let writes = 0;
    const window = {
      AuthContext: { get: () => context },
      ShiftControlStorage: {
        readOwnAreaState: async () => clone(remote),
        writeOwnAreaState: async (key, data, revision) => {
          assert.equal(revision, remote.revision);
          writes++;
          remote = { revision: revision + 1, data };
          return remote.revision;
        }
      }
    };
    vm.runInNewContext(source, {
      window, structuredClone: clone,
      crypto: { randomUUID: () => 'new-' + writes }
    });
    const api = window.ShiftControlAreaCalendar;
    await api.upsertPlan({ employeeId: 'own', date: '2026-10-13', code: 'A' });
    assert.equal(remote.data.plans.length, 1);
    assert.equal(remote.revision, 2);
    await api.upsertPlan({ employeeId: 'own', date: '2026-10-13', code: 'B' });
    assert.equal(remote.data.plans.length, 1);
    assert.equal(remote.data.plans[0].code, 'B');
    await assert.rejects(api.upsertPlan({
      employeeId: 'other', date: '2026-10-13'
    }));
    await api.upsertPlan({ employeeId: 'own', date: '2026-10-15', code: 'C',
      id: 'injected-id', area: 'TIENDA', privateNotes: 'should-not-persist' });
    assert.equal(remote.data.plans.find(p => p.date === '2026-10-15').id !== 'injected-id', true);
    assert.equal(Object.hasOwn(remote.data.plans.find(p => p.date === '2026-10-15'), 'privateNotes'), false);
    await api.removePlan('own', '2026-10-15');
    await assert.rejects(api.upsertPlan({ employeeId: 'own', date: '2026-02-31', code: 'A' }));
    await assert.rejects(api.removePlan('own', '2026-02-31'));
    assert.equal(writes, 4);
    await api.removePlan('own', '2026-10-13');
    assert.equal(remote.data.plans.length, 0);
    assert.equal(writes, 5);
    await api.removePlan('own', '2026-10-13');
    assert.equal(writes, 5);
    await api.applyPlanChanges([
      { employeeId: 'own', date: '2026-11-01', code: 'A' },
      { employeeId: 'own', date: '2026-11-02', code: 'B' }
    ]);
    assert.equal(remote.data.plans.length, 2);
    assert.equal(writes, 6);
    await assert.rejects(api.applyPlanChanges([
      { employeeId: 'own', date: '2026-11-03', code: 'A' },
      { employeeId: 'other', date: '2026-11-04', code: 'B' }
    ]));
    assert.equal(writes, 6, 'Invalid bulk changes must be atomic');
    await api.applyPlanChanges([
      { employeeId: 'own', date: '2026-11-01', code: null },
      { employeeId: 'own', date: '2026-11-02', code: 'C' }
    ]);
    assert.equal(remote.data.plans.length, 1);
    assert.equal(remote.data.plans[0].code, 'C');
    assert.equal(writes, 7);

    // Corrupt legacy imports must never be silently deduplicated or
    // overwritten by an edit, a removal, a bulk change, or direct save.
    const duplicate = { id: 'legacy-duplicate', employeeId: 'own',
      date: '2026-11-02', code: 'A' };
    remote.data.plans.push(duplicate);
    const beforeDuplicates = clone(remote.data.plans);
    await assert.rejects(api.upsertPlan({
      employeeId: 'own', date: '2026-11-02', code: 'B'
    }), /duplicados/);
    await assert.rejects(api.removePlan('own', '2026-11-02'), /duplicados/);
    await assert.rejects(api.applyPlanChanges([
      { employeeId: 'own', date: '2026-11-03', code: 'C' }
    ]), /duplicados/);
    const corrupted = await api.load();
    await assert.rejects(api.save(corrupted), /duplicados/);
    assert.equal(writes, 7, 'Corrupt schedules must not be persisted');
    assert.deepEqual(remote.data.plans, beforeDuplicates,
      'Rejected operations must preserve original data');
  }
  console.log('Area shift create/edit/remove regression passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
