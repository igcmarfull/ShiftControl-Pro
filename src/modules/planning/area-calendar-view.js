// Isolated CHIEF calendar UI. It never reads the legacy global state.
(function () {
  'use strict';
  const ID = 'shiftcontrol-area-calendar';
  const areas = { ESTACION: 'Isla', TIENDA: 'Tienda' };
  let generation = 0;
  let selectedMonth = new Date().toISOString().slice(0, 7);
  let selectedWeek = 0;
  let displayMode = 'monthly';
  let refreshActive = null;
  let cleanupAdminListeners = null;
  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function mount() {
    const context = window.AuthContext?.get?.();
    const root = document.getElementById(ID);
    const authorized = context?.role === 'CHIEF' &&
      Boolean(context.companyId && context.userId) &&
      Object.hasOwn(areas, context.area);
    // Fail closed for a CHIEF whose area has not yet been assigned.
    const pendingArea = context?.role === 'CHIEF' && !authorized;
    if (!document.getElementById('shiftcontrol-area-chief-style')) {
      const style = el('style');
      style.id = 'shiftcontrol-area-chief-style';
      style.textContent = `
        /* Preserve the original navigation shell while preventing access
           to legacy company-wide views through the area chief UI. */
        body.shiftcontrol-area-chief-mode .view {display:none!important}
        /* Chief calendar uses the existing application navigation shell. */
        body.shiftcontrol-area-chief-mode .sidebar,
        body.shiftcontrol-area-chief-mode .mobile-nav {visibility:visible!important}
        /* Chief-only links to hidden company-wide screens must not lead
           users into blank pages. Keep the navigation shell, but make
           the isolated planner the active accessible destination. */
        body.shiftcontrol-area-chief-mode .sidebar [data-view]:not([data-view="planning"]),
        body.shiftcontrol-area-chief-mode .mobile-nav [data-view]:not([data-view="planning"]) {
          display:none!important
        }
        body.shiftcontrol-area-chief-mode .sidebar [data-view="planning"],
        body.shiftcontrol-area-chief-mode .mobile-nav [data-view="planning"] {cursor:pointer}
        #shiftcontrol-area-calendar[data-mode="admin"] {
          max-width:calc(100% - 36px);margin:18px auto!important;
          padding:24px;background:#111827;color:#f8fafc;
          border:1px solid #334155;border-radius:16px;
        }
        #shiftcontrol-area-calendar[data-mode="admin"] > section {
          margin:24px 0;padding:18px;border:1px solid #334155;
          border-radius:12px;background:#0f172a;
        }
        #shiftcontrol-area-calendar[data-mode="admin"] > div > section {
          margin:24px 0;padding:18px;border:1px solid #334155;
          border-radius:12px;background:#0f172a;
        }
        body.shiftcontrol-area-chief-mode {min-height:100vh!important;overflow:auto!important}
        body.shiftcontrol-area-chief-mode #shiftcontrol-area-calendar {
          box-sizing:border-box;position:relative!important;inset:auto!important;
          display:block!important;visibility:visible!important;
          width:min(1180px,calc(100% - 40px));min-height:70vh;
          margin:32px auto!important;padding:32px!important;
          border:1px solid rgba(148,163,184,.2);border-radius:20px;
          background:#111827;color:#f8fafc;
          box-shadow:0 20px 65px rgba(0,0,0,.24);
          font-family:inherit;z-index:2;
        }
        #shiftcontrol-area-calendar h2 {font-size:clamp(24px,3vw,34px);font-weight:750;margin:0 0 20px}
        #shiftcontrol-area-calendar .area-toolbar {display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px}
        #shiftcontrol-area-calendar button,#shiftcontrol-area-calendar select,
        #shiftcontrol-area-calendar input {font:inherit;min-height:42px;border-radius:9px;padding:9px 12px}
        #shiftcontrol-area-calendar button {background:#2563eb;border:1px solid #3b82f6;color:white;cursor:pointer;font-weight:600}
        #shiftcontrol-area-calendar button:hover {background:#1d4ed8}
        #shiftcontrol-area-calendar button:disabled {opacity:.5;cursor:wait}
        #shiftcontrol-area-calendar .area-status {color:#cbd5e1;margin:0 0 20px}
        #shiftcontrol-area-calendar .area-table-wrap {overflow-x:auto;border:1px solid #334155;border-radius:12px}
        #shiftcontrol-area-calendar table {width:100%;border-collapse:collapse;min-width:550px}
        #shiftcontrol-area-calendar th {background:#1e293b;color:#cbd5e1;text-align:left;font-size:13px}
        #shiftcontrol-area-calendar td,#shiftcontrol-area-calendar th {padding:14px 16px;border-bottom:1px solid #334155}
        #shiftcontrol-area-calendar tr:last-child td {border-bottom:0}
        #shiftcontrol-area-calendar .area-form {display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-top:24px}
        #shiftcontrol-area-calendar .area-form label {display:flex;flex-direction:column;gap:6px;color:#cbd5e1;font-size:13px;flex:1 1 150px}
        #shiftcontrol-area-calendar input,#shiftcontrol-area-calendar select {width:100%;box-sizing:border-box;background:#1e293b;color:#f8fafc;border:1px solid #475569}
        #shiftcontrol-area-calendar .area-empty {padding:26px 18px;color:#94a3b8;text-align:center}
        #shiftcontrol-area-calendar .area-worker-filter {display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}
        #shiftcontrol-area-calendar .area-employee-search {width:min(320px,100%)}
        #shiftcontrol-area-calendar .area-worker-count {color:#cbd5e1;font-size:13px}
        #shiftcontrol-area-calendar .area-editor-operational {color:#fbbf24;font-size:13px;flex-basis:100%}
        #shiftcontrol-area-calendar .area-single-editor:focus-within {border-color:#60a5fa}
        #shiftcontrol-area-calendar button:focus-visible,
        #shiftcontrol-area-calendar select:focus-visible,
        #shiftcontrol-area-calendar .cal-cell:focus-visible,
        #shiftcontrol-area-calendar .week-cell:focus-visible {outline:3px solid #93c5fd;outline-offset:2px}
        #shiftcontrol-area-calendar .area-single-editor {display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px;margin:12px 0;border:1px solid #64748b;border-radius:8px;background:#1e293b}
        #shiftcontrol-area-calendar .area-single-editor select {width:auto;min-width:130px}
        #shiftcontrol-area-calendar .area-calendar-selection {display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0 18px}
        #shiftcontrol-area-calendar .area-calendar-selection select {width:auto;min-width:100px}
        #shiftcontrol-area-calendar .area-calendar-selection .area-selection-count {font-weight:600;margin-right:auto}
        #shiftcontrol-area-calendar .cal-cell.selected, #shiftcontrol-area-calendar .week-cell.selected {outline:2px solid #60a5fa;outline-offset:-2px;background:rgba(59,130,246,.22)}
        #shiftcontrol-area-calendar .cal-cell[role="button"] {cursor:pointer}
        #shiftcontrol-area-calendar .area-staffing-summary {margin-top:26px}
        #shiftcontrol-area-calendar .area-staffing-summary h3 {margin:0 0 12px;font-size:18px}
        #shiftcontrol-area-calendar .area-staffing-summary .area-table-wrap {max-height:340px;overflow:auto}
        #shiftcontrol-area-calendar .area-staffing-summary th {position:sticky;top:0;z-index:1}
        #shiftcontrol-area-calendar .area-staffing-summary td {font-size:13px;padding:8px 12px}
        @media(max-width:640px){body.shiftcontrol-area-chief-mode #shiftcontrol-area-calendar {width:calc(100% - 20px);margin:10px auto!important;padding:18px!important}}
      `;
      document.head.append(style);
    }
    if (context?.role === 'ADMIN' && context.companyId && context.userId) {
      if (root?.dataset.owner === context.userId &&
          root?.dataset.company === context.companyId &&
          root?.dataset.mode === 'admin') {
        if (typeof refreshActive === 'function') void refreshActive();
        return;
      }
      generation++;
      cleanupAdminListeners?.();
      cleanupAdminListeners = null;
      refreshActive = null;
      if (root) root.remove();
      document.body.classList.remove('shiftcontrol-area-chief-mode');
      const panel = el('section');
      panel.id = ID;
      panel.dataset.owner = context.userId;
      panel.dataset.company = context.companyId;
      panel.dataset.mode = 'admin';
      panel.className = 'panel';
      panel.style.margin = '18px';
      panel.append(el('h2', 'Calendarios por área · Supervisión'));
      const status = el('p', 'Consultando turnos de Isla y Tienda…');
      status.setAttribute('role', 'status');
      panel.append(status);
      const reload = el('button', 'Actualizar calendarios');
      reload.type = 'button';
      panel.append(reload);
      const monthPicker = el('input');
      monthPicker.type = 'month';
      monthPicker.value = selectedMonth;
      monthPicker.setAttribute('aria-label', 'Mes de supervisión');
      panel.append(monthPicker);
      const previousMonth = el('button', 'Mes anterior');
      const nextMonth = el('button', 'Mes siguiente');
      previousMonth.type = nextMonth.type = 'button';
      const navigateMonth = delta => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const target = new Date(year, month - 1 + delta, 1);
        selectedMonth = target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0');
        monthPicker.value = selectedMonth;
        void refreshAdmin();
      };
      previousMonth.addEventListener('click', () => navigateMonth(-1));
      nextMonth.addEventListener('click', () => navigateMonth(1));
      panel.append(previousMonth, nextMonth);
      const content = el('div');
      panel.append(content);
      // Preserve admin worker searches independently when switching months
      // or refreshing snapshots from the two chiefs.
      const adminWorkerQueries = { ESTACION: '', TIENDA: '' };
      // Keep oversight inside the original planning screen when present,
      // rather than attaching a second unrelated page below the entire SPA.
      const planningView = document.getElementById('planning');
      if (planningView) planningView.append(panel);
      else document.body.append(panel);
      const ownerGeneration = generation;
      let adminRequest = 0;
      // The administrator's original workflow expects chief edits to become
      // visible on return to Planning, without reloading the entire app.
      let lastAdminRefresh = 0;
      const refreshWhenReturning = () => {
        const current = window.AuthContext?.get?.();
        if (ownerGeneration !== generation || current?.role !== 'ADMIN' ||
            current.userId !== context.userId || current.companyId !== context.companyId ||
            !panel.isConnected || document.hidden ||
            (planningView && !planningView.classList.contains('active'))) return;
        if (Date.now() - lastAdminRefresh < 15000) return;
        void refreshAdmin();
      };
      // SPA navigation does not necessarily focus the browser window.
      // When the administrator opens Planning, reload both chief-owned
      // snapshots after the original navigation handler activates the view.
      const refreshOnPlanningNavigation = event => {
        if (!event.target?.closest?.('[data-view="planning"]')) return;
        // The legacy navigation may activate the planning screen after
        // bubbling completes. Defer the visibility check to the next task.
        setTimeout(() => {
          const current = window.AuthContext?.get?.();
          if (ownerGeneration !== generation || current?.role !== 'ADMIN' ||
              current.userId !== context.userId || current.companyId !== context.companyId ||
              !panel.isConnected || document.hidden ||
              (planningView && !planningView.classList.contains('active'))) return;
          // Explicit navigation is a user request for current data: do not
          // suppress it with the passive focus/visibility refresh throttle.
          void refreshAdmin();
        }, 0);
      };
      window.addEventListener('focus', refreshWhenReturning);
      document.addEventListener('visibilitychange', refreshWhenReturning);
      document.addEventListener('click', refreshOnPlanningNavigation);
      cleanupAdminListeners = () => {
        window.removeEventListener('focus', refreshWhenReturning);
        document.removeEventListener('visibilitychange', refreshWhenReturning);
        document.removeEventListener('click', refreshOnPlanningNavigation);
      };
      async function refreshAdmin() {
        const request = ++adminRequest;
        lastAdminRefresh = Date.now();
        const requestedMonth = selectedMonth;
        reload.disabled = true;
        status.textContent = 'Consultando calendarios…';
        // Keep the last successfully loaded calendars visible while both
        // area snapshots are in flight. Replace only after session validation.
        try {
          const storage = window.ShiftControlStorage;
          if (typeof storage?.readAreaState !== 'function') {
            throw new Error('No está disponible la lectura de calendarios por área.');
          }
          const results = await Promise.allSettled(
            Object.keys(areas).map(area => storage.readAreaState(area, 'main')));
          const current = window.AuthContext?.get?.();
          if (ownerGeneration !== generation || request !== adminRequest || current?.role !== 'ADMIN' ||
              current.userId !== context.userId || current.companyId !== context.companyId) return;
          content.replaceChildren();
          for (const [index, area] of Object.keys(areas).entries()) {
            const section = el('section');
            section.append(el('h3', areas[area]));
            const result = results[index];
            if (result.status === 'rejected') {
              section.append(el('p', 'No se pudo consultar: ' + (result.reason?.message || 'error de acceso')));
            } else if (!result.value) {
              section.append(el('p', 'Esta área aún no tiene un calendario migrado.'));
            } else {
              const data = result.value.data;
              if (!data || !Array.isArray(data.employees) || !Array.isArray(data.plans)) {
                section.append(el('p', 'El calendario contiene datos inválidos.'));
              } else {
                const monthCount = data.plans.filter(plan =>
                  typeof plan.date === 'string' && plan.date.startsWith(requestedMonth + '-')).length;
                section.append(el('p', 'Revisión ' + result.value.revision +
                  ' · ' + data.employees.length + ' trabajadores · ' +
                  monthCount + ' turnos en ' + requestedMonth));
                // Use the same monthly planning grid structure as the chief
                // calendar, but without edit handlers for ADMIN oversight.
                const monthPlans = data.plans.filter(plan =>
                  typeof plan.date === 'string' && plan.date.startsWith(requestedMonth + '-'));
                const byEmployeeDay = new Map(monthPlans.map(plan =>
                  [plan.employeeId + ':' + plan.date, plan]));
                const [year, month] = requestedMonth.split('-').map(Number);
                const days = new Date(year, month, 0).getDate();
                const wrap = el('div');
                wrap.className = 'table-wrap';
                wrap.style.overflowX = 'auto';
                const grid = el('div');
                grid.className = 'calendar-grid';
                grid.style.minWidth = '1050px';
                const head = el('div');
                head.className = 'cal-head';
                const workerHead = el('div', 'Trabajador');
                workerHead.className = 'sticky-name';
                head.append(workerHead);
                for (let day = 1; day <= 31; day++) {
                  head.append(el('div', day <= days ? String(day) : ''));
                }
                const summaryHead = el('div', 'Resumen');
                summaryHead.className = 'sticky-summary';
                head.append(summaryHead);
                grid.append(head);
                for (const employee of data.employees) {
                  const row = el('div');
                  row.className = 'cal-row';
                  const name = el('div');
                  name.className = 'cal-name';
                  const person = el('div');
                  person.className = 'person';
                  const label = el('strong', employee.name || employee.id);
                  person.append(label);
                  name.append(person);
                  row.append(name);
                  const counts = {};
                  for (let day = 1; day <= 31; day++) {
                    const cell = el('div');
                    cell.className = 'cal-cell';
                    if (day <= days) {
                      const date = requestedMonth + '-' + String(day).padStart(2, '0');
                      const plan = byEmployeeDay.get(employee.id + ':' + date);
                      if (plan?.code) {
                        const dot = el('div', plan.code);
                        dot.className = 'cal-dot plan-' + plan.code;
                        cell.append(dot);
                        counts[plan.code] = (counts[plan.code] || 0) + 1;
                      }
                      cell.title = (employee.name || employee.id) + ' · ' + date +
                        ' · ' + (plan?.code || 'Sin turno');
                    }
                    row.append(cell);
                  }
                  const total = el('div', Object.entries(counts)
                    .map(([code, count]) => code + ' ' + count).join(' · ') || 'Sin turnos');
                  total.className = 'cal-summary';
                  row.append(total);
                  grid.append(row);
                }
                // Chief and admin share the same worker-oriented calendar.
                // Allow admin to locate a worker without modifying area data.
                const search = el('input');
                search.type = 'search';
                search.placeholder = 'Buscar trabajador en ' + areas[area] + '…';
                search.setAttribute('aria-label', 'Buscar trabajador en ' + areas[area]);
                search.value = adminWorkerQueries[area];
                const count = el('span', data.employees.length + ' trabajadores');
                const filter = el('div');
                filter.className = 'area-worker-filter';
                filter.append(search, count);
                search.addEventListener('input', () => {
                  adminWorkerQueries[area] = search.value;
                  const query = search.value.trim().toLocaleLowerCase('es-CL');
                  let visible = 0;
                  for (const row of grid.querySelectorAll('.cal-row')) {
                    const name = row.querySelector('.cal-name');
                    const match = !query || (name?.textContent || '').toLocaleLowerCase('es-CL').includes(query);
                    row.hidden = !match;
                    row.style.display = match ? '' : 'none';
                    if (match) visible++;
                  }
                  count.textContent = visible + ' de ' + data.employees.length + ' trabajadores';
                });
                search.dispatchEvent(new Event('input'));
                section.append(filter);
                wrap.append(grid);
                section.append(data.employees.length ? wrap :
                  el('p', 'Sin trabajadores registrados en esta área.'));
                if (!monthPlans.length) section.append(el('p', 'Sin turnos registrados este mes.'));
              }
            }
            content.append(section);
          }
          status.textContent = 'Calendarios de ' + requestedMonth + ' · solo lectura';
        } catch (error) {
          if (ownerGeneration === generation && request === adminRequest) status.textContent =
            'No se pudieron consultar los calendarios: ' + (error?.message || 'error');
        } finally {
          if (ownerGeneration === generation && request === adminRequest) reload.disabled = false;
        }
      }
      reload.addEventListener('click', refreshAdmin);
      monthPicker.addEventListener('change', () => {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(monthPicker.value)) {
          selectedMonth = monthPicker.value;
          void refreshAdmin();
        }
      });
      refreshActive = refreshAdmin;
      void refreshAdmin();
      return;
    }
    if (!authorized) {
      generation++;
      cleanupAdminListeners?.();
      cleanupAdminListeners = null;
      refreshActive = null;
      if (root) root.remove();
      document.body.classList.toggle('shiftcontrol-area-chief-mode', pendingArea);
      if (pendingArea) {
        const notice = el('section', 'Tu jefatura todavía no tiene un área asignada. Contacta al administrador.');
        notice.id = ID;
        document.body.append(notice);
      }
      return;
    }
    if (root && root.dataset.owner === context.userId &&
        root.dataset.company === context.companyId &&
        root.dataset.area === context.area) {
      if (typeof refreshActive === 'function') void refreshActive();
      return;
    }
    generation++;
    cleanupAdminListeners?.();
    cleanupAdminListeners = null;
    refreshActive = null;
    if (root) root.remove();
    // Do not present this isolated fallback as the original admin planner.
    // The legacy planner still uses company-wide state, while CHIEF data is
    // stored in RLS-protected area_state. Reusing its handlers without an
    // area-scoped adapter could expose or overwrite unrelated records.
    const container = el('section');
    container.id = ID;
    container.dataset.owner = context.userId;
    container.dataset.company = context.companyId;
    container.dataset.area = context.area;
    container.className = 'panel';
    container.style.margin = '18px';
    container.append(el('h2', 'Calendario · ' + areas[context.area]));
    const status = el('p', 'Cargando turnos del área…');
    status.className = 'area-status';
    status.setAttribute('role', 'status');
    const content = el('div');
    let preservedWorkerQuery = '';
    const controls = el('div');
    controls.className = 'area-toolbar';
    let saving = false;
    let loading = false;
    let stale = true;
    const reload = el('button', 'Actualizar turnos');
    reload.type = 'button';
    reload.addEventListener('click', () => {
      if (!saving && !loading) refresh();
    });
    const signout = el('button', 'Cerrar sesión');
    signout.type = 'button';
    signout.addEventListener('click', async () => {
      try {
        await window.ShiftControlAuth.signOut();
      } catch (error) {
        status.textContent = error?.message || 'No fue posible cerrar sesión.';
      }
    });
    controls.append(reload, signout);
    container.append(controls, status, content);
    // Never leave the legacy company-wide grids visible to a scoped CHIEF.
    // This only masks presentation; Supabase RLS remains mandatory.
    document.body.classList.add('shiftcontrol-area-chief-mode');

    document.body.append(container);
    // Keep the original navigation usable for chiefs without routing them
    // into hidden, company-wide legacy screens.
    for (const nav of (document.querySelectorAll?.(
      '.sidebar [data-view="planning"], .mobile-nav [data-view="planning"]') || [])) {
      if (nav.dataset.areaCalendarBound === 'true') continue;
      nav.dataset.areaCalendarBound = 'true';
      nav.addEventListener('click', event => {
        if (window.AuthContext?.get?.()?.role !== 'CHIEF') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        document.getElementById(ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, true);
    }
    refreshActive = refresh;
    refresh();
    async function refresh() {
      if (saving || loading) return;
      loading = true;
      stale = true;
      reload.disabled = true;
      const token = ++generation;
      // Keep the old calendar visible for reference, but never allow writes
      // against stale data while the refresh is pending or has failed.
      (content.querySelectorAll?.('button, input, select, [role="button"]') || []).forEach(node => {
        if ('disabled' in node) node.disabled = true;
        if (node.getAttribute('role') === 'button') {
          node.setAttribute('aria-disabled', 'true');
          node.style.pointerEvents = 'none';
        }
      });
      status.textContent = 'Actualizando planificación…';
      let view;
      try {
        view = await window.ShiftControlAreaCalendar.load();
      } catch (error) {
        if (token === generation) status.textContent =
          error?.message || 'No se pudo consultar el calendario.';
        return false;
      } finally {
        // A stale request must not unlock the controls of a newer session.
        if (token === generation) {
          loading = false;
          if (!saving) reload.disabled = false;
        }
      }
      const now = window.AuthContext?.get?.();
      if (token !== generation || now?.userId !== context.userId ||
          now?.companyId !== context.companyId || now?.area !== context.area ||
          now?.role !== 'CHIEF') return;
      if (!view) {
        status.textContent = 'El administrador aún no ha migrado los turnos de esta área.';
        return false;
      }
      content.replaceChildren();
      stale = false;
      status.textContent = 'Turnos del área · revisión ' + view.revision;
      const toolbar = el('div');
      toolbar.className = 'area-toolbar';
      const exportCsv = el('button', 'Exportar planificación CSV');
      exportCsv.type = 'button';
      exportCsv.addEventListener('click', () => {
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        const monthPlans = new Map(view.plans.filter(p =>
          typeof p.date === 'string' && p.date.startsWith(selectedMonth + '-'))
          .map(p => [p.employeeId + ':' + p.date, p.code]));
        const [year, month] = selectedMonth.split('-').map(Number);
        const days = new Date(year, month, 0).getDate();
        // Prevent spreadsheet formula execution when a worker name starts
        // with a formula prefix; quoting CSV fields alone is insufficient.
        const quote = value => {
          const raw = String(value ?? '');
          const safe = /^[\\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
          return '"' + safe.replace(/"/g, '""') + '"';
        };
        const headers = ['Trabajador', ...Array.from({ length: days },
          (_, i) => selectedMonth + '-' + String(i + 1).padStart(2, '0'))];
        const rows = [headers, ...view.employees.map(employee =>
          [employee.name || employee.id, ...headers.slice(1).map(date =>
            monthPlans.get(employee.id + ':' + date) || '')])];
        const csv = '\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = el('a');
        link.href = url;
        link.download = 'turnos-' + context.area.toLowerCase() + '-' + selectedMonth + '.csv';
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
      toolbar.append(exportCsv);
      const previous = el('button', '←');
      const next = el('button', '→');
      const monthly = el('button', 'Planificación mensual');
      const weekly = el('button', 'Vista semanal');
      const monthPicker = el('input');
      const monthLabel = el('span', selectedMonth);
      monthLabel.className = 'area-month-label';
      monthPicker.type = 'month';
      monthPicker.value = selectedMonth;
      monthPicker.setAttribute('aria-label', 'Mes de planificación');
      monthPicker.addEventListener('change', () => {
        if (/^\d{4}-\d{2}$/.test(monthPicker.value)) {
          selectedMonth = monthPicker.value;
          monthLabel.textContent = selectedMonth;
          selectedWeek = 0;
          refresh();
        }
      });
      for (const [button, offset] of [[previous, -1], [next, 1]]) {
        button.type = 'button';
        button.addEventListener('click', () => {
          const [year, month] = selectedMonth.split('-').map(Number);
          const target = new Date(year, month - 1 + offset, 1);
          selectedMonth = target.getFullYear() + '-' +
            String(target.getMonth() + 1).padStart(2, '0');
          selectedWeek = 0;
          refresh();
        });
      }
      monthly.addEventListener('click', () => { displayMode = 'monthly'; refresh(); });
      weekly.addEventListener('click', () => { displayMode = 'weekly'; refresh(); });
      if (displayMode === 'weekly') {
        const prevWeek = el('button', '← Semana');
        const nextWeek = el('button', 'Semana →');
        prevWeek.type = nextWeek.type = 'button';
        prevWeek.addEventListener('click', () => { selectedWeek--; refresh(); });
        nextWeek.addEventListener('click', () => { selectedWeek++; refresh(); });
        toolbar.append(prevWeek, nextWeek);
      }
      toolbar.append(monthly, weekly, previous, monthPicker, next, monthLabel);
      const duplicate = el('button', 'Copiar mes anterior (solo vacíos)');
      duplicate.type = 'button';
      duplicate.addEventListener('click', () => {
        if (saving || loading) return;
        const [year, month] = selectedMonth.split('-').map(Number);
        const prior = new Date(year, month - 2, 1);
        const sourceMonth = prior.getFullYear() + '-' + String(prior.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const assigned = new Set(view.plans.map(plan => plan.employeeId + ':' + plan.date));
        const sourceCounts = new Map();
        for (const plan of view.plans) {
          if (typeof plan.date === 'string' && plan.date.startsWith(sourceMonth + '-')) {
            const key = plan.employeeId + ':' + plan.date;
            sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
          }
        }
        const sourceDuplicates = [...sourceCounts.values()].filter(count => count > 1).length;
        if (sourceDuplicates) {
          status.textContent = 'No se puede copiar: el mes anterior tiene ' +
            sourceDuplicates + ' fechas con turnos duplicados. Corrige los datos primero.';
          return;
        }
        const changes = view.plans.filter(plan => typeof plan.date === 'string' &&
          plan.date.startsWith(sourceMonth + '-') &&
          /^\d{4}-\d{2}-\d{2}$/.test(plan.date) &&
          Number(plan.date.slice(-2)) <= lastDay &&
          !assigned.has(plan.employeeId + ':' + selectedMonth + plan.date.slice(-3)))
          .map(plan => ({ employeeId: plan.employeeId,
            date: selectedMonth + plan.date.slice(-3), code: plan.code }));
        if (!changes.length) {
          status.textContent = 'No hay turnos nuevos que copiar al mes seleccionado.';
          return;
        }
        if (!window.confirm('Copiar ' + changes.length + ' turnos de ' + sourceMonth +
          ' a ' + selectedMonth + '? Solo se completarán días sin turno.')) return;
        mutate(() => window.ShiftControlAreaCalendar.applyPlanChanges(changes));
      });
      toolbar.append(duplicate);
      content.append(toolbar);
      const [year, month] = selectedMonth.split('-').map(Number);
      const days = new Date(year, month, 0).getDate();
      // Never let duplicate records silently determine which shift a cell
      // displays. A conflicted schedule needs correction by an administrator.
      const plans = new Map();
      const duplicateCells = new Set();
      for (const plan of view.plans) {
        const cellKey = plan.employeeId + ':' + plan.date;
        if (plans.has(cellKey)) duplicateCells.add(cellKey);
        else plans.set(cellKey, plan);
      }
      if (duplicateCells.size) {
        status.textContent = 'Atención: hay ' + duplicateCells.size +
          ' fechas con turnos duplicados. No edites esas celdas hasta corregir los datos.';
      }
      // Mirror the original planner's operational overlays using ONLY the
      // area-authorized snapshot (never the legacy global state).
      const executionsByDay = new Map((view.executions || []).map(item =>
        [item.employeeId + ':' + item.date, item]));
      const additionalByDay = new Map((view.additional || []).map(item =>
        [item.employeeId + ':' + item.date, item]));
      const absences = view.absences || [];
      function operationalDetails(employeeId, date) {
        const absence = absences.find(item => item.employeeId === employeeId &&
          typeof item.from === 'string' && typeof item.to === 'string' &&
          item.from <= date && date <= item.to);
        const execution = executionsByDay.get(employeeId + ':' + date);
        const additional = additionalByDay.get(employeeId + ':' + date);
        return { absence, execution, additional };
      }
      function decorateCell(cell, employeeId, date) {
        const { absence, execution, additional } = operationalDetails(employeeId, date);
        if (absence) {
          const code = ({ Permiso: 'P', Licencia: 'L', Vacaciones: 'V' })[absence.type] || 'X';
          const overlay = el('span', code);
          overlay.className = 'cal-dot abs-' + code;
          overlay.title = absence.type || 'Ausencia';
          cell.append(overlay);
        }
        if (additional) {
          const extra = el('span', '+' + (additional.shift || ''));
          extra.className = 'extra-mark';
          extra.title = 'Jornada adicional';
          cell.append(extra);
        }
        if (execution?.status) {
          const statusClass = ({ Presente: 'exec-ok', Atrasado: 'exec-late',
            Ausente: 'exec-bad', Vacaciones: 'exec-purple' })[execution.status] || 'exec-info';
          cell.classList.add(statusClass);
        }
        return [absence?.type, additional && 'Jornada adicional', execution?.status]
          .filter(Boolean).join(' · ');
      }
      const validCodes = ['A', 'B', 'C', 'D', 'L', 'V', 'P', 'X', 'Libre', 'Licencia', 'Vacaciones', 'Permiso'];
      function editShift(employee, date, plan) {
        if (stale) return;
        if (saving || loading) return;
        if (duplicateCells.has(employee.id + ':' + date)) {
          status.textContent = 'Hay turnos duplicados para este día. Solicita su corrección al administrador.';
          return;
        }
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) {
          status.textContent = 'La sesión cambió. Vuelve a abrir tu calendario.';
          return;
        }
        // Use the same in-panel workflow as the original planner, without a
        // browser prompt that blocks the application and hides context.
        const previous = content.querySelector('.area-single-editor');
        if (previous) previous.remove();
        const editor = el('div');
        editor.className = 'area-single-editor';
        editor.setAttribute('role', 'group');
        editor.setAttribute('aria-label', 'Editar turno');
        const label = el('strong', (employee.name || 'Trabajador') + ' · ' + date);
        const details = operationalDetails(employee.id, date);
        const operationalSummary = [details.absence?.type,
          details.additional && 'Jornada adicional',
          details.execution?.status].filter(Boolean).join(' · ');
        if (operationalSummary) {
          const note = el('span', 'Registro operativo: ' + operationalSummary);
          note.className = 'area-editor-operational';
          editor.append(note);
        }
        const picker = el('select');
        picker.setAttribute('aria-label', 'Código de turno');
        const empty = el('option', 'Sin turno');
        empty.value = '';
        picker.append(empty);
        for (const code of validCodes) {
          const option = el('option', code);
          option.value = code;
          picker.append(option);
        }
        picker.value = plan?.code || '';
        const save = el('button', 'Guardar turno');
        save.type = 'button';
        const cancel = el('button', 'Cancelar');
        cancel.type = 'button';
        const closeEditor = () => {
          editor.remove();
          const cell = [...content.querySelectorAll('[data-employee-id][data-date]')]
            .find(node => node.dataset.employeeId === employee.id && node.dataset.date === date);
          if (cell?.focus) cell.focus();
        };
        cancel.addEventListener('click', closeEditor);
        editor.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeEditor();
          } else if (event.key === 'Enter' && event.target === picker) {
            event.preventDefault();
            save.click();
          }
        });
        save.addEventListener('click', () => {
          if (saving || loading) return;
          const latest = window.AuthContext?.get?.();
          if (latest?.role !== 'CHIEF' || latest.userId !== context.userId ||
              latest.companyId !== context.companyId || latest.area !== context.area) {
            status.textContent = 'La sesión cambió. No se guardó el turno.';
            editor.remove();
            return;
          }
          const value = picker.value;
          if (value && !validCodes.includes(value)) {
            status.textContent = 'Código de turno no válido.';
            return;
          }
          editor.remove();
          void mutate(() => value
            ? window.ShiftControlAreaCalendar.upsertPlan({ employeeId: employee.id, date, code: value })
            : window.ShiftControlAreaCalendar.removePlan(employee.id, date));
        });
        editor.append(label, picker, save, cancel);
        content.prepend(editor);
        picker.focus();
      }
      // Original planner-style multi-cell selection, committed as one
      // authorized area transaction rather than writing the company state.
      const selectedCells = new Map();
      let selectionAnchor = null;
      const selectionBar = el('div');
      selectionBar.className = 'area-calendar-selection';
      const selectionCount = el('span', '0 celdas seleccionadas');
      selectionCount.className = 'area-selection-count';
      const selectionBreakdown = el('span');
      selectionBreakdown.className = 'area-selection-breakdown';
      selectionBreakdown.setAttribute('aria-live', 'polite');
      const selectionCode = el('select');
      selectionCode.setAttribute('aria-label', 'Turno para selección');
      for (const code of validCodes) {
        const option = el('option', code);
        option.value = code;
        selectionCode.append(option);
      }
      const applySelection = el('button', 'Aplicar a selección');
      applySelection.type = 'button';
      applySelection.disabled = true;
      const selectFilteredWeekdays = el('button', 'Seleccionar días laborales');
      selectFilteredWeekdays.type = 'button';
      const selectVisible = el('button', 'Seleccionar turnos visibles');
      selectVisible.type = 'button';
      const selectEmpty = el('button', 'Seleccionar días sin turno');
      selectEmpty.type = 'button';
      const selectAssigned = el('button', 'Seleccionar turnos asignados');
      selectAssigned.type = 'button';
      const selectMatching = el('button', 'Seleccionar turno por código');
      selectMatching.type = 'button';
      const matchingCode = el('select');
      matchingCode.setAttribute('aria-label', 'Código a buscar');
      for (const code of validCodes) {
        const option = el('option', code);
        option.value = code;
        matchingCode.append(option);
      }
      const selectDate = el('button', 'Seleccionar fecha');
      selectDate.type = 'button';
      const targetDate = el('input');
      targetDate.type = 'date';
      targetDate.setAttribute('aria-label', 'Fecha a seleccionar');
      targetDate.value = selectedMonth + '-01';
      // Date selection is limited to the displayed month (or displayed week).
      // Prevent selecting stale/off-screen dates by constraining the input.
      targetDate.min = selectedMonth + '-01';
      targetDate.max = selectedMonth + '-' + String(days).padStart(2, '0');
      const invertSelection = el('button', 'Invertir selección visible');
      invertSelection.type = 'button';
      const selectWeekends = el('button', 'Seleccionar fines de semana');
      selectWeekends.type = 'button';
      const clearSelection = el('button', 'Limpiar selección');
      clearSelection.type = 'button';
      clearSelection.disabled = true;
      const removeSelection = el('button', 'Quitar turnos seleccionados');
      removeSelection.type = 'button';
      removeSelection.disabled = true;
      function updateSelection() {
        const assignedCount = [...selectedCells.keys()].filter(key => plans.has(key)).length;
        const emptyCount = selectedCells.size - assignedCount;
        selectionCount.textContent = selectedCells.size + ' celdas seleccionadas';
        selectionBreakdown.textContent = selectedCells.size ?
          assignedCount + ' con turno · ' + emptyCount + ' sin turno' : '';
        applySelection.disabled = clearSelection.disabled = removeSelection.disabled =
          !selectedCells.size || saving || loading;
      }
      function selectCell(cell, employee, date) {
        if (stale) return;
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        const key = employee.id + ':' + date;
        if (duplicateCells.has(key)) {
          status.textContent = 'No puedes seleccionar turnos duplicados hasta corregirlos.';
          return;
        }
        if (selectedCells.has(key)) {
          selectedCells.delete(key);
          cell.classList.remove('selected');
          cell.setAttribute('aria-pressed', 'false');
        } else {
          selectedCells.set(key, { employeeId: employee.id, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        selectionAnchor = { employeeId: employee.id, date };
        updateSelection();
      }
      function selectRange(cell, employee, date) {
        if (stale) return;
        if (!selectionAnchor) return selectCell(cell, employee, date);
        const cells = [...content.querySelectorAll('[data-employee-id][data-date][role="button"]')]
          .filter(node => !node.closest('.cal-row, .week-row')?.hidden);
        const start = cells.findIndex(node => node.dataset.employeeId === selectionAnchor.employeeId &&
          node.dataset.date === selectionAnchor.date);
        const end = cells.indexOf(cell);
        if (start < 0 || end < 0) return selectCell(cell, employee, date);
        const current = window.AuthContext?.get?.();
        if (saving || loading || current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const node of cells.slice(Math.min(start, end), Math.max(start, end) + 1)) {
          const key = node.dataset.employeeId + ':' + node.dataset.date;
          if (duplicateCells.has(key)) continue;
          selectedCells.set(key, { employeeId: node.dataset.employeeId, date: node.dataset.date });
          node.classList.add('selected');
          node.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      }
      // Match the legacy chief panel: paint a range by dragging across cells.
      // The drag is selection-only; nothing is persisted until Apply is pressed.
      let dragSelecting = false;
      let suppressDragClick = false;
      function beginDrag(event, cell, employee, date) {
        if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey ||
            stale || saving || loading) return;
        dragSelecting = true;
        suppressDragClick = true;
        selectCell(cell, employee, date);
        // A drag must not accidentally open the single-cell editor on mouseup.
        event.preventDefault();
      }
      function dragOver(cell, employee, date) {
        if (!dragSelecting || stale || saving || loading) return;
        const key = employee.id + ':' + date;
        if (selectedCells.has(key)) return;
        selectRange(cell, employee, date);
      }
      function endDrag() { dragSelecting = false; }
      content.addEventListener('mouseup', endDrag);
      content.addEventListener('mouseleave', endDrag);
      function commitSelection(code) {
        if (stale) return;
        if (!selectedCells.size || saving || loading) return;
        // Never authorize a queued edit against a different login or area.
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) {
          status.textContent = 'La sesión cambió. Vuelve a abrir tu calendario.';
          return;
        }
        if (code !== null && !validCodes.includes(code)) {
          status.textContent = 'Código de turno no válido.';
          return;
        }
        // Do not rewrite unchanged assignments or try to remove empty dates.
        const changes = [...selectedCells.values()]
          .filter(cell => (plans.get(cell.employeeId + ':' + cell.date)?.code || null) !== code)
          .map(cell => ({ ...cell, code }));
        if (!changes.length) {
          status.textContent = 'No hay cambios: los turnos seleccionados ya tienen ese valor.';
          return;
        }
        const overwritten = changes.filter(cell => plans.has(cell.employeeId + ':' + cell.date)).length;
        const created = code === null ? 0 : changes.length - overwritten;
        const actionSummary = code === null ?
          overwritten + ' turnos existentes serán eliminados.' :
          overwritten + ' turnos existentes serán reemplazados; ' +
          created + ' turnos nuevos serán asignados.';
        if (!window.confirm('¿Aplicar ' + (code || 'eliminación') + ' a ' +
          changes.length + ' celdas de ' + areas[context.area] + '? ' +
          actionSummary)) return;
        void mutate(() => {
          const latest = window.AuthContext?.get?.();
          if (latest?.role !== 'CHIEF' || latest.userId !== context.userId ||
              latest.companyId !== context.companyId || latest.area !== context.area) {
            throw new Error('La sesión cambió. No se guardaron los turnos.');
          }
          return window.ShiftControlAreaCalendar.applyPlanChanges(changes);
        });
      }
      selectFilteredWeekdays.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const date = cell.dataset.date;
          const employeeId = cell.dataset.employeeId;
          if (!date || !employeeId) continue;
          const weekday = new Date(date + 'T12:00:00').getDay();
          if (weekday === 0 || weekday === 6) continue;
          const key = employeeId + ':' + date;
          if (duplicateCells.has(key) || selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      selectWeekends.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const date = cell.dataset.date;
          const employeeId = cell.dataset.employeeId;
          if (!date || !employeeId) continue;
          const weekday = new Date(date + 'T12:00:00').getDay();
          if (weekday !== 0 && weekday !== 6) continue;
          const key = employeeId + ':' + date;
          if (duplicateCells.has(key) || selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      selectVisible.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const key = cell.dataset.employeeId + ':' + cell.dataset.date;
          if (!cell.dataset.employeeId || !cell.dataset.date || duplicateCells.has(key) ||
              selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId: cell.dataset.employeeId, date: cell.dataset.date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      // Fill gaps without overwriting shifts already assigned by the chief.
      // The operation respects the visible month/week, worker filter and area.
      selectEmpty.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const employeeId = cell.dataset.employeeId;
          const date = cell.dataset.date;
          if (!employeeId || !date) continue;
          const key = employeeId + ':' + date;
          if (plans.has(key) || duplicateCells.has(key) || selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      // Quickly select only existing assignments for controlled replacement or removal.
      selectAssigned.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const employeeId = cell.dataset.employeeId;
          const date = cell.dataset.date;
          if (!employeeId || !date) continue;
          const key = employeeId + ':' + date;
          if (!plans.has(key) || duplicateCells.has(key) || selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      // Target a specific existing shift code for bulk corrections without
      // touching other assignments, blank dates, or filtered-out workers.
      selectMatching.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        const code = matchingCode.value;
        if (!validCodes.includes(code)) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const employeeId = cell.dataset.employeeId;
          const date = cell.dataset.date;
          if (!employeeId || !date) continue;
          const key = employeeId + ':' + date;
          if (duplicateCells.has(key) || selectedCells.has(key) || plans.get(key)?.code !== code) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      // Assign a single calendar date to all visible employees in the chief's area.
      selectDate.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        const date = targetDate.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < targetDate.min ||
            date > targetDate.max || targetDate.validity.rangeUnderflow ||
            targetDate.validity.rangeOverflow) {
          status.textContent = 'Selecciona una fecha válida del mes mostrado.';
          return;
        }
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none' || cell.dataset.date !== date) continue;
          const employeeId = cell.dataset.employeeId;
          const key = employeeId + ':' + date;
          if (!employeeId || duplicateCells.has(key) || selectedCells.has(key)) continue;
          selectedCells.set(key, { employeeId, date });
          cell.classList.add('selected');
          cell.setAttribute('aria-pressed', 'true');
        }
        updateSelection();
      });
      // Toggle all visible editable cells atomically. Hidden employees and
      // duplicate records remain untouched; only the chief's area is eligible.
      invertSelection.addEventListener('click', () => {
        if (saving || loading) return;
        const current = window.AuthContext?.get?.();
        if (current?.role !== 'CHIEF' || current.userId !== context.userId ||
            current.companyId !== context.companyId || current.area !== context.area) return;
        for (const cell of wrapper.querySelectorAll('.cal-cell[role="button"], .week-cell[role="button"]')) {
          const row = cell.closest('.cal-row, .week-row');
          if (row?.hidden || row?.style.display === 'none') continue;
          const employeeId = cell.dataset.employeeId;
          const date = cell.dataset.date;
          if (!employeeId || !date) continue;
          const key = employeeId + ':' + date;
          if (duplicateCells.has(key)) continue;
          if (selectedCells.has(key)) {
            selectedCells.delete(key);
            cell.classList.remove('selected');
            cell.setAttribute('aria-pressed', 'false');
          } else {
            selectedCells.set(key, { employeeId, date });
            cell.classList.add('selected');
            cell.setAttribute('aria-pressed', 'true');
          }
        }
        selectionAnchor = null;
        updateSelection();
      });
      applySelection.addEventListener('click', () => commitSelection(selectionCode.value));
      removeSelection.addEventListener('click', () => commitSelection(null));
      clearSelection.addEventListener('click', () => {
        for (const cell of wrapper.querySelectorAll('.cal-cell.selected, .week-cell.selected')) {
          cell.classList.remove('selected');
          cell.setAttribute('aria-pressed', 'false');
        }
        selectedCells.clear();
        selectionAnchor = null;
        updateSelection();
      });
      // Escape clears a pending multi-cell selection without opening an editor.
      // Ignore inputs so it does not interfere with editing a shift or searching.
      selectionBar.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !selectedCells.size) return;
        if (event.target?.closest?.('input, textarea, select')) return;
        event.preventDefault();
        clearSelection.click();
      });
      selectionBar.append(selectionCount, selectionBreakdown, selectVisible, selectFilteredWeekdays, selectWeekends, selectEmpty, selectAssigned, invertSelection, targetDate, selectDate, matchingCode, selectMatching, selectionCode, applySelection, removeSelection, clearSelection);
      content.append(selectionBar);
      // Match the original planner's quick worker navigation. The filter is
      // local to this area snapshot and never broadens employee access.
      const employeeSearch = el('input');
      employeeSearch.type = 'search';
      employeeSearch.placeholder = 'Buscar trabajador del área…';
      employeeSearch.setAttribute('aria-label', 'Buscar trabajador del área');
      employeeSearch.className = 'area-employee-search';
      employeeSearch.value = preservedWorkerQuery;
      const workerCount = el('span', view.employees.length + ' trabajadores');
      workerCount.className = 'area-worker-count';
      const workerFilter = el('div');
      workerFilter.className = 'area-worker-filter';
      const resetSearch = el('button', 'Mostrar todos');
      resetSearch.type = 'button';
      resetSearch.addEventListener('click', () => {
        employeeSearch.value = '';
        employeeSearch.dispatchEvent(new Event('input'));
        employeeSearch.focus();
      });
      workerFilter.append(employeeSearch, resetSearch, workerCount);
      resetSearch.disabled = true;
      content.append(workerFilter);
      const wrapper = el('div');
      wrapper.className = 'table-wrap';
      wrapper.style.overflowX = 'auto';
      if (displayMode === 'monthly') {
        const grid = el('div');
        grid.className = 'calendar-grid';
        grid.style.minWidth = '1050px';
        const head = el('div');
        head.className = 'cal-head';
        const nameHead = el('div', 'Trabajador');
        nameHead.className = 'sticky-name';
        head.append(nameHead);
        for (let day = 1; day <= 31; day++) {
          const cell = el('div', day <= days ? String(day) : '');
          head.append(cell);
        }
        const summary = el('div', 'Resumen');
        summary.className = 'sticky-summary';
        head.append(summary);
        grid.append(head);
        for (const employee of view.employees) {
          const row = el('div');
          row.className = 'cal-row';
          const name = el('div');
          name.className = 'cal-name';
          const person = el('div');
          person.className = 'person';
          const avatar = el('div', (employee.name || '?').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase());
          avatar.className = 'avatar';
          const nameText = el('strong', employee.name || employee.id);
          person.append(avatar, nameText);
          name.append(person);
          row.append(name);
          const counts = {};
          for (let day = 1; day <= 31; day++) {
            const cell = el('div');
            cell.className = 'cal-cell';
            if (day <= days) {
              const date = selectedMonth + '-' + String(day).padStart(2,'0');
              const plan = plans.get(employee.id + ':' + date);
              if (plan?.code) {
                const dot = el('div', plan.code);
                dot.className = 'cal-dot plan-' + plan.code;
                cell.append(dot);
                counts[plan.code] = (counts[plan.code] || 0) + 1;
              }
              const operational = decorateCell(cell, employee.id, date);
              cell.title = (employee.name || 'Trabajador') + ' · ' + date + ' · ' +
                (plan?.code || 'Sin turno') + (operational ? ' · ' + operational : '');
              cell.tabIndex = 0;
              cell.dataset.employeeId = employee.id;
              cell.dataset.date = date;
              cell.setAttribute('role', 'button');
              cell.setAttribute('aria-label', cell.title + '. Editar turno');
              const edit = () => editShift(employee, date, plan);
              cell.addEventListener('click', e => {
                if (suppressDragClick) { suppressDragClick = false; return; }
                if (e.shiftKey) selectRange(cell, employee, date);
                else if (e.ctrlKey || e.metaKey) selectCell(cell, employee, date);
                else edit();
              });
              cell.addEventListener('contextmenu', e => {
                e.preventDefault();
                selectCell(cell, employee, date);
              });
              cell.addEventListener('mousedown', e => beginDrag(e, cell, employee, date));
              cell.addEventListener('mouseenter', () => dragOver(cell, employee, date));
              cell.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (e.shiftKey) selectRange(cell, employee, date);
                else if (e.ctrlKey || e.metaKey) selectCell(cell, employee, date);
                  else edit();
                }
              });
            }
            row.append(cell);
          }
          const total = el('div', Object.entries(counts).map(([code,count]) => code + ' ' + count).join(' · ') || 'Sin turnos');
          total.className = 'cal-summary';
          row.append(total);
          grid.append(row);
        }
        wrapper.append(grid);
      } else {
        const grid = el('div');
        grid.className = 'week-grid';
        const start = new Date(year, month - 1, 1);
        const mondayOffset = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - mondayOffset + selectedWeek * 7);
        grid.append(el('div', 'Trabajador'));
        const dates = Array.from({length:7}, (_,i) => {
          const d = new Date(start);
          d.setDate(start.getDate()+i);
          return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        });
        for (const date of dates) {
          const heading = el('div', date);
          heading.className = 'week-date';
          grid.append(heading);
        }
        for (const employee of view.employees) {
          const weekRow = el('div');
          weekRow.className = 'week-row';
          weekRow.style.display = 'contents';
          const name = el('div', employee.name || employee.id);
          name.className = 'week-name';
          weekRow.append(name);
          for (const date of dates) {
            const plan = plans.get(employee.id + ':' + date);
            const cell = el('div', plan?.code || 'Sin turno');
            cell.className = 'week-cell';
            const operational = decorateCell(cell, employee.id, date);
            cell.title = (employee.name || employee.id) + ' · ' + date +
              ' · ' + (plan?.code || 'Sin turno') +
              (operational ? ' · ' + operational : '');
            cell.tabIndex = 0;
            cell.dataset.employeeId = employee.id;
            cell.dataset.date = date;
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-label', (employee.name || 'Trabajador') + ' · ' + date + '. Editar turno');
            const edit = () => editShift(employee, date, plan);
            cell.addEventListener('click', event => {
              if (suppressDragClick) { suppressDragClick = false; return; }
              if (event.shiftKey) selectRange(cell, employee, date);
              else if (event.ctrlKey || event.metaKey) selectCell(cell, employee, date);
              else edit();
            });
            cell.addEventListener('contextmenu', event => {
              event.preventDefault();
              selectCell(cell, employee, date);
            });
            cell.addEventListener('mousedown', event => beginDrag(event, cell, employee, date));
            cell.addEventListener('mouseenter', () => dragOver(cell, employee, date));
            cell.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (event.shiftKey) selectRange(cell, employee, date);
                else if (event.ctrlKey || event.metaKey) selectCell(cell, employee, date);
                else edit();
              }
            });
            weekRow.append(cell);
          }
          grid.append(weekRow);
        }
        wrapper.append(grid);
      }
      content.append(wrapper);
      employeeSearch.addEventListener('input', () => {
        preservedWorkerQuery = employeeSearch.value;
        const query = employeeSearch.value.trim().toLocaleLowerCase('es-CL');
        let visible = 0;
        for (const row of wrapper.querySelectorAll('.cal-row, .week-row')) {
          const name = row.querySelector('.cal-name, .week-name');
          const match = !query || (name?.textContent || '').toLocaleLowerCase('es-CL').includes(query);
          row.hidden = !match;
          row.style.display = match ? (row.classList.contains('week-row') ? 'contents' : '') : 'none';
          if (match) visible++;
        }
        // A worker removed by the filter must not remain in a pending bulk edit.
        for (const [key, selected] of selectedCells) {
          const cell = [...wrapper.querySelectorAll('[data-employee-id][data-date]')].find(node =>
            node.dataset.employeeId === selected.employeeId && node.dataset.date === selected.date);
          if (cell?.closest('.cal-row, .week-row')?.hidden) {
            selectedCells.delete(key);
            cell.classList.remove('selected');
            cell.setAttribute('aria-pressed', 'false');
          }
        }
        if (selectionAnchor && ![...wrapper.querySelectorAll('[data-employee-id][data-date]')].some(node =>
          node.dataset.employeeId === selectionAnchor.employeeId &&
          node.dataset.date === selectionAnchor.date &&
          !node.closest('.cal-row, .week-row')?.hidden)) selectionAnchor = null;
        updateSelection();
        workerCount.textContent = visible + ' de ' + view.employees.length + ' trabajadores';
        resetSearch.disabled = !query;
      });
      // Reapply the persisted filter after the new grid is mounted.
      // Dispatching also updates the visible-worker counter and reset button.
      employeeSearch.dispatchEvent(new Event('input'));

      // Monthly staffing summary is derived exclusively from the loaded
      // area snapshot. No legacy global company data is consulted.
      const summaryPanel = el('section');
      summaryPanel.className = 'area-staffing-summary';
      summaryPanel.append(el('h3', 'Cobertura diaria · ' + selectedMonth));
      const staffing = el('div');
      staffing.className = 'area-table-wrap';
      const staffingTable = el('table');
      const staffingHead = el('tr');
      for (const label of ['Fecha', 'Turnos asignados', 'Sin asignación', 'Detalle']) {
        staffingHead.append(el('th', label));
      }
      staffingTable.append(staffingHead);
      for (let day = 1; day <= days; day++) {
        const date = selectedMonth + '-' + String(day).padStart(2, '0');
        const counts = {};
        let assigned = 0;
        for (const employee of view.employees) {
          const plan = plans.get(employee.id + ':' + date);
          if (!plan?.code) continue;
          assigned++;
          counts[plan.code] = (counts[plan.code] || 0) + 1;
        }
        const row = el('tr');
        for (const value of [date, assigned, view.employees.length - assigned,
          Object.entries(counts).map(([code, count]) => code + ': ' + count).join(' · ') || 'Sin turnos']) {
          row.append(el('td', value));
        }
        staffingTable.append(row);
      }
      staffing.append(staffingTable);
      summaryPanel.append(staffing);
      content.append(summaryPanel);
      if (!view.employees.length) {
        const empty = el('p', 'No hay trabajadores asignados a esta área. El administrador debe asignarlos.');
        empty.className = 'area-empty';
        content.append(empty);
      }
      const form = el('form');
      form.className = 'area-form';
      const worker = el('select');
      worker.required = true;
      for (const employee of view.employees) {
        const option = el('option', employee.name || employee.id);
        option.value = employee.id;
        worker.append(option);
      }
      const date = el('input');
      date.type = 'date';
      date.required = true;
      const shift = el('select');
      for (const code of validCodes) {
        const option = el('option', code);
        option.value = code;
        shift.append(option);
      }
      const submit = el('button', 'Guardar turno');
      submit.type = 'submit';
      for (const [title, field] of [['Trabajador', worker], ['Fecha', date], ['Turno', shift]]) {
        const label = el('label', title);
        label.append(field);
        form.append(label);
      }
      submit.disabled = view.employees.length === 0;
      form.append(submit);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!worker.value || !date.value) return;
        if (duplicateCells.has(worker.value + ':' + date.value)) {
          status.textContent = 'No se puede guardar: hay turnos duplicados para esa fecha.';
          return;
        }
        await mutate(() => window.ShiftControlAreaCalendar.upsertPlan({
          employeeId: worker.value, date: date.value, code: shift.value
        }));
      });
      content.append(form);

      // Bulk assignment is scoped to the same authenticated chief's workers.
      // One atomic area_state revision covers the entire selected date range.
      const bulk = el('form');
      bulk.className = 'area-form';
      const bulkWorker = el('select');
      const bulkAll = el('option', 'Todos los trabajadores del área');
      bulkAll.value = '__all__';
      bulkWorker.append(bulkAll);
      for (const employee of view.employees) {
        const option = el('option', employee.name || employee.id);
        option.value = employee.id;
        bulkWorker.append(option);
      }
      const fromDate = el('input');
      fromDate.type = 'date';
      fromDate.required = true;
      const toDate = el('input');
      toDate.type = 'date';
      toDate.required = true;
      const bulkCode = el('select');
      for (const code of validCodes) {
        const option = el('option', code);
        option.value = code;
        bulkCode.append(option);
      }
      const bulkSubmit = el('button', 'Asignar rango de turnos');
      bulkSubmit.type = 'submit';
      bulkSubmit.disabled = !view.employees.length;
      for (const [labelText, field] of [
        ['Trabajador', bulkWorker], ['Desde', fromDate],
        ['Hasta', toDate], ['Turno', bulkCode]
      ]) {
        const label = el('label', labelText);
        label.append(field);
        bulk.append(label);
      }
      bulk.append(bulkSubmit);
      bulk.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || loading || !fromDate.value || !toDate.value) return;
        const start = new Date(fromDate.value + 'T12:00:00Z');
        const end = new Date(toDate.value + 'T12:00:00Z');
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
            start > end || (end - start) / 86400000 > 30) {
          status.textContent = 'Selecciona un rango válido de hasta 31 días.';
          return;
        }
        const workers = bulkWorker.value === '__all__'
          ? view.employees : view.employees.filter(e => e.id === bulkWorker.value);
        const changes = [];
        for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
          const date = new Date(time).toISOString().slice(0, 10);
          for (const employee of workers) {
            if (duplicateCells.has(employee.id + ':' + date)) {
              status.textContent = 'No se puede asignar el rango: contiene turnos duplicados.';
              return;
            }
            changes.push({ employeeId: employee.id, date, code: bulkCode.value });
          }
        }
        if (!changes.length || changes.length > 2000) {
          status.textContent = 'El rango excede el máximo de 2000 asignaciones.';
          return;
        }
        if (!window.confirm('Asignar ' + changes.length + ' turnos en ' +
          areas[context.area] + '? Se reemplazarán los turnos existentes en esas fechas.')) return;
        await mutate(() => window.ShiftControlAreaCalendar.applyPlanChanges(changes));
      });
      content.append(bulk);

      // Apply a repeating weekly pattern, preserving the original planner's
      // recurring-shift workflow without touching the company-wide state.
      const pattern = el('form');
      pattern.className = 'area-form';
      const patternWorker = el('select');
      for (const employee of view.employees) {
        const option = el('option', employee.name || employee.id);
        option.value = employee.id;
        patternWorker.append(option);
      }
      const patternStart = el('input');
      patternStart.type = 'date';
      patternStart.required = true;
      const patternWeeks = el('select');
      for (const weeks of [1, 2, 3, 4, 6, 8]) {
        const option = el('option', weeks + ' semanas');
        option.value = String(weeks);
        patternWeeks.append(option);
      }
      const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves',
        'Viernes', 'Sábado', 'Domingo'];
      const patternCodes = weekdays.map(day => {
        const select = el('select');
        for (const code of validCodes) {
          const option = el('option', code);
          option.value = code;
          select.append(option);
        }
        return { day, select };
      });
      const patternSubmit = el('button', 'Aplicar patrón semanal');
      patternSubmit.type = 'submit';
      patternSubmit.disabled = !view.employees.length;
      for (const [labelText, field] of [
        ['Trabajador', patternWorker], ['Desde', patternStart],
        ['Repeticiones', patternWeeks],
        ...patternCodes.map(({ day, select }) => [day, select])
      ]) {
        const label = el('label', labelText);
        label.append(field);
        pattern.append(label);
      }
      pattern.append(patternSubmit);
      pattern.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || loading || !patternStart.value || !patternWorker.value) return;
        const start = new Date(patternStart.value + 'T12:00:00Z');
        if (!Number.isFinite(start.getTime()) ||
            start.toISOString().slice(0, 10) !== patternStart.value) {
          status.textContent = 'Fecha de inicio inválida.';
          return;
        }
        const weeks = Number(patternWeeks.value);
        if (![1, 2, 3, 4, 6, 8].includes(weeks)) return;
        const changes = [];
        for (let offset = 0; offset < weeks * 7; offset++) {
          const dateObject = new Date(start.getTime() + offset * 86400000);
          const date = dateObject.toISOString().slice(0, 10);
          if (duplicateCells.has(patternWorker.value + ':' + date)) {
            status.textContent = 'No se puede aplicar el patrón: contiene turnos duplicados.';
            return;
          }
          const weekday = (dateObject.getUTCDay() + 6) % 7;
          changes.push({ employeeId: patternWorker.value, date,
            code: patternCodes[weekday].select.value });
        }
        if (!window.confirm('Aplicar patrón de ' + weeks +
          ' semanas a este trabajador? Se reemplazarán sus turnos existentes.')) return;
        await mutate(() => window.ShiftControlAreaCalendar.applyPlanChanges(changes));
      });
      content.append(pattern);
      return true;
    }
    async function mutate(action) {
      if (stale || saving || loading) return;
      saving = true;
      const token = generation;
      reload.disabled = true;
      // Remember each control's original disabled state. A failed write must
      // never re-enable buttons that require a selection or other prerequisites.
      const lockedControls = [...content.querySelectorAll('button, input, select')]
        .map(node => ({ node, disabled: node.disabled }));
      lockedControls.forEach(({ node }) => { node.disabled = true; });
      status.textContent = 'Guardando en Supabase…';
      let writeCompleted = false;
      try {
        await action();
        writeCompleted = true;
        // Release the write lock before refreshing, but keep the reload
        // button disabled while the fresh snapshot is being fetched.
        if (token === generation) {
          saving = false;
          const refreshed = await refresh();
          if (refreshed !== true && token === generation) {
            status.textContent = 'Los turnos se guardaron, pero no se pudo actualizar el calendario. Pulsa Actualizar turnos antes de seguir editando.';
          }
        }
      } catch (error) {
        if (token === generation) {
          status.textContent = (writeCompleted ?
            'Se guardó, pero no se pudo actualizar el calendario: ' :
            'No se guardó: ') + (error?.message || 'error de sincronización');
          if (!writeCompleted && /revisi[oó]n|conflict|concurren|desactualizad/i.test(error?.message || '')) {
            status.textContent += ' Actualiza los turnos antes de intentar nuevamente.';
          }
        }
      } finally {
        if (token === generation) {
          saving = false;
          reload.disabled = loading;
          // A failed reload retains the old grid only as a read-only reference.
          // Restore editable controls only if the write itself failed; a
          // successful write requires a fresh snapshot before further edits.
          if (!writeCompleted) lockedControls.forEach(({ node, disabled }) => {
            if (node.isConnected) node.disabled = disabled;
          });
        }
      }
    }
  }
  window.ShiftControlAreaCalendarView = Object.freeze({ mount });
  document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('shiftcontrol:auth-context-changed', mount);
})();
