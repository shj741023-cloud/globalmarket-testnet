'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('전액·부분환불 전에 Pi 가스비를 명확히 안내한다', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const terms = fs.readFileSync(path.join(__dirname, '..', 'public', 'terms.html'), 'utf8');
  assert.match(app, /전액환불 가스비 안내/);
  assert.match(app, /예상 전체 가스비 0\.02 Pi/);
  assert.match(app, /부분환불 가스비 안내/);
  assert.match(app, /예상 전체 가스비 0\.03 Pi/);
  assert.match(app, /최초 결제 가스비 0\.01 Pi: 반환 불가/);
  assert.match(terms, /전액환불에는 구매자 환불 송금 가스비/);
  assert.match(terms, /부분환불에는 구매자 환불 송금과 판매자 정산 송금에 각각 가스비/);
});
