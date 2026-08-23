'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('상품 등록과 수정 화면에서 후면 카메라 촬영을 지원한다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /id="productCamera"[^>]*capture="environment"/);
  assert.match(html, /id="editProductCamera"[^>]*capture="environment"/);
  assert.match(app, /prepareCapturedImage/);
});

test('상품 등록 화면은 애니메이션 없이 열리고 상품명에 즉시 초점을 준다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /id="productTitle"[^>]*inputmode="text"/);
  assert.match(app, /panelId === 'registerPanel' \? 'auto' : 'smooth'/);
  assert.match(app, /\$\('productTitle'\)\.focus/);
});
