'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('새로고침 후에도 종료 방지 기록을 항상 다시 만든다', () => {
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(app, /function initializeNavigationHistory\(\) \{\s*history\.replaceState\(\{ gmApp: true, gmView: 'exitGuard' \}/);
  assert.match(app, /history\.pushState\(\{ gmApp: true, gmView: 'home' \}/);
  assert.doesNotMatch(app, /if \(!history\.state\?\.gmApp\)/);
});

test('명시적 동의 버튼만 앱 종료 기록으로 이동한다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /id="agreeExit"[^>]*>동의합니다<\/button>/);
  assert.match(app, /\$\('agreeExit'\)\.addEventListener\('click', \(\) => \{ closeExitConfirm\(\); history\.go\(-2\); \}\)/);
  assert.doesNotMatch(app, /confirm\('Global Market 앱을 종료할까요\?'/);
});
