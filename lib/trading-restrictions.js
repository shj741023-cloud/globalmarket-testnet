'use strict';

function roundPi(value) { return Math.round((Number(value) + Number.EPSILON) * 10000000) / 10000000; }

function activeTradingDebt(debts, userId, now = new Date()) {
  return (debts || []).find((item) => item.userId === userId
    && item.status === 'confirmed_unpaid'
    && new Date(item.restrictionStartsAt).getTime() <= now.getTime()
    && Number(item.outstandingAmount) > 0) || null;
}

function assertTradingAllowed(debts, userId, now = new Date()) {
  const debt = activeTradingDebt(debts, userId, now);
  if (!debt) return true;
  throw Object.assign(new Error(`확정 미납금 ${debt.outstandingAmount} Pi를 납부해야 거래할 수 있습니다.`), {
    code: 'TRADING_BLOCKED_BY_DEBT', debtId: debt.id, outstandingAmount: debt.outstandingAmount
  });
}

function createGasDebt(input, now = new Date()) {
  const amount = roundPi(input.amount);
  if (!input.id || !input.userId || !input.refundId || !(amount > 0)) {
    throw Object.assign(new Error('Valid gas debt data is required'), { code: 'INVALID_GAS_DEBT' });
  }
  const appealDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return {
    id: input.id, userId: input.userId, refundId: input.refundId,
    reason: '관리자 과실 판정에 따른 미회수 Pi 가스비',
    originalAmount: amount, outstandingAmount: amount,
    status: 'confirmed_unpaid', appealDeadline: appealDeadline.toISOString(),
    restrictionStartsAt: appealDeadline.toISOString(), createdAt: now.toISOString()
  };
}

module.exports = { activeTradingDebt, assertTradingAllowed, createGasDebt };
