// Isolated CHIEF calendar UI. It never reads the legacy global state.
(function () {
  'use strict';
  const ID = 'shiftcontrol-area-calendar';
  const areas = { ESTACION: 'Isla', TIENDA: 'Tienda' };
  let generation = 0;
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
    if (!authorized) {
      generation++;
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
        root.dataset.area === context.area) return;
    generation++;
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
      const table = el('table');
      const head = el('tr');
      for (const title of ['Trabajador', 'Fecha', 'Turno', 'Acción']) {
        head.append(el('th', title));
      }
      table.append(head);
      const names = new Map(view.employees.map(e => [e.id, e.name || e.id]));
      for (const plan of [...view.plans].sort((a, b) =>
        String(a.date).localeCompare(String(b.date)))) {
        const row = el('tr');
        row.append(el('td', names.get(plan.employeeId) || 'Trabajador'),
          el('td', plan.date), el('td', plan.code || '—'));
        const cell = el('td');
        const remove = el('button', 'Eliminar');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar este turno?')) return;
          await mutate(() => window.ShiftControlAreaCalendar.removePlan(
            plan.employeeId, plan.date));
        });
        cell.append(remove);
        row.append(cell);
        table.append(row);
      }
      const tableWrap = el('div');
      tableWrap.className = 'area-table-wrap';
      tableWrap.append(table);
      content.append(tableWrap);
      if (!view.plans.length) {
        const empty = el('p', view.employees.length ? 'Todavía no hay turnos asignados. Agrega el primero abajo.' : 'No hay trabajadores asignados a esta área. Solicita al administrador que los asigne.');
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
      for (const code of ['A', 'B', 'C', 'D', 'Libre']) {
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
        if (token === generation) status.textContent =
          'No se guardó: ' + (error?.message || 'error de sincronización');
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
