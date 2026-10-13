// Optional ADMIN-only area classification panel.
// Load after employees.js once the admin UI integration is reviewed.
// The legacy company-wide state must NOT be exposed to area CHIEFs.
(function () {
  'use strict';

  const AREA_LABELS = Object.freeze({
    ESTACION: 'Isla',
    TIENDA: 'Tienda de conveniencia'
  });

  function requireAdmin() {
    const context = window.AuthContext?.get?.();
    if (!context || context.role !== 'ADMIN' || !context.companyId) {
      throw new Error('Esta pantalla está reservada para ADMIN.');
    }
  }

  function create(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function render(container) {
    requireAdmin();
    if (!(container instanceof HTMLElement)) {
      throw new Error('Se requiere un contenedor HTML.');
    }
    const employees = window.EmployeeModule;
    if (!employees?.getAreaSummary || !employees?.assignArea) {
      throw new Error('El módulo de trabajadores no está disponible.');
    }

    container.replaceChildren();
    const heading = create('h2', 'Clasificación de trabajadores');
    container.append(heading);

    const summary = employees.getAreaSummary();
    container.append(create('p',
      `Isla: ${summary.ESTACION} · Tienda: ${summary.TIENDA} · Sin asignar: ${summary.UNASSIGNED} · Total: ${summary.total}`
    ));

    // ADMIN-only dry-run of the full legacy operational snapshot.
    // Never writes to area_state or changes the existing calendar.
    const preview = window.ShiftControlAreaPartition;
    const state = window.ShiftControlState;
    if (preview?.partitionEmployeesAndPlans && preview?.migrationReadiness &&
        preview?.migrationInventory &&
        typeof state?.get === 'function') {
      const section = create('section');
      section.append(create('h3', 'Diagnóstico previo a separar las áreas'));
      try {
        const snapshot = state.get();
        const partition = preview.partitionEmployeesAndPlans(snapshot);
        const report = preview.migrationReadiness(partition);
        const inventory = preview.migrationInventory(snapshot);
        section.append(create('p', 'Campos adicionales pendientes de revisión: ' +
          inventory.unexpected.length));
        if (inventory.unexpected.length) {
          section.append(create('p', 'No se copiarán automáticamente: ' +
            inventory.unexpected.join(', ')));
        }
        if (report.ready && !inventory.complete) {
          section.append(create('p',
            'La clasificación está completa, pero aún no es seguro migrar todo el estado.'));
        }
        const safeToPrepare = report.ready && inventory.complete;
        const overall = create('p', safeToPrepare
          ? 'Diagnóstico aprobado: no se detectaron registros ni campos pendientes. Esto NO ejecuta la migración.'
          : 'NO APTO PARA MIGRAR: revisa los registros y campos indicados antes de copiar datos.');
        overall.setAttribute('role', 'status');
        section.append(overall);
        const counts = inventory.counts;
        section.append(create('p',
          'Inventario original: ' +
          Object.entries(counts).map(([name, count]) => name + ': ' + count).join(' · ')
        ));
        // Separate, explicit preview for disposable historical test records.
        // This does not change app_state, area_state, or the current calendar.
        if (typeof preview.prepareFreshCalendars === 'function') {
          const freshSection = create('section');
          freshSection.append(create('h3', 'Vista previa: calendarios nuevos desde cero'));
          try {
            const fresh = preview.prepareFreshCalendars(snapshot);
            freshSection.append(create('p',
              'Trabajadores conservados: Isla ' + fresh.ESTACION.employees.length +
              ' · Tienda ' + fresh.TIENDA.employees.length));
            freshSection.append(create('p',
              'Registros históricos de prueba que NO se copiarían: ' +
              Object.entries(fresh.excludedTestRecords)
                .map(([name, count]) => name + ': ' + count).join(' · ')));
            freshSection.append(create('p',
              'Feriados compartidos conservados para revisión ADMIN: ' +
              fresh.sharedHolidays.length));
            const notice = create('p',
              'SOLO VISTA PREVIA. No borra horarios, no crea calendarios y no cambia permisos.');
            notice.setAttribute('role', 'status');
            freshSection.append(notice);
          } catch (error) {
            freshSection.append(create('p',
              'No se pueden preparar calendarios nuevos: ' + (error?.message || 'datos inválidos')));
          }
          section.append(freshSection);
        }
        const labels = {
          unassignedEmployees: 'Trabajadores sin área',
          unassignedPlans: 'Turnos de trabajadores sin área',
          unassignedExecutions: 'Asistencias de trabajadores sin área',
          unassignedAdditional: 'Jornadas adicionales sin área',
          unassignedAbsences: 'Ausencias de trabajadores sin área',
          unresolvedPlans: 'Turnos sin trabajador identificado',
          unresolvedExecutions: 'Asistencias sin trabajador identificado',
          unresolvedAdditional: 'Jornadas adicionales sin trabajador identificado',
          unresolvedAbsences: 'Ausencias sin trabajador identificado'
        };
        for (const item of report.blockers) {
          section.append(create('p', labels[item.name] + ': ' + item.count));
        }
      } catch (error) {
        section.append(create('p', 'No se pudo verificar: ' + (error?.message || 'datos inválidos')));
      }
      container.append(section);
    }

    const pending = employees.getUnassigned();
    if (!pending.length) {
      container.append(create('p', 'No hay trabajadores pendientes de clasificación.'));
      return;
    }

    if (typeof employees.assignUnassignedToArea === 'function') {
      const bulk = create('button', 'Asignar todos los pendientes a Isla');
      bulk.type = 'button';
      const bulkStatus = create('span');
      bulkStatus.setAttribute('role', 'status');
      bulk.addEventListener('click', () => {
        try {
          requireAdmin();
          const ids = pending.map(employee => employee.id);
          if (!window.confirm(
            '¿Confirmas que los ' + ids.length +
            ' trabajadores SIN ÁREA pertenecen a Isla? ' +
            'No se modificarán trabajadores ya asignados a Tienda.'
          )) return;
          const count = employees.assignUnassignedToArea('ESTACION', ids);
          render(container);
          const notice = create('p', count + ' trabajadores clasificados en Isla.');
          notice.setAttribute('role', 'status');
          container.append(notice);
        } catch (error) {
          bulkStatus.textContent = error?.message || 'No fue posible clasificar trabajadores.';
        }
      });
      container.append(bulk, bulkStatus);
    }

    const list = create('div');
    for (const employee of pending) {
      const row = create('div');
      const name = create('span', employee.name || employee.rut || employee.id);
      const select = create('select');
      select.setAttribute('aria-label', `Área de ${employee.name || employee.id}`);
      const placeholder = create('option', 'Seleccionar área');
      placeholder.value = '';
      select.append(placeholder);
      for (const [value, label] of Object.entries(AREA_LABELS)) {
        const option = create('option', label);
        option.value = value;
        select.append(option);
      }
      const button = create('button', 'Asignar');
      button.type = 'button';
      const status = create('span');
      status.setAttribute('role', 'status');
      button.addEventListener('click', () => {
        if (!select.value) {
          status.textContent = 'Selecciona un área.';
          return;
        }
        if (!window.confirm(`¿Asignar a ${employee.name || employee.id} a ${AREA_LABELS[select.value]}?`)) {
          return;
        }
        try {
          requireAdmin();
          employees.assignArea(employee.id, select.value);
          render(container);
        } catch (error) {
          status.textContent = error?.message || 'No se pudo asignar el área.';
        }
      });
      row.append(name, document.createTextNode(' '), select, document.createTextNode(' '), button, status);
      list.append(row);
    }
    container.append(list);
  }

  window.EmployeeAreaClassification = Object.freeze({ render });
})();
