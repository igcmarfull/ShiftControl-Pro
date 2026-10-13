'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const view = fs.readFileSync('src/modules/planning/area-calendar-view.js', 'utf8');
    await page.goto('about:blank');
    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'station-chief', role: 'CHIEF', area: 'ESTACION' };
      window.__saves = [];
      window.__loads = 0;
      window.AuthContext = { get: () => window.__ctx };
      window.ShiftControlAuth = { signOut: async () => {} };
      window.ShiftControlAreaCalendar = {
        load: async () => {
          window.__loads++;
          const area = window.__ctx.area;
          return {
            area, revision: 1,
            employees: [{ id: area === 'ESTACION' ? 'station-worker' : 'store-worker', name: area + ' worker' }],
            plans: [{ employeeId: area === 'ESTACION' ? 'station-worker' : 'store-worker', date: '2026-10-14', code: 'A' }]
          };
        },
        upsertPlan: async plan => window.__saves.push({ area: window.__ctx.area, plan }),
        removePlan: async () => {}
      };
    });
    await page.addScriptTag({ content: view });
    await page.evaluate(() => window.ShiftControlAreaCalendarView.mount());
    await page.getByText('Calendario · Isla').waitFor();
    await page.locator('#shiftcontrol-area-calendar .cal-name strong').getByText('ESTACION worker').waitFor();
    assert.equal(await page.getByText('TIENDA worker').count(), 0);
    // Chief bulk editor must be available without crossing area boundaries.
    assert.equal(await page.getByRole('button', { name: 'Asignar rango de turnos' }).count(), 1);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .area-form').count(), 3);
    assert.equal(await page.getByRole('button', { name: 'Aplicar patrón semanal' }).count(), 1);
    // Reopening the same authorized area must refresh, not silently return
    // a stale calendar (regression for the original panel's save path).
    const loadsBefore = await page.evaluate(() => window.__loads);
    await page.evaluate(() => window.ShiftControlAreaCalendarView.mount());
    await page.waitForFunction(previous => window.__loads > previous, loadsBefore);
    assert.equal(await page.locator('#shiftcontrol-area-calendar').count(), 1);

    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'store-chief', role: 'CHIEF', area: 'TIENDA' };
      window.ShiftControlAreaCalendarView.mount();
    });
    await page.getByText('Calendario · Tienda').waitFor();
    await page.locator('#shiftcontrol-area-calendar .cal-name strong').getByText('TIENDA worker').waitFor();
    assert.equal(await page.getByText('ESTACION worker').count(), 0);
    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'store-chief', role: 'CHIEF', area: null };
      window.ShiftControlAreaCalendarView.mount();
    });
    await page.getByText('Tu jefatura todavía no tiene un área asignada.').waitFor();
    assert.equal(await page.getByText('TIENDA worker').count(), 0);
    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'admin', role: 'ADMIN', area: null };
      const planning = document.createElement('section');
      planning.id = 'planning';
      document.body.append(planning);
      window.__adminReads = [];
      window.ShiftControlStorage = {
        readAreaState: async area => {
          window.__adminReads.push(area);
          return { revision: 2, data: {
            employees: [{ id: area + '-worker', name: area + ' worker' }],
            plans: [{ employeeId: area + '-worker', date: '2026-10-14', code: 'B' }]
          } };
        }
      };
      window.ShiftControlAreaCalendarView.mount();
    });
    await page.getByText('Calendarios por área · Supervisión').waitFor();
    assert.equal(await page.locator('#planning > #shiftcontrol-area-calendar').count(), 1,
      'Admin oversight must be embedded in the original planning view');
    await page.waitForFunction(() => window.__adminReads.length === 2);
    assert.deepEqual((await page.evaluate(() => window.__adminReads)).sort(), ['ESTACION', 'TIENDA']);
    assert.equal(await page.locator('#shiftcontrol-area-calendar').count(), 1);
    await page.locator('#shiftcontrol-area-calendar .calendar-grid').first().waitFor();
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').count(), 2,
      'Admin must see one monthly planning grid for each area');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-cell[role="button"]').count(), 0,
      'Admin oversight must remain read-only');
    await page.evaluate(() => window.ShiftControlAreaCalendarView.mount());
    assert.equal(await page.locator('#shiftcontrol-area-calendar').count(), 1,
      'Repeated admin mounts must not duplicate the panel');
    // An older request must not replace the selected month's results.
    await page.evaluate(() => {
      window.__pendingReads = [];
      window.ShiftControlStorage.readAreaState = area => new Promise(resolve => {
        window.__pendingReads.push({ area, resolve });
      });
      window.ShiftControlAreaCalendarView.mount();
    });
    await page.waitForFunction(() => window.__pendingReads.length === 2);
    await page.evaluate(() => {
      const picker = document.querySelector('#shiftcontrol-area-calendar input[type="month"]');
      picker.value = '2026-11';
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => window.__pendingReads.length >= 4);
    await page.evaluate(() => {
      for (const entry of window.__pendingReads.slice(2)) {
        entry.resolve({ revision: 3, data: {
          employees: [{ id: entry.area + '-worker', name: entry.area + ' worker' }],
          plans: [{ employeeId: entry.area + '-worker', date: '2026-11-04', code: 'C' }]
        } });
      }
    });
    await page.getByText('Calendarios de 2026-11 · solo lectura').waitFor();
    await page.evaluate(() => {
      for (const entry of window.__pendingReads.slice(0, 2)) {
        entry.resolve({ revision: 2, data: {
          employees: [{ id: entry.area + '-worker', name: entry.area + ' worker' }],
          plans: [{ employeeId: entry.area + '-worker', date: '2026-10-14', code: 'A' }]
        } });
      }
    });
    await page.waitForTimeout(50);
    assert.equal(await page.getByText('Calendarios de 2026-11 · solo lectura').count(), 1);
    assert.equal(await page.locator('#shiftcontrol-area-calendar td').filter({ hasText: '2026-10-14' }).count(), 0);
    console.log('PASS Chromium: station/store switching, no stale rows, missing-area fail closed, dual-area admin oversight');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
