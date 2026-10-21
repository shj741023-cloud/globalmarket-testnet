'use strict';

function adminTradeSummaries(state, query = {}) {
  const settlements = state.settlements || [];
  return (state.trades || [])
    .filter((trade) => !query.status || trade.status === query.status)
    .filter((trade) => !query.type || trade.type === query.type)
    .map((trade) => {
      const product = (state.products || []).find((item) => item.id === trade.productId);
      const settlement = settlements.find((item) => item.tradeId === trade.id);
      return {
        id: trade.id,
        productTitle: String(product?.title || '상품정보 없음'),
        type: trade.type,
        status: trade.status,
        amount: trade.amount,
        settlementHold: Boolean(trade.settlementHold),
        shipBy: trade.shipBy || null,
        settlement: settlement ? { status: settlement.status, grossAmount: settlement.grossAmount, sellerFee: settlement.sellerFee, netAmount: settlement.netAmount, completedAt: settlement.completedAt } : null,
        createdAt: trade.createdAt
      };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

module.exports = { adminTradeSummaries };
