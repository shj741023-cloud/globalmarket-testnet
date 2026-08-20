'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('환불 판정은 관리자 전용이고 사용자는 분쟁 접수 전에 가스비를 안내받는다', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const terms = fs.readFileSync(path.join(__dirname, '..', 'public', 'terms.html'), 'utf8');
  assert.match(app, /data-dispute-type/);
  assert.match(app, /adminApi\(`\/api\/v1\/admin\/disputes/);
  assert.doesNotMatch(app, /actionChecklistRefund/);
  assert.doesNotMatch(app, /actionChecklistPartialRefund/);
  assert.match(app, /분쟁·환불 가스비 필수 안내/);
  assert.match(app, /최초 결제 가스비 0\.01 Pi는 반환되지 않습니다/);
  assert.match(app, /가스비 보상은 책임자에게 실제 회수된 뒤 별도로 지급/);
  assert.match(terms, /전액환불에는 구매자 환불 송금 가스비/);
  assert.match(terms, /부분환불에는 구매자 환불 송금과 판매자 정산 송금에 각각 가스비/);
});
