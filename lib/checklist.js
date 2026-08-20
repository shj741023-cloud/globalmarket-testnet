'use strict';

function checklistTrade(trades, buyerId, input, now = new Date()) {
  const existing = trades.find((item) => item.buyerId === buyerId && item.purpose === 'pi_checklist' && !['purchase_confirmed', 'completed', 'cancelled', 'refunded', 'mock_refunded'].includes(item.status));
  if (existing) return { trade: existing, idempotent: true };
  const trade = {
    id: input.id,
    productId: null,
    sellerId: 'testnet_checklist_harness',
    buyerId,
    type: 'parcel_testnet',
    amount: 0.01,
    status: 'payment_pending',
    purpose: 'pi_checklist',
    settlementHold: false,
    createdAt: now.toISOString()
  };
  return { trade, idempotent: false };
}

function assertChecklistBuyer(trade, userId) {
  if (!trade || trade.purpose !== 'pi_checklist' || trade.type !== 'parcel_testnet') {
    throw Object.assign(new Error('Pi checklist trade is required'), { code: 'CHECKLIST_TRADE_REQUIRED' });
  }
  if (trade.buyerId !== userId) {
    throw Object.assign(new Error('Only the checklist buyer can run this simulation'), { code: 'CHECKLIST_BUYER_REQUIRED' });
  }
  return true;
}

module.exports = { checklistTrade, assertChecklistBuyer };
