'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { refundQuote } = require('../lib/refunds');
const { calculateGasLiability } = require('../lib/refund-liability');

test('판매자 과실 전액환불은 판매자가 가스비를 부담하고 구매자 최초 가스비를 보전한다', () => {
  const result = calculateGasLiability(refundQuote(1, 0), 'seller_fault');
  assert.equal(result.buyerGasLiability, 0);
  assert.equal(result.sellerGasLiability, 0.02);
  assert.equal(result.buyerOriginalGasReimbursement, 0.01);
  assert.equal(result.buyerFinalRefund, 1.02);
});

test('구매자 과실 부분환불은 구매자가 세 건의 가스비를 부담한다', () => {
  const result = calculateGasLiability(refundQuote(1, 0.5), 'buyer_fault');
  assert.equal(result.buyerGasLiability, 0.03);
  assert.equal(result.buyerFutureGasCharge, 0.02);
  assert.equal(result.buyerFinalRefund, 0.485);
  assert.equal(result.sellerFinalSettlement, 0.495);
});

test('공동 과실은 가스비를 절반씩 나눈다', () => {
  const result = calculateGasLiability(refundQuote(1, 0.5), 'shared_fault');
  assert.equal(result.buyerGasLiability, 0.015);
  assert.equal(result.sellerGasLiability, 0.015);
});

test('과실 판정이 없으면 계산을 차단한다', () => {
  assert.throws(() => calculateGasLiability(refundQuote(1, 0), ''), /fault decision/i);
});
