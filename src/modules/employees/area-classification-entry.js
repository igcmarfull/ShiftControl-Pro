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
    // An existing panel belongs to the session that opened it. Never keep
    // another ADMIN's employee data visible after switching accounts.
    if (root && root.dataset.owner !== context.userId) {
      root.remove();
      root = null;
    }
    if (root) return;
    root = document.createElement('section');
    root.dataset.owner = context.userId;
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
      if (current?.role !== 'ADMIN' || current.companyId !== context.companyId ||
          current.userId !== context.userId) {
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
  // The existing SPA re-renders employees after async auth/bootstrap. Mount
  // there too, without relying on an auth event that the legacy app may omit.
  const originalRenderEmployees = window.renderEmployees;
  if (typeof originalRenderEmployees === 'function') {
    window.renderEmployees = function () {
      const result = originalRenderEmployees.apply(this, arguments);
      mount();
      return result;
    };
  }
  window.addEventListener('shiftcontrol:auth-context-changed', mount);
})();
