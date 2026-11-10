const fs = require('node:fs');

function createCredentialStore(file, encryption) {
  function available() {
    return encryption.isEncryptionAvailable() && encryption.getSelectedStorageBackend?.() !== 'basic_text';
  }
  function readAll() {
    if (!available()) return {};
    try { return JSON.parse(encryption.decryptString(fs.readFileSync(file))); }
    catch { return {}; }
  }
  function writeAll(entries) {
    if (!Object.keys(entries).length) {
      fs.rmSync(file, { force: true });
      return;
    }
    if (!available()) throw new Error('Secure storage is unavailable');
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, encryption.encryptString(JSON.stringify(entries)), { mode: 0o600 });
    fs.renameSync(temp, file);
  }
  return {
    available,
    get: kind => readAll()[kind] ?? null,
    save(kind, value) {
      if (!['technician', 'admin'].includes(kind) || typeof value?.username !== 'string' ||
          typeof value?.password !== 'string' || !value.username.trim() || !value.password ||
          value.username.length > 320 || value.password.length > 4096) return false;
      writeAll({ ...readAll(), [kind]: { username: value.username, password: value.password } });
      return true;
    },
    remove(kind) { const entries = readAll(); delete entries[kind]; writeAll(entries); },
    clear() { fs.rmSync(file, { force: true }); },
  };
}

module.exports = { createCredentialStore };