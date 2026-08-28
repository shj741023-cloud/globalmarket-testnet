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

test('상품 등록 화면은 위에서 열리고 자동 초점으로 스크롤을 유발하지 않는다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /<textarea id="productTitle"[^>]*class="title-input"/);
  assert.match(html, /id="productImage"[^>]*accept="image\/\*"/);
  assert.match(html, /class="secondary photo-picker">사진 선택<input id="productImage"/);
  assert.match(html, /class="secondary photo-picker">카메라 촬영<input id="productCamera"/);
  assert.doesNotMatch(app, /\$\('productImage'\)\.click/);
  assert.doesNotMatch(app, /\$\('productCamera'\)\.click/);
  assert.match(app, /if \(panelId !== 'registerPanel'\)/);
  assert.doesNotMatch(app, /\$\('productTitle'\)\.focus/);
});

test('Pi Browser 상품 등록은 별도 페이지의 직접 입력 컨트롤을 사용한다', () => {
  const page = fs.readFileSync(require.resolve('../public/register.html'), 'utf8');
  const script = fs.readFileSync(require.resolve('../public/register.js'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(app, /window\.location\.assign\('\/register\.html'\)/);
  assert.match(page, /id="standaloneTitle"/);
  assert.match(page, /id="standaloneImages"[^>]*type="file"/);
  assert.match(page, /id="standaloneCamera"[^>]*capture="environment"/);
  assert.doesNotMatch(script, /\.click\(\)/);
});
