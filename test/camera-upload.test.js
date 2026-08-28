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
  assert.match(html, /id="selectProductImages"[^>]*>사진 선택<\/button>/);
  assert.match(html, /id="takeProductPhoto"[^>]*>카메라 촬영<\/button>/);
  assert.match(app, /\$\('selectProductImages'\).*\$\('productImage'\)\.click/);
  assert.match(app, /\$\('takeProductPhoto'\).*\$\('productCamera'\)\.click/);
  assert.match(app, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.doesNotMatch(app, /\$\('productTitle'\)\.focus/);
});
