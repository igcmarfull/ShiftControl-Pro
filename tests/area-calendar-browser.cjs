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
        removePlan: async () => {},
        applyPlanChanges: async changes => window.__saves.push({
          area: window.__ctx.area, changes
        })
      };
    });
    await page.evaluate(() => {
      const sidebar = document.createElement('nav');
      sidebar.className = 'sidebar';
      for (const destination of ['planning', 'employees']) {
        const link = document.createElement('button');
        link.dataset.view = destination;
        link.textContent = destination;
        sidebar.append(link);
      }
      document.body.append(sidebar);
    });
    await page.addScriptTag({ content: view });
    await page.evaluate(() => window.ShiftControlAreaCalendarView.mount());
    await page.getByText('Calendario · Isla').waitFor();
    assert.equal(await page.locator('.sidebar [data-view="employees"]').isVisible(), false,
      'Chief must not navigate into company-wide legacy employee views');
    assert.equal(await page.locator('.sidebar [data-view="planning"]').isVisible(), true,
      'Chief planning navigation remains available');
    await page.locator('#shiftcontrol-area-calendar .cal-name strong').getByText('ESTACION worker').waitFor();
    assert.equal(await page.getByText('TIENDA worker').count(), 0);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .area-staffing-summary').count(), 1,
      'Chief must see the area-only staffing coverage summary');
    // Worker search must filter rows in both the original monthly grid and
    // the weekly grid without exposing workers from another area.
    const workerSearch = page.getByRole('searchbox', { name: 'Buscar trabajador del área' });
    await workerSearch.fill('inexistente');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-row:visible').count(), 0);
    await workerSearch.fill('ESTACION');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-row:visible').count(), 1);
    await page.getByRole('button', { name: 'Actualizar turnos' }).click();
    await page.getByRole('searchbox', { name: 'Buscar trabajador del área' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Buscar trabajador del área' }).inputValue(), 'ESTACION');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-row:visible').count(), 1);
    await page.getByRole('searchbox', { name: 'Buscar trabajador del área' }).fill('inexistente');
    await page.getByRole('button', { name: 'Actualizar turnos' }).click();
    await page.getByRole('searchbox', { name: 'Buscar trabajador del área' }).waitFor();
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-row:visible').count(), 0);
    await page.getByRole('button', { name: 'Mostrar todos' }).click();
    assert.equal(await workerSearch.inputValue(), '');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-row:visible').count(), 1);
    await page.getByRole('button', { name: 'Vista semanal' }).click();
    const weeklySearch = page.getByRole('searchbox', { name: 'Buscar trabajador del área' });
    await weeklySearch.fill('inexistente');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .week-row:visible').count(), 0);
    await weeklySearch.fill('ESTACION');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .week-row:visible').count(), 1);
    await page.getByRole('button', { name: 'Mostrar todos' }).click();
    assert.equal(await weeklySearch.inputValue(), '');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .week-row:visible').count(), 1);
    await page.getByRole('button', { name: 'Planificación mensual' }).click();
    // Chief bulk editor must be available without crossing area boundaries.
    assert.equal(await page.getByRole('button', { name: 'Asignar rango de turnos' }).count(), 1);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .area-form').count(), 3);
    assert.equal(await page.getByRole('button', { name: 'Aplicar patrón semanal' }).count(), 1);
    // Exercise the actual bulk handler and verify that only the logged-in
    // chief's employee ID is sent to the area-scoped adapter.
    await page.evaluate(() => { window.confirm = () => true; });
    const bulkForm = page.locator('#shiftcontrol-area-calendar .area-form').nth(1);
    await bulkForm.locator('input[type="date"]').nth(0).fill('2026-10-19');
    await bulkForm.locator('input[type="date"]').nth(1).fill('2026-10-20');
    await bulkForm.getByRole('button', { name: 'Asignar rango de turnos' }).click();
    await page.waitForFunction(() => window.__saves.some(entry => entry.changes?.length === 2));
    const bulkSave = await page.evaluate(() => window.__saves.find(entry => entry.changes?.length === 2));
    assert.equal(bulkSave.area, 'ESTACION');
    assert.deepEqual(bulkSave.changes.map(change => change.employeeId),
      ['station-worker', 'station-worker']);
    assert.deepEqual(bulkSave.changes.map(change => change.date),
      ['2026-10-19', '2026-10-20']);
    // Select-all respects the worker search and only selects actual days,
    // never the blank padding cells at the end of a short month.
    const searchForBulk = page.getByRole('searchbox', { name: 'Buscar trabajador del área' });
    await searchForBulk.fill('ESTACION');
    await page.getByRole('button', { name: 'Seleccionar turnos visibles' }).click();
    await page.getByText('31 celdas seleccionadas').waitFor();
    await page.getByRole('button', { name: 'Limpiar selección' }).click();
    await page.getByText('0 celdas seleccionadas').waitFor();
    await page.getByRole('button', { name: 'Mostrar todos' }).click();
    // October 2026 has 22 weekdays. Weekend cells must stay unselected.
    await page.getByRole('button', { name: 'Seleccionar días laborales' }).click();
    await page.getByText('22 celdas seleccionadas').waitFor();
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-cell.selected').count(), 22);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-cell.selected[data-date="2026-10-03"]').count(), 0);
    await page.getByRole('button', { name: 'Limpiar selección' }).click();
    await page.getByRole('button', { name: 'Vista semanal' }).click();
    await page.getByRole('button', { name: 'Seleccionar días laborales' }).click();
    await page.getByText('5 celdas seleccionadas').waitFor();
    assert.equal(await page.locator('#shiftcontrol-area-calendar .week-cell.selected').count(), 5);
    await page.getByRole('button', { name: 'Limpiar selección' }).click();
    await page.getByRole('button', { name: 'Planificación mensual' }).click();
    // Multi-cell edits must be sent as one authorized area-scoped write.
    const firstCells = page.locator('#shiftcontrol-area-calendar .cal-row').first().locator('.cal-cell');
    // The test fixture does not load the legacy grid CSS, so its cells can
    // have zero-size hit targets. Dispatch modifier-click events directly to
    // exercise the real handler without relying on layout geometry.
    await firstCells.nth(2).dispatchEvent('click', { ctrlKey: true });
    await firstCells.nth(3).dispatchEvent('click', { ctrlKey: true });
    await page.getByText('2 celdas seleccionadas').waitFor();
    await page.getByRole('button', { name: 'Aplicar a selección' }).click();
    await page.waitForFunction(() => window.__saves.some(entry =>
      entry.changes?.length === 2 &&
      entry.changes.some(change => change.date === '2026-10-03')));
    const selectedSave = await page.evaluate(() => window.__saves.find(entry =>
      entry.changes?.length === 2 &&
      entry.changes.some(change => change.date === '2026-10-03')));
    assert.equal(selectedSave.area, 'ESTACION');
    assert.deepEqual(selectedSave.changes.map(change => change.employeeId),
      ['station-worker', 'station-worker']);
    // Single-cell editing must use the integrated in-panel editor, not a
    // blocking browser prompt, and must write only the scoped employee.
    await page.evaluate(() => { window.prompt = () => { throw new Error('Unexpected browser prompt'); }; });
    await page.locator('#shiftcontrol-area-calendar .cal-row').first()
      .locator('.cal-cell').nth(5).dispatchEvent('click');
    const editor = page.locator('#shiftcontrol-area-calendar .area-single-editor');
    await editor.getByRole('combobox', { name: 'Código de turno' }).selectOption('D');
    await editor.getByRole('button', { name: 'Guardar turno' }).click();
    await page.waitForFunction(() => window.__saves.some(entry => entry.plan?.code === 'D'));
    const singleSave = await page.evaluate(() => window.__saves.find(entry => entry.plan?.code === 'D'));
    assert.equal(singleSave.area, 'ESTACION');
    assert.equal(singleSave.plan.employeeId, 'station-worker');
    assert.equal(singleSave.plan.date, '2026-10-06');
    assert.equal(await editor.count(), 0);
    // Keyboard Escape cancels an edit, Enter saves it without browser prompts.
    await page.locator('#shiftcontrol-area-calendar .cal-row').first()
      .locator('.cal-cell').nth(7).dispatchEvent('click');
    const savesBeforeEscape = await page.evaluate(() => window.__saves.length);
    await editor.getByRole('combobox', { name: 'Código de turno' }).press('Escape');
    assert.equal(await editor.count(), 0);
    assert.equal(await page.evaluate(() => window.__saves.length), savesBeforeEscape);
    await page.locator('#shiftcontrol-area-calendar .cal-row').first()
      .locator('.cal-cell').nth(7).dispatchEvent('click');
    await editor.getByRole('combobox', { name: 'Código de turno' }).selectOption('A');
    await editor.getByRole('combobox', { name: 'Código de turno' }).press('Enter');
    await page.waitForFunction(() => window.__saves.some(entry => entry.plan?.code === 'A' && entry.plan?.date === '2026-10-08'));
    assert.equal(await editor.count(), 0);
    // A pending edit must not save after the session changes to another area.
    await page.locator('#shiftcontrol-area-calendar .cal-row').first()
      .locator('.cal-cell').nth(6).dispatchEvent('click');
    await page.locator('#shiftcontrol-area-calendar .area-single-editor').waitFor();
    const savesBeforeSwitch = await page.evaluate(() => window.__saves.length);
    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'store-chief', role: 'CHIEF', area: 'TIENDA' };
    });
    await page.locator('#shiftcontrol-area-calendar .area-single-editor')
      .getByRole('button', { name: 'Guardar turno' }).click();
    assert.equal(await page.evaluate(() => window.__saves.length), savesBeforeSwitch,
      'An editor opened by the station chief cannot save after changing to store chief');
    await page.evaluate(() => {
      window.__ctx = { companyId: 'test-company', userId: 'station-chief', role: 'CHIEF', area: 'ESTACION' };
    });
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
    // Admin can filter the two area grids independently without edit access.
    const stationSearch = page.getByRole('searchbox', { name: 'Buscar trabajador en Isla' });
    const storeSearch = page.getByRole('searchbox', { name: 'Buscar trabajador en Tienda' });
    await stationSearch.fill('inexistente');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').first().locator('.cal-row:visible').count(), 0);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').nth(1).locator('.cal-row:visible').count(), 1);
    await stationSearch.fill('ESTACION');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').first().locator('.cal-row:visible').count(), 1);
    await storeSearch.fill('inexistente');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').nth(1).locator('.cal-row:visible').count(), 0);
    await storeSearch.fill('');
    await stationSearch.fill('inexistente');
    await page.getByRole('button', { name: 'Actualizar calendarios' }).click();
    await page.getByRole('searchbox', { name: 'Buscar trabajador en Isla' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Buscar trabajador en Isla' }).inputValue(), 'inexistente');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').first().locator('.cal-row:visible').count(), 0);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').nth(1).locator('.cal-row:visible').count(), 1);
    await page.getByRole('searchbox', { name: 'Buscar trabajador en Isla' }).fill('');
    // A slow network refresh must not blank the existing planning grids.
    await page.evaluate(() => {
      const original = window.ShiftControlStorage.readAreaState;
      window.__finishSlowReads = [];
      window.ShiftControlStorage.readAreaState = area => new Promise(resolve => {
        window.__finishSlowReads.push(() => resolve(original(area)));
      });
    });
    await page.getByRole('button', { name: 'Actualizar calendarios' }).click();
    await page.waitForFunction(() => window.__finishSlowReads.length === 2);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').count(), 2,
      'Previously loaded area calendars should remain visible during network latency');
    await page.evaluate(() => {
      const finish = window.__finishSlowReads.splice(0);
      finish.forEach(resolve => resolve());
    });
    await page.getByText(/Calendarios de .*solo lectura/).waitFor();
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').count(), 2);
    // Both admin calendars follow the same month navigation, including year rollover.
    await page.locator('#shiftcontrol-area-calendar input[type="month"]').fill('2026-01');
    await page.getByRole('button', { name: 'Mes anterior' }).click();
    assert.equal(await page.locator('#shiftcontrol-area-calendar input[type="month"]').inputValue(), '2025-12');
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    assert.equal(await page.locator('#shiftcontrol-area-calendar input[type="month"]').inputValue(), '2026-01');
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    assert.equal(await page.locator('#shiftcontrol-area-calendar input[type="month"]').inputValue(), '2026-02');
    assert.equal(await page.locator('#shiftcontrol-area-calendar .calendar-grid').count(), 2);
    assert.equal(await page.locator('#shiftcontrol-area-calendar .cal-cell[role="button"]').count(), 0,
      'Admin oversight must remain read-only');
    await page.evaluate(() => window.ShiftControlAreaCalendarView.mount());
    assert.equal(await page.locator('#shiftcontrol-area-calendar').count(), 1,
      'Repeated admin mounts must not duplicate the panel');
    // Returning to Planning explicitly reloads both areas even when a
    // passive refresh happened less than 15 seconds ago.
    await page.evaluate(() => {
      document.getElementById('planning').classList.add('active');
      window.__adminReads.length = 0;
      document.querySelector('.sidebar [data-view="planning"]').click();
    });
    await page.waitForFunction(() => window.__adminReads.length === 2);
    assert.deepEqual(await page.evaluate(() => window.__adminReads), ['ESTACION', 'TIENDA']);
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
