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
  assert.match(app, /과실과 관계없이 상대방에게 가스비 보상을 청구하지 않습니다/);
  assert.doesNotMatch(app, /Testnet 정산 재확인/);
  assert.match(terms, /환불 송금 가스비는 구매자 환불액에서/);
  assert.match(terms, /가스비 미납금, 보증금, 강제회수 또는 가스비로 인한 거래 제한은 운영하지 않습니다/);
});
