'use strict';

function reserveProduct(product, now = new Date()) {
  if (!product || product.status !== 'available') throw Object.assign(new Error('Product is not available'), { code: 'PRODUCT_NOT_AVAILABLE', status: 409 });
  product.status = 'reserved';
  product.updatedAt = now.toISOString();
  return product;
}

function releaseProduct(product, now = new Date()) {
  if (product?.status === 'reserved') {
    product.status = 'available';
    product.updatedAt = now.toISOString();
  }
  return product;
}

function sellProduct(product, now = new Date()) {
  if (product && product.status !== 'deleted') {
    product.status = 'sold';
    product.updatedAt = now.toISOString();
  }
  return product;
}

function cancelPendingParcelTrade(trade, userId, reason, now = new Date()) {
  if (!trade || trade.type !== 'parcel_testnet') throw Object.assign(new Error('Parcel Testnet trade is required'), { code: 'PARCEL_TRADE_REQUIRED', status: 409 });
  if (![trade.buyerId, trade.sellerId].includes(userId)) throw Object.assign(new Error('Trade party required'), { code: 'TRADE_PARTY_REQUIRED', status: 403 });
  if (trade.status === 'cancelled') return { trade, idempotent: true };
  if (trade.status !== 'payment_pending') throw Object.assign(new Error('Only an unpaid trade can be cancelled'), { code: 'TRADE_CANCEL_NOT_ALLOWED', status: 409 });
  trade.status = 'cancelled';
  trade.cancelledAt = now.toISOString();
  trade.cancelledBy = userId;
  trade.cancelReason = String(reason || '').trim().slice(0, 500);
  return { trade, idempotent: false };
}

module.exports = { reserveProduct, releaseProduct, sellProduct, cancelPendingParcelTrade };
