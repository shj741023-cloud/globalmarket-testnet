'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checklistTrade, assertChecklistBuyer } = require('../lib/checklist');

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

test('체크리스트 구매자만 배송 시뮬레이션을 실행할 수 있다', () => {
  const trade = checklistTrade([], 'buyer', { id: 'trade_1' }).trade;
  assert.equal(assertChecklistBuyer(trade, 'buyer'), true);
  assert.throws(() => assertChecklistBuyer(trade, 'other'), /Only the checklist buyer/);
  assert.throws(() => assertChecklistBuyer({ ...trade, purpose: 'normal' }, 'buyer'), /checklist trade is required/i);
});
