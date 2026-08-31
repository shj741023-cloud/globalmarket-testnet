'use strict';

const { normalizeWalletAddress } = require('./wallets');

function enableChatDirectTrade(product, room, userId, walletAddress, existingTrade, now = new Date()) {
  if (!product || !room || room.sellerId !== userId || product.sellerId !== userId) {
    throw Object.assign(new Error('Only the seller can register the direct-trade wallet'), { code: 'SELLER_REQUIRED' });
  }
  if (existingTrade) throw Object.assign(new Error('Trade method cannot change after trade creation'), { code: 'TRADE_METHOD_LOCKED' });
  product.directWalletAddress = normalizeWalletAddress(walletAddress, { required: true });
  if (!product.methods.includes('direct')) product.methods.push('direct');
  product.updatedAt = now.toISOString();
  return product;
}

module.exports = { enableChatDirectTrade };
