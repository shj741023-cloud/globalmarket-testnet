'use strict';

const { normalizeWalletAddress, walletAddressFingerprint } = require('./wallets');

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

function getConfirmedDirectWalletAddress(product, agreement) {
  if (!product?.directWalletAddress || agreement?.type !== 'direct') return null;
  if (!agreement.buyerConfirmedAt || !agreement.sellerConfirmedAt) return null;
  return product.directWalletAddress;
}

function assertDirectWalletChangeAllowed(product, walletAddress, agreement) {
  const nextAddress = normalizeWalletAddress(walletAddress, { required: true });
  if (!product?.directWalletAddress || product.directWalletAddress === nextAddress) return nextAddress;
  if (agreement?.buyerConfirmedAt || agreement?.sellerConfirmedAt) {
    throw Object.assign(new Error('Wallet address cannot change after either party confirms the agreement'), { code: 'WALLET_ADDRESS_LOCKED' });
  }
  return nextAddress;
}

function assertDirectWalletReady(product, tradeType) {
  if (tradeType === 'direct' && !product?.directWalletAddress) {
    throw Object.assign(new Error('Seller must register a wallet address before a direct-trade agreement'), { code: 'DIRECT_WALLET_REQUIRED' });
  }
}

function assertDirectWalletRegistrationStage(agreement) {
  if (agreement?.type !== 'direct' || !agreement.buyerConfirmedAt || !agreement.sellerConfirmedAt) {
    throw Object.assign(new Error('Both parties must confirm direct-trade terms before wallet registration'), { code: 'DIRECT_AGREEMENT_REQUIRED' });
  }
}

function confirmDirectWalletForStart(agreement, product, userId, input, now = new Date()) {
  if (agreement?.type !== 'direct') return agreement;
  if (agreement.buyerId !== userId) throw Object.assign(new Error('Only the buyer can confirm the direct-trade wallet'), { code: 'DIRECT_BUYER_REQUIRED' });
  const currentAddress = normalizeWalletAddress(product?.directWalletAddress, { required: true });
  const viewedAddress = normalizeWalletAddress(input?.walletAddress, { required: true });
  if (input?.walletAddressConfirmed !== true || viewedAddress !== currentAddress) {
    throw Object.assign(new Error('Buyer must confirm the currently registered wallet address'), { code: 'DIRECT_WALLET_CONFIRMATION_REQUIRED' });
  }
  const fingerprint = walletAddressFingerprint(currentAddress);
  agreement.confirmedWalletAddressHash = fingerprint.hash;
  agreement.confirmedWalletAddressSuffix = fingerprint.suffix;
  agreement.walletAddressConfirmedAt = now.toISOString();
  return agreement;
}

module.exports = { enableChatDirectTrade, getConfirmedDirectWalletAddress, assertDirectWalletChangeAllowed, assertDirectWalletReady, assertDirectWalletRegistrationStage, confirmDirectWalletForStart };
