'use strict';
function roundPi(value) { return Math.round((Number(value) + Number.EPSILON) * 10000000) / 10000000; }
function createCompensation(input, now = new Date()) {
  const confirmed = roundPi(input.confirmedAmount); const recovered = roundPi(Math.min(confirmed, input.recoveredAmount));
  return { id: input.id, buyerId: input.buyerId, refundId: input.refundId, debtId: input.debtId,
    confirmedAmount: confirmed, recoveredAmount: recovered, unrecoveredAmount: roundPi(confirmed - recovered),
    currentlyPayableAmount: recovered, status: 'awaiting_confirmation', payoutMethod: 'batched', createdAt: now.toISOString() };
}
function confirmCompensation(item, buyerId, now = new Date()) {
  if (!item || item.buyerId !== buyerId) throw Object.assign(new Error('본인 보상만 확인할 수 있습니다.'), { code: 'COMPENSATION_OWNER_REQUIRED' });
  item.status = 'confirmed'; item.confirmedAt = now.toISOString(); return item;
}
function appealCompensation(item, buyerId, reason, now = new Date()) {
  if (!item || item.buyerId !== buyerId) throw Object.assign(new Error('본인 보상만 이의신청할 수 있습니다.'), { code: 'COMPENSATION_OWNER_REQUIRED' });
  const text = String(reason || '').trim(); if (!text) throw Object.assign(new Error('이의신청 사유가 필요합니다.'), { code: 'COMPENSATION_APPEAL_REASON_REQUIRED' });
  item.status = 'appeal_pending'; item.appealReason = text.slice(0, 2000); item.appealedAt = now.toISOString(); return item;
}
module.exports = { createCompensation, confirmCompensation, appealCompensation };
