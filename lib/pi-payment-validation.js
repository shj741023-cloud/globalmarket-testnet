'use strict';

function paymentError(message, code = 'PI_PAYMENT_VERIFICATION_FAILED') {
  return Object.assign(new Error(message), { code, status: 409 });
}

function sameAmount(left, right) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) < 1e-9;
}

function assertProviderPayment(provider, expected, stage) {
  if (!provider || typeof provider !== 'object') throw paymentError('Pi payment response is missing');
  if (provider.identifier !== expected.providerPaymentId) throw paymentError('Pi payment identifier does not match');
  if (provider.user_uid !== expected.piUid) throw paymentError('Pi payment user does not match');
  if (!sameAmount(provider.amount, expected.amount)) throw paymentError('Pi payment amount does not match');
  if (provider.direction !== 'user_to_app') throw paymentError('Pi payment direction is not user_to_app');
  if (provider.network !== 'Pi Testnet') throw paymentError('Pi payment is not on Pi Testnet');
  if (provider.metadata?.internalPaymentId !== expected.internalPaymentId || provider.metadata?.tradeId !== expected.tradeId) {
    throw paymentError('Pi payment metadata does not match the internal trade');
  }
  if (provider.status?.cancelled || provider.status?.user_cancelled) throw paymentError('Pi payment was cancelled');
  if (provider.status?.developer_approved !== true) throw paymentError('Pi payment was not approved by the server');
  if (stage === 'complete') {
    if (provider.status?.transaction_verified !== true || provider.transaction?.verified !== true) throw paymentError('Pi transaction is not verified');
    if (provider.status?.developer_completed !== true) throw paymentError('Pi payment was not completed by the server');
    if (provider.transaction?.txid !== expected.txid) throw paymentError('Pi transaction ID does not match');
  }
  return provider;
}

module.exports = { sameAmount, assertProviderPayment };
