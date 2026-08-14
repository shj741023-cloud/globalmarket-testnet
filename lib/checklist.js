'use strict';

function checklistTrade(trades, buyerId, input, now = new Date()) {
  const existing = trades.find((item) => item.buyerId === buyerId && item.purpose === 'pi_checklist' && !['completed', 'cancelled', 'refunded'].includes(item.status));
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

module.exports = { checklistTrade };
