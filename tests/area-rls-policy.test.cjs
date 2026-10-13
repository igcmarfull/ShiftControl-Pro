// Static regression checks for the area RLS rollout.
// These complement, but DO NOT replace, authenticated database integration tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = name => fs.readFileSync('supabase/migrations/' + name, 'utf8');
const storage = read('202610120003_area_state_storage.sql');
const versioning = read('202610120004_area_state_versioning.sql');
const lockdown = read('202610120006_area_state_rpc_only_writes.sql');
test('area_state has RLS enabled and policies restricted to authenticated', () => {
  assert.match(storage, /alter table public\.area_state enable row level security/i);
  for (const name of ['select', 'insert', 'update']) {
    assert.match(storage, new RegExp('create policy area_state_' + name + '_member[\\s\\S]*?to authenticated', 'i'));
  }
});
test('each RLS policy checks active company membership and scoped CHIEF area', () => {
  for (const name of ['select', 'insert', 'update']) {
    const start = storage.indexOf('create policy area_state_' + name + '_member');
    assert.notEqual(start, -1);
    const end = storage.indexOf(';', start);
    const body = storage.slice(start, end);
    assert.match(body, /m\.company_id\s*=\s*area_state\.company_id/i);
    assert.match(body, /m\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
    assert.match(body, /m\.active\s*=\s*true/i);
    assert.match(body, /m\.role\s*=\s*'ADMIN'/i);
    assert.match(body, /m\.role\s*=\s*'CHIEF'\s+and\s+m\.area\s*=\s*area_state\.area/i);
  }
});
test('UPDATE has both USING and WITH CHECK', () => {
  const body = storage.slice(storage.indexOf('create policy area_state_update_member'));
  assert.match(body, /using\s*\(/i);
  assert.match(body, /with check\s*\(/i);
});
test('optimistic write RPC compares expected revision', () => {
  assert.match(versioning, /revision\s*=\s*p_expected_revision/i);
  assert.match(versioning, /revision\s*=\s*revision\s*\+\s*1/i);
});
test('cutover revokes direct writes and explicitly checks membership in RPC', () => {
  assert.match(lockdown, /revoke insert, update, delete on public\.area_state from anon, authenticated/i);
  assert.match(lockdown, /m\.company_id\s*=\s*p_company_id/i);
  assert.match(lockdown, /m\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(lockdown, /m\.role\s*=\s*'CHIEF' and m\.area\s*=\s*p_area/i);
  assert.match(lockdown, /p_expected_revision/i);
});
