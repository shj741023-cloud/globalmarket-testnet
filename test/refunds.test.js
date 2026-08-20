'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { refundQuote, decideDispute, createMockRefund } = require('../lib/refunds');

test('전액 환불은 구매자 수수료를 반환하고 판매자 수수료를 부과하지 않는다', () => {
  const quote = refundQuote(100, 0, 0.01);
  assert.equal(quote.type, 'full');
  assert.equal(quote.productRefundAmount, 100);
  assert.equal(quote.buyerFeeRefund, 1);
  assert.equal(quote.sellerFinalFee, 0);
  assert.equal(quote.unrecoverableNetworkFee, 0.01);
  assert.equal(quote.originalPaymentGasFee, 0.01);
  assert.equal(quote.refundTransferGasFee, 0.01);
  assert.equal(quote.settlementTransferGasFee, 0);
  assert.equal(quote.estimatedLifecycleGasFee, 0.02);
});

test('부분 환불은 구매자가 보유하는 금액 기준으로 양쪽 수수료를 재계산한다', () => {
  const quote = refundQuote(100, 60, 0);
  assert.equal(quote.type, 'partial');
  assert.equal(quote.productRefundAmount, 40);
  assert.equal(quote.buyerFinalFee, 0.6);
  assert.equal(quote.sellerFinalFee, 0.6);
  assert.equal(quote.buyerFeeRefund, 0.4);
  assert.equal(quote.refundTransferGasFee, 0.01);
  assert.equal(quote.settlementTransferGasFee, 0.01);
  assert.equal(quote.estimatedLifecycleGasFee, 0.03);
});

test('보유금액이 원거래금액을 넘으면 차단한다', () => {
  assert.throws(() => refundQuote(100, 101), /between zero and originalAmount/);
});

test('전액 환불 판정은 보류를 해제하고 모의환불 상태로 바꾼다', () => {
  const trade = { id: 't1', type: 'parcel_testnet', amount: 100, status: 'disputed', settlementHold: true };
  const dispute = { id: 'd1', tradeId: 't1', status: 'received', settlementHold: true };
  const result = decideDispute(trade, dispute, { type: 'full_refund', reason: '반품 확인' });
  assert.equal(trade.status, 'mock_refunded');
  assert.equal(trade.settlementHold, false);
  assert.equal(dispute.status, 'closed');
  assert.equal(result.quote.totalBuyerRefund, 101);
});

test('판매자 책임 없음 판정은 이전 거래상태로 복구한다', () => {
  const trade = { id: 't1', type: 'parcel_testnet', amount: 100, status: 'disputed', statusBeforeDispute: 'delivered', settlementHold: true };
  const dispute = { id: 'd1', tradeId: 't1', status: 'received', settlementHold: true };
  decideDispute(trade, dispute, { type: 'release_settlement', reason: '증빙 불충분' });
  assert.equal(trade.status, 'delivered');
  assert.equal(trade.settlementHold, false);
});

test('종료된 분쟁을 다시 판정하지 않는다', () => {
  const trade = { id: 't1', type: 'parcel_testnet', amount: 100 };
  const dispute = { id: 'd1', tradeId: 't1', status: 'closed' };
  assert.throws(() => decideDispute(trade, dispute, { type: 'full_refund' }), /open dispute/);
});

test('전액 모의환불 기록에는 구매자 수수료 환불을 포함한다', () => {
  const trade = { id: 't1', type: 'parcel_testnet', amount: 0.01, status: 'disputed', settlementHold: true };
  const dispute = { id: 'd1', tradeId: 't1', status: 'received', settlementHold: true };
  const result = createMockRefund(trade, dispute, { type: 'full_refund', reason: '시험' }, 'r1', new Date('2026-08-20T00:00:00Z'));
  assert.equal(result.refund.totalBuyerRefund, 0.0101);
  assert.equal(result.refund.status, 'mock_completed');
});

test('절반 부분환불은 남은 금액과 환불액을 정확히 기록한다', () => {
  const trade = { id: 't1', type: 'parcel_testnet', amount: 0.01, status: 'disputed', settlementHold: true };
  const dispute = { id: 'd1', tradeId: 't1', status: 'received', settlementHold: true };
  const result = createMockRefund(trade, dispute, { type: 'partial_refund', retainedAmount: 0.005, reason: '시험' }, 'r1');
  assert.equal(result.refund.retainedAmount, 0.005);
  assert.equal(result.refund.totalBuyerRefund, 0.00505);
  assert.equal(trade.status, 'purchase_confirmed');
});
