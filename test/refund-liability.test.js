'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { refundQuote } = require('../lib/refunds');
const { calculateGasLiability } = require('../lib/refund-liability');

test('전액환불은 과실과 관계없이 구매자가 자신의 결제·환불 가스비를 부담한다', () => {
  const result = calculateGasLiability(refundQuote(1, 0), 'seller_fault');
  assert.equal(result.buyerGasLiability, 0.02);
  assert.equal(result.sellerGasLiability, 0);
  assert.equal(result.buyerOriginalGasReimbursement, 0);
  assert.equal(result.buyerBaseRefund, 1);
  assert.equal(result.buyerGasCompensationClaim, 0);
  assert.equal(result.buyerGasCompensationPaid, 0);
  assert.equal(result.gasCompensationStatus, 'waived_by_policy');
  assert.equal(result.buyerFinalRefund, 1);
  assert.equal(result.buyerPotentialTotalAfterGasCompensation, 1);
});

test('부분환불은 구매자와 판매자가 각자 수령 송금 가스비를 부담한다', () => {
  const result = calculateGasLiability(refundQuote(1, 0.5), 'buyer_fault');
  assert.equal(result.buyerGasLiability, 0.02);
  assert.equal(result.sellerGasLiability, 0.01);
  assert.equal(result.buyerFutureGasCharge, 0.01);
  assert.equal(result.buyerFinalRefund, 0.495);
  assert.equal(result.buyerGasCompensationClaim, 0);
  assert.equal(result.gasCompensationStatus, 'waived_by_policy');
  assert.equal(result.sellerFinalSettlement, 0.485);
  assert.equal(result.sellerOutstandingGas, 0);
});

test('과실 유형이 달라도 가스비 상호 보상은 생기지 않는다', () => {
  const seller = calculateGasLiability(refundQuote(1, 0.5), 'seller_fault');
  const shared = calculateGasLiability(refundQuote(1, 0.5), 'shared_fault');
  assert.equal(shared.buyerGasLiability, seller.buyerGasLiability);
  assert.equal(shared.sellerGasLiability, seller.sellerGasLiability);
  assert.equal(shared.buyerGasCompensationClaim, 0);
});

test('과실 판정이 없으면 계산을 차단한다', () => {
  assert.throws(() => calculateGasLiability(refundQuote(1, 0), ''), /fault decision/i);
});
