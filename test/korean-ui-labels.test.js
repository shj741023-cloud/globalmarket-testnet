'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('일반 사용자 화면의 섹션 제목은 한글로 표시한다', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  for (const oldLabel of ['TEST PRODUCTS', 'SELLER REVIEWS', 'MY MARKET', 'NOTIFICATIONS', 'MY REPORTS', 'SELL TEST ITEM', 'EDIT TEST ITEM', 'MY CHATS', 'TRADE LAB', 'TESTNET ADMIN']) {
    assert.equal(index.includes(`>${oldLabel}<`), false);
  }
  assert.match(index, /나의 대화/);
  assert.match(index, /테스트넷 관리자/);
  assert.match(app, /구매 거래/);
  assert.match(app, /판매 거래/);
});
