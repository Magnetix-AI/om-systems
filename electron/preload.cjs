const { ipcRenderer } = require('electron');

// No bridge is exposed to page scripts; credentials are used only on the app's login forms.
window.addEventListener('DOMContentLoaded', () => {
  if (window.top !== window || location.origin !== 'https://om-systems.lovable.app') return;
  function attachForms() {
    if (location.pathname !== '/auth') return;
    for (const [kind, userId, passId] of [
      ['technician', 'email', 'password'], ['admin', 'adminUser', 'adminPass'],
    ]) {
      const username = document.getElementById(userId);
      const password = document.getElementById(passId);
      const form = username?.closest('form');
      if (!form || !password || form.dataset.desktopRemember) continue;
      form.dataset.desktopRemember = 'true';
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 text-sm cursor-pointer';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `desktop-remember-${kind}`;
      label.append(checkbox, document.createTextNode('שמור פרטי התחברות במחשב זה'));
      form.insertBefore(label, form.querySelector('button[type="submit"]'));
      function setValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      ipcRenderer.invoke('desktop-login:read', kind).then(result => {
        if (!form.isConnected) return;
        checkbox.disabled = !result.available;
        if (!result.available) label.title = 'שמירה מאובטחת אינה זמינה במחשב זה';
        if (result.credentials && !username.value && !password.value) {
          setValue(username, result.credentials.username);
          setValue(password, result.credentials.password);
          checkbox.checked = true;
        }
      }).catch(() => { checkbox.disabled = true; });
      checkbox.addEventListener('change', () => {
        if (!checkbox.checked) ipcRenderer.invoke('desktop-login:remove', kind).catch(() => {});
      });
      form.addEventListener('submit', () => {
        ipcRenderer.send('desktop-login:candidate', {
          kind, remember: checkbox.checked,
          username: username.value, password: password.value,
        });
      }, true);
    }
  }
  new MutationObserver(attachForms).observe(document.body, { childList: true, subtree: true });
  attachForms();
});