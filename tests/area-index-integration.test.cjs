'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [
  'src/storage.js',
  'src/modules/area-partition-preview.js',
  'src/modules/employees/area-classification.js',
  'src/modules/employees/area-classification-entry.js',
  'src/modules/planning/area-calendar-adapter.js',
  'src/app/app.js'
];
let previous = -1;
for (const script of scripts) {
  const tag = '<script src="' + script + '"></script>';
  const index = html.indexOf(tag);
  assert.ok(index > previous, script + ' must load after its dependencies');
  assert.equal(html.indexOf(tag, index + 1), -1, script + ' loaded twice');
  previous = index;
}
assert.match(html, /id="employees" class="view"/);
assert.match(html, /src\/modules\/employees\/employees\.js/);
console.log('ShiftControl area script integration passed.');
