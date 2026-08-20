'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { activeTradingDebt, assertTradingAllowed, createGasDebt } = require('../lib/trading-restrictions');

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
