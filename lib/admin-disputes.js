'use strict';

function adminDisputeSummary(state, item) {
  const trade = (state.trades || []).find((candidate) => candidate.id === item.tradeId);
  const product = trade && (state.products || []).find((candidate) => candidate.id === trade.productId);
  return {
    id: item.id,
    tradeId: item.tradeId,
    productTitle: product?.title || '삭제된 상품',
    amount: trade?.amount ?? null,
    method: trade?.method || trade?.type || null,
    status: item.status,
    reason: item.reason,
    settlementHold: Boolean(item.settlementHold),
    createdAt: item.createdAt,
    decision: item.decision || null
  };
}

function adminRefundSummary(refund) {
  if (!refund) return null;
  const { id, type, originalAmount, retainedAmount, productRefundAmount, buyerFeeRefund, totalBuyerRefund, unrecoverableNetworkFee, network, asset, isSimulation, status, completedAt } = refund;
  return { id, type, originalAmount, retainedAmount, productRefundAmount, buyerFeeRefund, totalBuyerRefund, unrecoverableNetworkFee, network, asset, isSimulation, status, completedAt };
}

function adminDisputeSummaries(state, query = {}) {
  const status = String(query.status || '').trim().toLowerCase();
  return (state.disputes || [])
    .filter((item) => !status || item.status === status)
    .map((item) => adminDisputeSummary(state, item))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { adminDisputeSummary, adminRefundSummary, adminDisputeSummaries };
