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
      window.AuthContext = { get: () => window.__ctx };
      window.ShiftControlAuth = { signOut: async () => {} };
      window.ShiftControlAreaCalendar = {
        load: async () => {
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
      window.ShiftControlAreaCalendarView.mount();
    });
    assert.equal(await page.locator('#shiftcontrol-area-calendar').count(), 0);
    console.log('PASS Chromium: station/store switching, no stale rows, missing-area fail closed, admin unmount');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
