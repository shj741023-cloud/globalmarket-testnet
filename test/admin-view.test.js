'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

test('관리자 회원 화면에 잠금·검색·상태변경 요소가 연결된다', () => {
  for (const id of ['openAdmin', 'adminPanel', 'adminUnlockForm', 'adminKey', 'adminSearchForm', 'adminUsers', 'showAdminReports', 'adminReports', 'showAdminDisputes', 'adminDisputes', 'showAdminAudit', 'adminAudit']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`\\$\\('${id}'\\)`));
  }
  assert.match(app, /\/api\/v1\/admin\/users/);
  assert.match(app, /\/status/);
  assert.match(app, /\/assign/);
  assert.match(app, /\/decision/);
  assert.match(app, /\/audit-logs/);
  assert.match(app, /\/admin\/disputes/);
});

test('관리자 키는 브라우저 영구 저장소에 기록하지 않는다', () => {
  assert.doesNotMatch(app, /localStorage[^\n]*admin/i);
  assert.doesNotMatch(app, /sessionStorage[^\n]*admin/i);
  assert.match(app, /state\.adminKey = null/);
  assert.match(html, /type="password"/);
});
