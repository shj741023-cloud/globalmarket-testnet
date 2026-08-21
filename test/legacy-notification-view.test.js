'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('legacy gas notifications are clearly marked as historical test records', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /과거 Testnet 기능시험 기록/);
  assert.match(app, /현재 가스비 각자 부담 정책에서는 사용하지 않는 시험 기록입니다/);
  assert.match(app, /gas_compensation_paid/);
});
