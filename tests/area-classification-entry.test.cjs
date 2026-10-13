'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/modules/employees/area-classification-entry.js'), 'utf8');
const elements = new Map();
const makeNode = (tag) => ({
  tag, dataset: {}, style: {}, children: [], hidden: false,
  append(...nodes) { this.children.push(...nodes); },
  prepend(node) { this.children.unshift(node); },
  replaceChildren() { this.children = []; },
  remove() { if (this.id) elements.delete(this.id); },
  addEventListener(type, fn) { this['on_' + type] = fn; },
  querySelector() { return null; }
});
const employees = makeNode('section');
const document = {
  getElementById(id) { return id === 'employees' ? employees : elements.get(id) || null; },
  createElement: makeNode,
  addEventListener() {}
};
let current = { companyId: 'c', userId: 'a', role: 'ADMIN' };
const window = {
  AuthContext: { get: () => current },
  EmployeeAreaClassification: { render: () => {} },
  addEventListener() {},
  renderEmployees() {}
};
vm.runInNewContext(source, { window, document });
const mount = window.ShiftControlAreaClassificationEntry.mount;
mount();
assert.equal(employees.children.length, 1);
const first = employees.children[0];
elements.set(first.id, first);
assert.equal(first.dataset.owner, 'a');
mount();
assert.equal(employees.children.length, 1, 'mount is idempotent');
current = { companyId: 'c', userId: 'b', role: 'ADMIN' };
mount();
const second = employees.children.at(-1);
assert.notEqual(second, first);
assert.equal(second.dataset.owner, 'b');
elements.set(second.id, second);
current = { companyId: 'c', userId: 'chief', role: 'CHIEF', area: 'TIENDA' };
mount();
assert.equal(elements.has(second.id), false, 'chief must not retain admin panel');
console.log('ADMIN classification entry session checks passed.');
