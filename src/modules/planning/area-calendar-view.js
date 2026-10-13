// Isolated CHIEF calendar UI. It never reads the legacy global state.
(function () {
  'use strict';
  const ID = 'shiftcontrol-area-calendar';
  const areas = { ESTACION: 'Estación', TIENDA: 'Tienda' };
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
    if (!authorized) {
      generation++;
      if (root) root.remove();
      document.body.classList.remove('shiftcontrol-area-chief-mode');
      return;
    }
    if (root && root.dataset.owner === context.userId &&
        root.dataset.company === context.companyId &&
        root.dataset.area === context.area) return;
    generation++;
    if (root) root.remove();
    const container = el('section');
    container.id = ID;
    container.dataset.owner = context.userId;
    container.dataset.company = context.companyId;
    container.dataset.area = context.area;
    container.className = 'panel';
    container.style.margin = '18px';
    container.append(el('h2', 'Calendario · ' + areas[context.area]));
    const status = el('p', 'Cargando turnos del área…');
    status.setAttribute('role', 'status');
    const content = el('div');
    container.append(status, content);
    // Never leave the legacy company-wide grids visible to a scoped CHIEF.
    // This only masks presentation; Supabase RLS remains mandatory.
    document.body.classList.add('shiftcontrol-area-chief-mode');
    if (!document.getElementById('shiftcontrol-area-chief-style')) {
      const style = el('style');
      style.id = 'shiftcontrol-area-chief-style';
      style.textContent = 'body.shiftcontrol-area-chief-mode .view,' +
        'body.shiftcontrol-area-chief-mode .sidebar,' +
        'body.shiftcontrol-area-chief-mode .mobile-nav {' +
        'display:none!important}';
      document.head.append(style);
    }
    document.body.append(container);
    refresh();
    async function refresh() {
      const token = ++generation;
      content.replaceChildren();
      let view;
      try {
        view = await window.ShiftControlAreaCalendar.load();
      } catch (error) {
        if (token === generation) status.textContent =
          error?.message || 'No se pudo consultar el calendario.';
        return;
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
      content.append(table);
      const form = el('form');
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
      form.append(worker, date, shift, submit);
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
      const token = generation;
      status.textContent = 'Guardando en Supabase…';
      try {
        await action();
        if (token === generation) await refresh();
      } catch (error) {
        if (token === generation) status.textContent =
          'No se guardó: ' + (error?.message || 'error de sincronización');
      }
    }
  }
  window.ShiftControlAreaCalendarView = Object.freeze({ mount });
  document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('shiftcontrol:auth-context-changed', mount);
})();
