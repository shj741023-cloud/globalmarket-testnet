'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockRefund } = require('../lib/refunds');

test('부분환불 분쟁은 각자 가스비 부담으로 끝나며 미납·보상을 만들지 않는다', () => {
  const trade = { id:'trade1', buyerId:'buyer1', sellerId:'seller1', type:'parcel_testnet', amount:0.01, status:'disputed', statusBeforeDispute:'delivered', settlementHold:true };
  const dispute = { id:'dispute1', tradeId:trade.id, status:'received', settlementHold:true };
  const { refund } = createMockRefund(trade, dispute, { type:'partial_refund', retainedAmount:0.005, faultType:'seller_fault', reason:'판매자 과실' }, 'refund1', new Date('2026-08-20T00:00:00Z'));
  assert.equal(refund.totalBuyerRefund, 0.00505);
  assert.equal(refund.gasLiability.gasPolicy, 'each_party_bears_own_fee');
  assert.equal(refund.gasLiability.buyerGasCompensationClaim, 0);
  assert.equal(refund.gasLiability.sellerOutstandingGas, 0);
  assert.equal(refund.gasLiability.buyerFinalRefund, 0);
  assert.equal(refund.gasLiability.sellerFinalSettlement, 0);
});
