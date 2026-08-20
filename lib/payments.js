'use strict';

const { assertFinancialTradeAllowed, paymentQuote } = require('./policy');

function preparePayment(trade, payments, input, now = new Date()) {
  assertFinancialTradeAllowed(trade);
  if (trade.status !== 'payment_pending') throw Object.assign(new Error('Trade must be payment_pending'), { code: 'PAYMENT_NOT_ALLOWED' });
  const existing = payments.find((item) => item.tradeId === trade.id && !['failed', 'canceled'].includes(item.status));
  if (existing) return { payment: existing, idempotent: true };
  const quote = paymentQuote(trade.amount, input.networkFee || 0);
  return {
    payment: {
      id: input.id, tradeId: trade.id, providerPaymentId: null, txid: null,
      status: 'prepared', ...quote, createdAt: now.toISOString()
    },
    idempotent: false
  };
}

function approvePayment(payment, payments, piPaymentId, now = new Date()) {
  if (!payment || !piPaymentId) throw Object.assign(new Error('Payment and piPaymentId are required'), { code: 'PI_PAYMENT_ID_REQUIRED' });
  if (payment.providerPaymentId === piPaymentId && ['approved', 'completed'].includes(payment.status)) {
    return { payment, idempotent: true, providerRetryRequired: payment.status === 'approved' };
  }
  const duplicate = payments.find((item) => item.id !== payment.id && item.providerPaymentId === piPaymentId);
  if (duplicate) throw Object.assign(new Error('Pi payment ID is already linked'), { code: 'DUPLICATE_PI_PAYMENT' });
  if (payment.status === 'approved' && !payment.txid) {
    const replacedProviderPaymentId = payment.providerPaymentId;
    payment.providerPaymentId = piPaymentId;
    payment.approvedAt = now.toISOString();
    return { payment, idempotent: false, providerRetryRequired: true, replacedProviderPaymentId };
  }
  if (payment.status !== 'prepared') throw Object.assign(new Error('Prepared payment is required'), { code: 'PAYMENT_NOT_PREPARED' });
  payment.providerPaymentId = piPaymentId;
  payment.status = 'approved';
  payment.approvedAt = now.toISOString();
  return { payment, idempotent: false };
}

function completePayment(payment, payments, trade, txid, now = new Date()) {
  if (!payment || !trade || !txid) throw Object.assign(new Error('Approved payment, trade and txid are required'), { code: 'PAYMENT_COMPLETION_DATA_REQUIRED' });
  if (payment.status === 'completed') {
    if (payment.txid !== txid) throw Object.assign(new Error('Completed payment cannot use a different txid'), { code: 'PAYMENT_TXID_MISMATCH' });
    return { payment, trade, idempotent: true };
  }
  if (payment.status !== 'approved' || !payment.providerPaymentId) throw Object.assign(new Error('Server approval is required before completion'), { code: 'PAYMENT_NOT_APPROVED' });
  const duplicate = payments.find((item) => item.id !== payment.id && item.txid === txid);
  if (duplicate) throw Object.assign(new Error('Transaction ID is already linked'), { code: 'DUPLICATE_TXID' });
  payment.txid = txid;
  payment.status = 'completed';
  payment.completedAt = now.toISOString();
  trade.status = 'shipping_pending';
  return { payment, trade, idempotent: false };
}

function incompletePayments(payments, userTradeIds) {
  const allowed = new Set(userTradeIds);
  return payments.filter((item) => allowed.has(item.tradeId) && ['prepared', 'approved'].includes(item.status));
}

module.exports = { preparePayment, approvePayment, completePayment, incompletePayments };
