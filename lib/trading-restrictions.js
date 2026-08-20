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

function appealGasDebt(debt, userId, reason, now = new Date()) {
  if (!debt || debt.userId !== userId) throw Object.assign(new Error('본인 미납금만 이의신청할 수 있습니다.'), { code: 'GAS_DEBT_OWNER_REQUIRED' });
  if (debt.status !== 'confirmed_unpaid') throw Object.assign(new Error('이의신청할 수 없는 미납 상태입니다.'), { code: 'GAS_DEBT_APPEAL_NOT_ALLOWED' });
  if (now.getTime() > new Date(debt.appealDeadline).getTime()) throw Object.assign(new Error('이의신청 기간이 지났습니다.'), { code: 'GAS_DEBT_APPEAL_EXPIRED' });
  const message = String(reason || '').trim();
  if (!message) throw Object.assign(new Error('이의신청 사유를 입력하세요.'), { code: 'GAS_DEBT_APPEAL_REASON_REQUIRED' });
  debt.status = 'appeal_pending'; debt.appealReason = message.slice(0, 2000); debt.appealedAt = now.toISOString();
  return debt;
}

function mockPayGasDebt(debt, userId, now = new Date()) {
  if (!debt || debt.userId !== userId) throw Object.assign(new Error('본인 미납금만 납부할 수 있습니다.'), { code: 'GAS_DEBT_OWNER_REQUIRED' });
  if (debt.status === 'paid') return { debt, idempotent: true };
  if (!['confirmed_unpaid', 'appeal_pending'].includes(debt.status)) throw Object.assign(new Error('납부할 수 없는 미납 상태입니다.'), { code: 'GAS_DEBT_PAYMENT_NOT_ALLOWED' });
  debt.paidAmount = debt.outstandingAmount; debt.outstandingAmount = 0; debt.status = 'paid'; debt.paidAt = now.toISOString(); debt.isSimulation = true;
  return { debt, idempotent: false };
}

function decideGasDebtAppeal(debt, input, now = new Date()) {
  if (!debt || debt.status !== 'appeal_pending') throw Object.assign(new Error('검토 중인 이의신청이 필요합니다.'), { code: 'GAS_DEBT_APPEAL_REQUIRED' });
  if (!['uphold', 'adjust', 'cancel'].includes(input.type)) throw Object.assign(new Error('지원하지 않는 판정입니다.'), { code: 'INVALID_GAS_DEBT_DECISION' });
  const reason = String(input.reason || '').trim();
  if (!reason) throw Object.assign(new Error('판정 사유를 입력하세요.'), { code: 'GAS_DEBT_DECISION_REASON_REQUIRED' });
  if (input.type === 'adjust') {
    const amount = roundPi(input.amount);
    if (!(amount > 0) || amount >= debt.originalAmount) throw Object.assign(new Error('조정금액은 0보다 크고 최초 미납금보다 작아야 합니다.'), { code: 'INVALID_ADJUSTED_DEBT_AMOUNT' });
    debt.outstandingAmount = amount;
  }
  if (input.type === 'cancel') { debt.outstandingAmount = 0; debt.status = 'cancelled'; }
  else { debt.status = 'confirmed_unpaid'; debt.restrictionStartsAt = now.toISOString(); }
  debt.decision = { type: input.type, reason: reason.slice(0, 2000), decidedBy: input.adminId, decidedAt: now.toISOString(), amount: debt.outstandingAmount };
  return debt;
}

module.exports = { activeTradingDebt, assertTradingAllowed, createGasDebt, appealGasDebt, mockPayGasDebt, decideGasDebtAppeal };
