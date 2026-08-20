'use strict';

const { NETWORK, ASSET, paymentQuote, assertFinancialTradeAllowed } = require('./policy');

function completeMockSettlement(trade, settlements, input = {}, now = new Date()) {
  assertFinancialTradeAllowed(trade);
  if (trade.settlementHold) throw Object.assign(new Error('Settlement is held by a dispute'), { code: 'SETTLEMENT_HELD' });
  if (!['purchase_confirmed', 'completed'].includes(trade.status)) throw Object.assign(new Error('Purchase confirmation is required'), { code: 'PURCHASE_NOT_CONFIRMED' });
  const existing = settlements.find((item) => item.tradeId === trade.id);
  if (existing) return { settlement: existing, idempotent: true };
  const quote = paymentQuote(trade.amount, 0);
  const settlement = {
    id: input.id, tradeId: trade.id, network: NETWORK, asset: ASSET,
    isSimulation: true, grossAmount: trade.amount, sellerFee: quote.sellerFee,
    netAmount: quote.sellerExpectedSettlement, externalPayoutId: null,
    status: 'mock_completed', completedAt: now.toISOString()
  };
  settlements.push(settlement);
  return { settlement, idempotent: false };
}

module.exports = { completeMockSettlement };
