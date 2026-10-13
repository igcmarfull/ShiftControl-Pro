// Optional ADMIN-only area classification panel.
// Load after employees.js once the admin UI integration is reviewed.
// The legacy company-wide state must NOT be exposed to area CHIEFs.
(function () {
  'use strict';

  const AREA_LABELS = Object.freeze({
    ESTACION: 'Estación de servicio',
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
      `Estación: ${summary.ESTACION} · Tienda: ${summary.TIENDA} · Sin asignar: ${summary.UNASSIGNED} · Total: ${summary.total}`
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
        const partition = preview.partitionEmployeesAndPlans(state.get());
        const report = preview.migrationReadiness(partition);
        const inventory = preview.migrationInventory(state.get());
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
