'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('관리자 화면은 새 신고와 분쟁을 주기적으로 알린다', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /새 신고 확인 필요/);
  assert.match(app, /새 분쟁 확인 필요/);
  assert.match(app, /setInterval[\s\S]*30000/);
  assert.match(app, /data-admin-alert-go/);
});
