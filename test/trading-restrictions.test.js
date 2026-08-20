'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { activeTradingDebt, assertTradingAllowed, createGasDebt, appealGasDebt, mockPayGasDebt, decideGasDebtAppeal } = require('../lib/trading-restrictions');

test('확정 미납금은 48시간 이의신청 기간 후 전체 거래를 차단한다', () => {
  const now = new Date('2026-08-20T00:00:00Z');
  const debt = createGasDebt({ id: 'debt1', userId: 'seller1', refundId: 'refund1', amount: 0.02505 }, now);
  assert.equal(debt.appealDeadline, '2026-08-22T00:00:00.000Z');
  assert.equal(activeTradingDebt([debt], 'seller1', new Date('2026-08-21T23:59:59Z')), null);
  assert.equal(activeTradingDebt([debt], 'seller1', new Date('2026-08-22T00:00:00Z')).id, 'debt1');
  assert.throws(() => assertTradingAllowed([debt], 'seller1', new Date('2026-08-23T00:00:00Z')), (error) => error.code === 'TRADING_BLOCKED_BY_DEBT');
});

test('완납·타인 미납·이의신청 기간 중에는 거래를 차단하지 않는다', () => {
  const debt = createGasDebt({ id: 'debt1', userId: 'seller1', refundId: 'refund1', amount: 0.01 }, new Date('2026-08-20T00:00:00Z'));
  assert.doesNotThrow(() => assertTradingAllowed([debt], 'seller2', new Date('2026-08-23T00:00:00Z')));
  debt.status = 'paid'; debt.outstandingAmount = 0;
  assert.doesNotThrow(() => assertTradingAllowed([debt], 'seller1', new Date('2026-08-23T00:00:00Z')));
});

test('기한 내 이의신청은 거래차단을 보류하고 Testnet 모의납부는 제한을 해제한다', () => {
  const debt = createGasDebt({ id: 'debt1', userId: 'seller1', refundId: 'refund1', amount: 0.01 }, new Date('2026-08-20T00:00:00Z'));
  appealGasDebt(debt, 'seller1', '판정 재검토 요청', new Date('2026-08-21T00:00:00Z'));
  assert.equal(debt.status, 'appeal_pending');
  assert.doesNotThrow(() => assertTradingAllowed([debt], 'seller1', new Date('2026-08-23T00:00:00Z')));
  const result = mockPayGasDebt(debt, 'seller1', new Date('2026-08-23T01:00:00Z'));
  assert.equal(result.idempotent, false); assert.equal(debt.status, 'paid'); assert.equal(debt.outstandingAmount, 0);
});

test('타인의 미납금 처리와 기한 후 이의신청을 차단한다', () => {
  const debt = createGasDebt({ id: 'debt1', userId: 'seller1', refundId: 'refund1', amount: 0.01 }, new Date('2026-08-20T00:00:00Z'));
  assert.throws(() => mockPayGasDebt(debt, 'other'), (error) => error.code === 'GAS_DEBT_OWNER_REQUIRED');
  assert.throws(() => appealGasDebt(debt, 'seller1', '늦은 신청', new Date('2026-08-23T00:00:00Z')), (error) => error.code === 'GAS_DEBT_APPEAL_EXPIRED');
});

test('관리자는 이의신청 미납금을 유지·조정·취소할 수 있다', () => {
  const make = () => { const debt = createGasDebt({ id: 'd', userId: 'u', refundId: 'r', amount: 0.03 }, new Date('2026-08-20')); appealGasDebt(debt, 'u', '재검토', new Date('2026-08-21')); return debt; };
  const adjusted = decideGasDebtAppeal(make(), { type: 'adjust', amount: 0.01, reason: '일부 조정', adminId: 'admin' }, new Date('2026-08-21T01:00:00Z'));
  assert.equal(adjusted.status, 'confirmed_unpaid'); assert.equal(adjusted.outstandingAmount, 0.01);
  const cancelled = decideGasDebtAppeal(make(), { type: 'cancel', reason: '책임 없음', adminId: 'admin' });
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.outstandingAmount, 0);
  const upheld = decideGasDebtAppeal(make(), { type: 'uphold', reason: '원판정 유지', adminId: 'admin' });
  assert.equal(upheld.status, 'confirmed_unpaid'); assert.equal(upheld.outstandingAmount, 0.03);
});
