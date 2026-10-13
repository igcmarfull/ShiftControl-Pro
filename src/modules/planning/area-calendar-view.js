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
        body.shiftcontrol-area-chief-mode .view,
        body.shiftcontrol-area-chief-mode .sidebar,
        body.shiftcontrol-area-chief-mode .mobile-nav {display:none!important}
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
        @media(max-width:640px){body.shiftcontrol-area-chief-mode #shiftcontrol-area-calendar {width:calc(100% - 20px);margin:10px auto!important;padding:18px!important}}
      `;
      document.head.append(style);
    }
    if (context?.role === 'ADMIN' && context.companyId && context.userId) {
      generation++;
      refreshActive = null;
      if (root) root.remove();
      document.body.classList.remove('shiftcontrol-area-chief-mode');
      const panel = el('section');
      panel.id = ID;
      panel.dataset.owner = context.userId;
      panel.dataset.company = context.companyId;
      panel.className = 'panel';
      panel.style.margin = '18px';
      panel.append(el('h2', 'Calendarios por área · Supervisión'));
      const status = el('p', 'Consultando turnos de Isla y Tienda…');
      status.setAttribute('role', 'status');
      panel.append(status);
      const reload = el('button', 'Actualizar calendarios');
      reload.type = 'button';
      panel.append(reload);
      const content = el('div');
      panel.append(content);
      document.body.append(panel);
      const ownerGeneration = generation;
      async function refreshAdmin() {
        reload.disabled = true;
        status.textContent = 'Consultando calendarios…';
        content.replaceChildren();
        try {
          const storage = window.ShiftControlStorage;
          if (typeof storage?.readAreaState !== 'function') {
            throw new Error('No está disponible la lectura de calendarios por área.');
          }
          const results = await Promise.allSettled(
            Object.keys(areas).map(area => storage.readAreaState(area, 'main')));
          const current = window.AuthContext?.get?.();
          if (ownerGeneration !== generation || current?.role !== 'ADMIN' ||
              current.userId !== context.userId || current.companyId !== context.companyId) return;
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
                section.append(el('p', 'Revisión ' + result.value.revision +
                  ' · ' + data.employees.length + ' trabajadores · ' +
                  data.plans.length + ' turnos registrados'));
                const table = el('table');
                const header = el('tr');
                for (const title of ['Trabajador', 'Fecha', 'Turno']) header.append(el('th', title));
                table.append(header);
                const names = new Map(data.employees.map(person => [person.id, person.name || person.id]));
                const currentMonth = selectedMonth;
                const monthPlans = data.plans.filter(plan => plan.date?.startsWith(currentMonth + '-'))
                  .sort((a, b) => a.date.localeCompare(b.date));
                for (const plan of monthPlans) {
                  const tr = el('tr');
                  for (const value of [names.get(plan.employeeId) || 'Sin asignar', plan.date, plan.code]) {
                    tr.append(el('td', value || ''));
                  }
                  table.append(tr);
                }
                section.append(monthPlans.length ? table : el('p', 'Sin turnos registrados este mes.'));
              }
            }
            content.append(section);
          }
          status.textContent = 'Calendarios de ' + selectedMonth + ' · solo lectura';
        } catch (error) {
          if (ownerGeneration === generation) status.textContent =
            'No se pudieron consultar los calendarios: ' + (error?.message || 'error');
        } finally {
          if (ownerGeneration === generation) reload.disabled = false;
        }
      }
      reload.addEventListener('click', refreshAdmin);
      void refreshAdmin();
      return;
    }
    if (!authorized) {
      generation++;
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
    const controls = el('div');
    controls.className = 'area-toolbar';
    let saving = false;
    let loading = false;
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
    refreshActive = refresh;
    refresh();
    async function refresh() {
      if (saving || loading) return;
      loading = true;
      reload.disabled = true;
      const token = ++generation;
      content.replaceChildren();
      let view;
      try {
        view = await window.ShiftControlAreaCalendar.load();
      } catch (error) {
        if (token === generation) status.textContent =
          error?.message || 'No se pudo consultar el calendario.';
        return;
      } finally {
        loading = false;
        if (!saving && token === generation) reload.disabled = false;
      }
      const now = window.AuthContext?.get?.();
      if (token !== generation || now?.userId !== context.userId ||
          now?.companyId !== context.companyId || now?.area !== context.area ||
          now?.role !== 'CHIEF') return;
      if (!view) {
        status.textContent = 'El administrador aún no ha migrado los turnos de esta área.';
        return;
      }
      status.textContent = 'Turnos del área · revisión ' + view.revision;
      const toolbar = el('div');
      toolbar.className = 'area-toolbar';
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
        const changes = view.plans.filter(plan => plan.date?.startsWith(sourceMonth + '-') &&
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
      const plans = new Map(view.plans.map(p => [p.employeeId + ':' + p.date, p]));
      const validCodes = ['A', 'B', 'C', 'D', 'L', 'V', 'P', 'X', 'Libre', 'Licencia', 'Vacaciones', 'Permiso'];
      function editShift(employee, date, plan) {
        if (saving || loading) return;
        const code = window.prompt(
          'Turno para ' + (employee.name || 'Trabajador') + ' · ' + date +
          ' (' + validCodes.join(', ') + '). Vacío para eliminar:',
          plan?.code || '');
        if (code === null) return;
        const value = code.trim();
        if (value && !validCodes.includes(value)) {
          status.textContent = 'Código de turno no válido.';
          return;
        }
        void mutate(() => value
          ? window.ShiftControlAreaCalendar.upsertPlan({ employeeId: employee.id, date, code: value })
          : window.ShiftControlAreaCalendar.removePlan(employee.id, date));
      }
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
              cell.title = (employee.name || 'Trabajador') + ' · ' + date + ' · ' + (plan?.code || 'Sin turno');
              cell.tabIndex = 0;
              cell.setAttribute('role', 'button');
              cell.setAttribute('aria-label', cell.title + '. Editar turno');
              const edit = () => editShift(employee, date, plan);
              cell.addEventListener('click', edit);
              cell.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
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
          const name = el('div', employee.name || employee.id);
          name.className = 'week-name';
          grid.append(name);
          for (const date of dates) {
            const plan = plans.get(employee.id + ':' + date);
            const cell = el('div', plan?.code || 'Sin turno');
            cell.className = 'week-cell';
            cell.tabIndex = 0;
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-label', (employee.name || 'Trabajador') + ' · ' + date + '. Editar turno');
            const edit = () => editShift(employee, date, plan);
            cell.addEventListener('click', edit);
            cell.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                edit();
              }
            });
            grid.append(cell);
          }
        }
        wrapper.append(grid);
      }
      content.append(wrapper);
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
        await mutate(() => window.ShiftControlAreaCalendar.upsertPlan({
          employeeId: worker.value, date: date.value, code: shift.value
        }));
      });
      content.append(form);
    }
    async function mutate(action) {
      if (saving || loading) return;
      saving = true;
      const token = generation;
      reload.disabled = true;
      content.querySelectorAll('button, input, select').forEach(node => {
        node.disabled = true;
      });
      status.textContent = 'Guardando en Supabase…';
      try {
        await action();
        // Release the write lock before refreshing, but keep the reload
        // button disabled while the fresh snapshot is being fetched.
        saving = false;
        if (token === generation) await refresh();
      } catch (error) {
        if (token === generation) {
          status.textContent = 'No se guardó: ' + (error?.message || 'error de sincronización');
          if (/revisi[oó]n|conflict|concurren|desactualizad/i.test(error?.message || '')) {
            status.textContent += ' Actualiza los turnos antes de intentar nuevamente.';
          }
        }
      } finally {
        saving = false;
        if (token === generation) {
          reload.disabled = loading;
          content.querySelectorAll('button, input, select').forEach(node => {
            node.disabled = false;
          });
        }
      }
    }
  }
  window.ShiftControlAreaCalendarView = Object.freeze({ mount });
  document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('shiftcontrol:auth-context-changed', mount);
})();
