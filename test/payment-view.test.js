'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

test('결제 결과를 접근 가능한 상태 영역에 표시한다', () => {
  assert.match(html, /id="paymentResult"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});

test('결제 완료 뒤 거래 상태를 새로고침하고 성공 문구를 표시한다', () => {
  assert.match(app, /Test-Pi 결제가 완료되었습니다/);
  assert.match(app, /loadMyTrades\(\)\.catch/);
});

test('Pi 인증 콜백의 미완료 결제를 로그인 뒤 서버 완료 API로 복구한다', () => {
  assert.match(app, /pendingPiPayments\.push\(payment\)/);
  assert.match(app, /await recoverPendingPiPayments\(\)/);
  assert.match(app, /transaction_verified/);
  assert.match(app, /internalPaymentId/);
  assert.match(app, /piPaymentId: providerPayment\.identifier, txid/);
});
