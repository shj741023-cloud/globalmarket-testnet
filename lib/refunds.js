'use strict';

const { paymentQuote } = require('./policy');

function roundPi(value) {
  return Math.round((value + Number.EPSILON) * 10000000) / 10000000;
}

function refundQuote(originalAmount, retainedAmount = 0, networkFee = 0) {
  const original = Number(originalAmount);
  const retained = Number(retainedAmount);
  const network = Number(networkFee || 0);
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(retained) || retained < 0 || retained > original) {
    const error = new Error('retainedAmount must be between zero and originalAmount');
    error.code = 'INVALID_REFUND_AMOUNT';
    throw error;
  }
  const originalFees = paymentQuote(original, network);
  const retainedFees = retained === 0
    ? { buyerFee: 0, sellerFee: 0 }
    : paymentQuote(retained, 0);
  return {
    network: 'testnet',
    asset: 'test-pi',
    isSimulation: true,
    type: retained === 0 ? 'full' : 'partial',
    originalAmount: roundPi(original),
    retainedAmount: roundPi(retained),
    productRefundAmount: roundPi(original - retained),
    originalBuyerFee: originalFees.buyerFee,
    buyerFinalFee: retainedFees.buyerFee,
    buyerFeeRefund: roundPi(originalFees.buyerFee - retainedFees.buyerFee),
    sellerFinalFee: retainedFees.sellerFee,
    networkFeeRefund: 0,
    unrecoverableNetworkFee: roundPi(network),
    totalBuyerRefund: roundPi(original - retained + originalFees.buyerFee - retainedFees.buyerFee)
  };
}

function decideDispute(trade, dispute, input, now = new Date()) {
  if (!trade || !dispute || dispute.tradeId !== trade.id || dispute.status === 'closed') {
    const error = new Error('An open dispute is required.');
    error.code = 'OPEN_DISPUTE_REQUIRED';
    throw error;
  }
  const allowed = ['full_refund', 'partial_refund', 'release_settlement'];
  if (!allowed.includes(input.type)) {
    const error = new Error('Unsupported dispute decision.');
    error.code = 'INVALID_DECISION';
    throw error;
  }
  let quote = null;
  if (input.type === 'full_refund') quote = refundQuote(trade.amount, 0, input.networkFee || 0);
  if (input.type === 'partial_refund') quote = refundQuote(trade.amount, input.retainedAmount, input.networkFee || 0);
  dispute.status = 'closed';
  dispute.settlementHold = false;
  dispute.decision = {
    type: input.type,
    reason: String(input.reason || '').slice(0, 2000),
    retainedAmount: quote?.retainedAmount ?? trade.amount,
    decidedAt: now.toISOString()
  };
  trade.settlementHold = false;
  if (input.type === 'full_refund') trade.status = 'mock_refunded';
  if (input.type === 'partial_refund') trade.status = 'purchase_confirmed';
  if (input.type === 'release_settlement') trade.status = trade.statusBeforeDispute || 'delivered';
  return { quote, decision: dispute.decision };
}

function createMockRefund(trade, dispute, input, id, now = new Date()) {
  const result = decideDispute(trade, dispute, input, now);
  if (!result.quote) return { ...result, refund: null };
  return {
    ...result,
    refund: {
      id, tradeId: trade.id, disputeId: dispute.id,
      network: 'testnet', asset: 'test-pi', isSimulation: true,
      ...result.quote, status: 'mock_completed', externalRefundId: null,
      completedAt: now.toISOString()
    }
  };
}

module.exports = { refundQuote, decideDispute, createMockRefund };
