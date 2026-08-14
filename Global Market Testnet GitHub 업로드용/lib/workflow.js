'use strict';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function requireParcelTrade(trade) {
  if (!trade || trade.type !== 'parcel_testnet') {
    const error = new Error('This operation is available only for Testnet parcel trades.');
    error.code = 'PARCEL_TRADE_REQUIRED';
    throw error;
  }
}

function registerShipment(trade, input, now = new Date()) {
  requireParcelTrade(trade);
  if (trade.status !== 'shipping_pending') {
    const error = new Error('Payment completion is required before shipment.');
    error.code = 'PAYMENT_NOT_COMPLETED';
    throw error;
  }
  if (!input.carrier || !input.trackingNumber) {
    const error = new Error('carrier and trackingNumber are required');
    error.code = 'SHIPMENT_DATA_REQUIRED';
    throw error;
  }
  trade.status = 'shipping';
  return {
    id: input.id,
    tradeId: trade.id,
    carrier: String(input.carrier).slice(0, 40),
    trackingNumber: String(input.trackingNumber).slice(0, 80),
    status: 'shipping',
    shippedAt: now.toISOString(),
    deliveredAt: null,
    autoConfirmAt: null
  };
}

function markDelivered(trade, shipment, now = new Date()) {
  requireParcelTrade(trade);
  if (!shipment || shipment.tradeId !== trade.id || shipment.status !== 'shipping') {
    const error = new Error('An active shipment is required.');
    error.code = 'ACTIVE_SHIPMENT_REQUIRED';
    throw error;
  }
  trade.status = 'delivered';
  shipment.status = 'delivered';
  shipment.deliveredAt = now.toISOString();
  shipment.autoConfirmAt = new Date(now.getTime() + THREE_DAYS_MS).toISOString();
  return shipment;
}

function openDispute(trade, input, now = new Date()) {
  requireParcelTrade(trade);
  if (['completed', 'canceled'].includes(trade.status)) {
    const error = new Error('A dispute cannot be opened for this trade state.');
    error.code = 'DISPUTE_NOT_ALLOWED';
    throw error;
  }
  trade.settlementHold = true;
  trade.statusBeforeDispute = trade.status;
  trade.status = 'disputed';
  return {
    id: input.id,
    tradeId: trade.id,
    applicantId: input.applicantId,
    reason: String(input.reason || '').slice(0, 1000),
    status: 'received',
    settlementHold: true,
    createdAt: now.toISOString()
  };
}

function confirmPurchase(trade, now = new Date(), mode = 'buyer') {
  requireParcelTrade(trade);
  if (trade.settlementHold || trade.status === 'disputed') {
    const error = new Error('Purchase confirmation is blocked by a dispute.');
    error.code = 'PURCHASE_CONFIRMATION_HELD';
    throw error;
  }
  if (trade.status === 'purchase_confirmed') return { trade, idempotent: true };
  if (trade.status !== 'delivered') {
    const error = new Error('Delivered status is required.');
    error.code = 'DELIVERY_NOT_COMPLETED';
    throw error;
  }
  trade.status = 'purchase_confirmed';
  trade.purchaseConfirmedAt = now.toISOString();
  trade.purchaseConfirmationMode = mode;
  return { trade, idempotent: false };
}

function autoConfirmDue(trade, shipment, now = new Date()) {
  requireParcelTrade(trade);
  if (trade.settlementHold || trade.status !== 'delivered' || !shipment?.autoConfirmAt) return false;
  return new Date(shipment.autoConfirmAt).getTime() <= now.getTime();
}

module.exports = {
  THREE_DAYS_MS,
  registerShipment,
  markDelivered,
  openDispute,
  confirmPurchase,
  autoConfirmDue
};
