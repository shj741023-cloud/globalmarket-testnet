'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('검증된 기본 사진 선택 입력을 상품 등록과 수정에서 사용한다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /id="productImage"[^>]*type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*multiple/);
  assert.match(html, /id="editProductImage"[^>]*type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*multiple/);
  assert.match(app, /prepareSelectedImages\('productImage'/);
});

test('상품 등록 화면은 기존 화면 안에서 단순 입력 컨트롤로 열린다', () => {
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  assert.match(html, /<input id="productTitle"[^>]*name="title"/);
  assert.match(app, /showFeaturePanel\('registerPanel'\)/);
  assert.doesNotMatch(app, /window\.location\.assign\('\/register\.html'\)/);
});
