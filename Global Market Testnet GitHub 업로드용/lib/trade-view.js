'use strict';

const { assertTradeParty } = require('./trade-access');

function listUserTrades(trades, userId, query = {}) {
  return trades
    .filter((trade) => {
      const role = trade.buyerId === userId ? 'buyer' : trade.sellerId === userId ? 'seller' : null;
      if (!role) return false;
      if (query.role && query.role !== role) return false;
      if (query.status && query.status !== trade.status) return false;
      if (query.type && query.type !== trade.type) return false;
      return true;
    })
    .map((trade) => ({ ...trade, myRole: trade.buyerId === userId ? 'buyer' : 'seller' }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function tradeSnapshot(state, trade, userId) {
  assertTradeParty(trade, userId);
  const byTrade = (items) => items.find((item) => item.tradeId === trade.id) || null;
  const disputes = state.disputes.filter((item) => item.tradeId === trade.id);
  return {
    trade: { ...trade, myRole: trade.buyerId === userId ? 'buyer' : 'seller' },
    product: state.products.find((item) => item.id === trade.productId) || null,
    payment: byTrade(state.payments),
    shipment: byTrade(state.shipments),
    directRecord: byTrade(state.directTradeRecords),
    settlement: byTrade(state.settlements),
    refund: byTrade(state.refunds),
    disputes,
    reviews: state.reviews.filter((item) => item.tradeId === trade.id)
  };
}

module.exports = { listUserTrades, tradeSnapshot };
