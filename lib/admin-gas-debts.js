'use strict';

function adminGasDebtSummary(item) {
  return {
    id: item.id,
    refundId: item.refundId,
    reason: item.reason,
    originalAmount: item.originalAmount,
    outstandingAmount: item.outstandingAmount,
    status: item.status,
    appealReason: item.appealReason || null,
    appealDeadline: item.appealDeadline,
    appealedAt: item.appealedAt || null,
    paidAt: item.paidAt || null,
    decision: item.decision ? {
      type: item.decision.type,
      reason: item.decision.reason,
      amount: item.decision.amount,
      decidedAt: item.decision.decidedAt
    } : null,
    createdAt: item.createdAt
  };
}

function adminGasDebtSummaries(state, query = {}) {
  const status = String(query.status || '').trim().toLowerCase();
  return (state.gasDebts || [])
    .filter((item) => !status || item.status === status)
    .slice()
    .reverse()
    .map(adminGasDebtSummary);
}

module.exports = { adminGasDebtSummary, adminGasDebtSummaries };
