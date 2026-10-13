'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/modules/planning/area-calendar-view.js'), 'utf8');
async function main() {
  for (const area of [null, 'ESTACION', 'TIENDA']) {
    const context = { companyId: 'c', userId: 'u', role: 'CHIEF', area };
    const nodes = new Map();
    const classes = new Set();
    let loads = 0;
    const createElement = tag => ({
      tag, id: null, dataset: {}, style: {}, children: [],
      append(...children) {
        this.children.push(...children);
        for (const child of children) if (child.id) nodes.set(child.id, child);
      },
      replaceChildren() { this.children = []; },
      remove() { nodes.delete(this.id); },
      setAttribute() {},
      addEventListener() {}
    });
    const body = createElement('body');
    body.classList = {
      add: x => classes.add(x),
      remove: x => classes.delete(x),
      toggle: (x, value) => value ? classes.add(x) : classes.delete(x)
    };
    const document = {
      body, head: createElement('head'), createElement,
      getElementById: id => nodes.get(id) || null,
      addEventListener() {}
    };
    const window = {
      AuthContext: { get: () => context },
      ShiftControlAreaCalendar: {
        load: async () => { loads++; return null; }
      },
      addEventListener() {}
    };
    vm.runInNewContext(source, { window, document });
    window.ShiftControlAreaCalendarView.mount();
    assert.equal(classes.has('shiftcontrol-area-chief-mode'), true);
    await Promise.resolve();
    if (!area) assert.equal(loads, 0);
    else assert.equal(loads, 1);
  }
  console.log('Area-chief calendar UI initial states passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
