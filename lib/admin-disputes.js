'use strict';

function adminDisputeSummaries(state, query = {}) {
  const status = String(query.status || '').trim().toLowerCase();
  return (state.disputes || [])
    .filter((item) => !status || item.status === status)
    .map((item) => {
      const trade = (state.trades || []).find((candidate) => candidate.id === item.tradeId);
      const product = trade && (state.products || []).find((candidate) => candidate.id === trade.productId);
      return {
        id: item.id,
        tradeId: item.tradeId,
        productTitle: product?.title || '삭제된 상품',
        amount: trade?.amount ?? null,
        method: trade?.method || null,
        status: item.status,
        reason: item.reason,
        settlementHold: Boolean(item.settlementHold),
        createdAt: item.createdAt,
        decision: item.decision || null
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { adminDisputeSummaries };
