'use strict';

const { NETWORK, ASSET, PI_GAS_FEE, paymentQuote, assertFinancialTradeAllowed } = require('./policy');

function completeMockSettlement(trade, settlements, input = {}, now = new Date()) {
  assertFinancialTradeAllowed(trade);
  if (trade.settlementHold) throw Object.assign(new Error('Settlement is held by a dispute'), { code: 'SETTLEMENT_HELD' });
  if (!['purchase_confirmed', 'completed'].includes(trade.status)) throw Object.assign(new Error('Purchase confirmation is required'), { code: 'PURCHASE_NOT_CONFIRMED' });
  const existing = settlements.find((item) => item.tradeId === trade.id);
  if (existing) return { settlement: existing, idempotent: true };
  const grossAmount = Number(input.grossAmount ?? trade.amount);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || grossAmount > trade.amount) throw Object.assign(new Error('Settlement amount is invalid'), { code: 'INVALID_SETTLEMENT_AMOUNT' });
  const quote = paymentQuote(grossAmount, 0);
  const requiresBatch = quote.sellerExpectedSettlement <= PI_GAS_FEE;
  const settlement = {
    id: input.id, tradeId: trade.id, network: NETWORK, asset: ASSET,
    isSimulation: true, grossAmount, sellerFee: quote.sellerFee,
    netAmountBeforeGas: quote.sellerExpectedSettlement,
    netAmount: requiresBatch ? 0 : quote.sellerExpectedSettlement,
    pendingAmount: requiresBatch ? quote.sellerExpectedSettlement : 0,
    networkGasFee: PI_GAS_FEE,
    externalPayoutId: null,
    status: requiresBatch ? 'mock_pending_batch' : 'mock_completed',
    completedAt: requiresBatch ? null : now.toISOString(),
    createdAt: now.toISOString()
  };
  settlements.push(settlement);
  return { settlement, idempotent: false };
}

module.exports = { completeMockSettlement };
