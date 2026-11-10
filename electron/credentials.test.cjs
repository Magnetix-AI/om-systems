const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createCredentialStore } = require('./credentials.cjs');

function fixture(t, available = true, backend = 'dpapi') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-login-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const key = crypto.randomBytes(32);
  const encryption = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), content]);
    },
    decryptString(value) {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      cipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
  const file = path.join(dir, 'saved-login.bin');
  return { store: createCredentialStore(file, encryption), file, encryption };
}

test('saved login details survive reopening and are not stored in plaintext', t => {
  const { store, file, encryption } = fixture(t);
  const value = { username: 'test-technician', password: 'synthetic-test-password' };
  assert.equal(store.save('technician', value), true);
  assert.deepEqual(createCredentialStore(file, encryption).get('technician'), value);
  assert.equal(fs.readFileSync(file).includes(Buffer.from(value.password)), false);
});
test('admin and technician details are separate and can be removed', t => {
  const { store, file } = fixture(t);
  store.save('admin', { username: 'test-admin', password: 'synthetic-admin' });
  store.save('technician', { username: 'test-tech', password: 'synthetic-tech' });
  store.remove('admin');
  assert.equal(store.get('admin'), null);
  assert.equal(store.get('technician').username, 'test-tech');
  store.clear();
  assert.equal(fs.existsSync(file), false);
});
test('insecure or unavailable encryption never writes credentials', t => {
  for (const [available, backend] of [[false, 'dpapi'], [true, 'basic_text']]) {
    const { store, file } = fixture(t, available, backend);
    assert.equal(store.available(), false);
    assert.throws(() => store.save('admin', { username: 'test', password: 'synthetic' }));
    assert.equal(fs.existsSync(file), false);
  }
});
test('invalid login values cannot be saved', t => {
  const { store, file } = fixture(t);
  assert.equal(store.save('other', { username: 'test', password: 'synthetic' }), false);
  assert.equal(store.save('admin', { username: 'test', password: '' }), false);
  assert.equal(fs.existsSync(file), false);
});