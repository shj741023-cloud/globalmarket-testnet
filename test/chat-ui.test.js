'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('채팅 화면에서 가격제안과 거래조건 변경을 전송한다', () => {
  assert.match(html, /id="priceProposalForm"/);
  assert.match(html, /id="agreementForm"/);
  assert.match(app, /\/price-proposals`/);
  assert.match(app, /data-proposal-action/);
});

test('양쪽 합의 확인은 서버의 확인시각 필드를 기준으로 표시한다', () => {
  assert.match(app, /agreement\?\.buyerConfirmedAt/);
  assert.match(app, /agreement\?\.sellerConfirmedAt/);
  assert.match(app, /buyerConfirmed && sellerConfirmed/);
});

test('종 알림 숫자와 채팅 자동 갱신을 연결한다', () => {
  assert.match(html, /id="notificationBell"/);
  assert.match(html, /id="notificationBadge"/);
  assert.match(app, /unreadCount/);
  assert.match(app, /setInterval\(.*5000/);
  assert.match(app, /chat-rooms\/\$\{roomId\}\/read/);
});
