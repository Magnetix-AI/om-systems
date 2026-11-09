const test = require('node:test');
const assert = require('node:assert/strict');
const { APP_URL, navigationAction } = require('./navigation.cjs');

test('the desktop app uses the production app', () => {
  assert.equal(APP_URL, 'https://om-systems.lovable.app');
  assert.equal(navigationAction(`${APP_URL}/admin`), 'app');
});
test('external secure pages open outside the desktop window', () => {
  assert.equal(navigationAction('https://example.com'), 'external');
  assert.equal(navigationAction('https://om-systems.lovable.app.example.com'), 'external');
});
test('local files and executable URLs cannot be opened', () => {
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'http://example.com', 'not-a-url']) {
    assert.equal(navigationAction(url), 'deny');
  }
});