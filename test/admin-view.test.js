'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

test('관리자 회원 화면에 잠금·검색·상태변경 요소가 연결된다', () => {
  for (const id of ['openAdmin', 'adminPanel', 'adminUnlockForm', 'adminKey', 'adminSearchForm', 'adminAlerts', 'adminDashboard', 'adminUsers', 'showAdminProducts', 'adminProducts', 'showAdminReports', 'adminReports', 'showAdminDisputes', 'adminDisputes', 'showAdminSuggestions', 'adminSuggestions', 'showAdminAudit', 'adminAudit']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`\\$\\('${id}'\\)`));
  }
  assert.match(app, /\/api\/v1\/admin\/users/);
  assert.match(app, /\/status/);
  assert.match(app, /\/assign/);
  assert.match(app, /\/decision/);
  assert.match(app, /\/audit-logs/);
  assert.match(app, /\/admin\/disputes/);
  assert.match(app, /\/admin\/product-reviews/);
  assert.match(app, /\/admin\/dashboard/);
  assert.match(app, /\/admin\/suggestions/);
});

test('관리자 키는 브라우저 영구 저장소에 기록하지 않는다', () => {
  assert.doesNotMatch(app, /localStorage[^\n]*admin/i);
  assert.doesNotMatch(app, /sessionStorage[^\n]*admin/i);
  assert.match(app, /state\.adminKey = null/);
  assert.match(html, /type="password"/);
});

test('건의사항 처리 버튼은 관리자 카드에서 진한 색으로 표시한다', () => {
  const managementCss = fs.readFileSync(path.join(publicDir, 'management.css'), 'utf8');
  assert.match(managementCss, /\.management-card\s*>\s*button\.primary\s*\{[^}]*background:\s*#132a22[^}]*color:\s*#fff/s);
});
