'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checklistTrade } = require('../lib/checklist');

test('체크리스트 거래는 0.01 Test-Pi 전용으로 생성한다', () => {
  const result = checklistTrade([], 'buyer', { id: 'trade-check' });
  assert.equal(result.trade.amount, 0.01);
  assert.equal(result.trade.type, 'parcel_testnet');
  assert.equal(result.trade.purpose, 'pi_checklist');
});

test('같은 사용자의 진행 중 체크리스트 거래를 중복 생성하지 않는다', () => {
  const existing = checklistTrade([], 'buyer', { id: 'first' }).trade;
  const result = checklistTrade([existing], 'buyer', { id: 'second' });
  assert.equal(result.trade.id, 'first');
  assert.equal(result.idempotent, true);
});
