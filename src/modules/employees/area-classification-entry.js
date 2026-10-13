// Opt-in ADMIN-only entry point. No CHIEF access to the legacy company state.
(function () {
  'use strict';
  const ID = 'shiftcontrol-area-classification';
  function mount() {
    const context = window.AuthContext?.get?.();
    const employeesView = document.getElementById('employees');
    let root = document.getElementById(ID);
    if (context?.role !== 'ADMIN' || !context.companyId || !employeesView) {
      if (root) root.remove();
      return;
    }
    if (root) return;
    root = document.createElement('section');
    root.id = ID;
    root.className = 'panel';
    root.style.margin = '16px 0';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Clasificar Estación / Tienda';
    const panel = document.createElement('div');
    panel.hidden = true;
    button.addEventListener('click', () => {
      const current = window.AuthContext?.get?.();
      if (current?.role !== 'ADMIN' || current.companyId !== context.companyId) {
        panel.hidden = true;
        panel.replaceChildren();
        mount();
        return;
      }
      if (!panel.hidden) {
        panel.hidden = true;
        panel.replaceChildren();
        return;
      }
      try {
        window.EmployeeAreaClassification.render(panel);
        panel.hidden = false;
      } catch (error) {
        panel.replaceChildren();
        const message = document.createElement('p');
        message.textContent = error?.message || 'No fue posible abrir la clasificación.';
        panel.append(message);
        panel.hidden = false;
      }
    });
    root.append(button, panel);
    const head = employeesView.querySelector('.employees-desktop-head');
    if (head) head.insertAdjacentElement('afterend', root);
    else employeesView.prepend(root);
  }
  window.ShiftControlAreaClassificationEntry = Object.freeze({ mount });
  document.addEventListener('DOMContentLoaded', mount);
  // Auth initialization may finish after DOMContentLoaded.
  window.addEventListener('shiftcontrol:auth-context-changed', mount);
})();
