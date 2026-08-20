'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockRefund } = require('../lib/refunds');
const { createGasDebt, appealGasDebt, decideGasDebtAppeal, assertTradingAllowed } = require('../lib/trading-restrictions');
const { offsetDebts } = require('../lib/debt-offset');
const { createCompensation, confirmCompensation } = require('../lib/gas-compensation');
const { createMockPayoutBatch } = require('../lib/compensation-payouts');

test('부분환불 분쟁부터 미납 회수·소비자 보상·거래제한 해제까지 연결된다', () => {
  const trade = { id:'trade1', buyerId:'buyer1', sellerId:'seller1', type:'parcel_testnet', amount:0.01, status:'disputed', statusBeforeDispute:'delivered', settlementHold:true };
  const dispute = { id:'dispute1', tradeId:trade.id, status:'received', settlementHold:true };
  const { refund } = createMockRefund(trade, dispute, { type:'partial_refund', retainedAmount:0.005, faultType:'seller_fault', reason:'판매자 과실' }, 'refund1', new Date('2026-08-20T00:00:00Z'));
  assert.equal(refund.totalBuyerRefund, 0.00505);
  assert.equal(refund.gasLiability.buyerGasCompensationClaim, 0.01);
  assert.equal(refund.gasLiability.sellerOutstandingGas, 0.02505);

  const debt = createGasDebt({ id:'debt1', userId:trade.sellerId, refundId:refund.id, amount:refund.gasLiability.sellerOutstandingGas }, new Date('2026-08-20T00:01:00Z'));
  appealGasDebt(debt, trade.sellerId, '재검토 요청', new Date('2026-08-21T00:00:00Z'));
  decideGasDebtAppeal(debt, { type:'uphold', reason:'판매자 과실 유지', adminId:'admin1' }, new Date('2026-08-21T01:00:00Z'));
  assert.throws(() => assertTradingAllowed([debt], trade.sellerId, new Date('2026-08-21T01:01:00Z')), e => e.code === 'TRADING_BLOCKED_BY_DEBT');

  const offset = offsetDebts([debt], trade.sellerId, 0.03, new Date('2026-08-22T00:00:00Z'));
  assert.equal(offset.offsetAmount, 0.02505);
  assert.equal(offset.sellerNetAmount, 0.00495);
  assert.equal(debt.status, 'paid');
  assert.doesNotThrow(() => assertTradingAllowed([debt], trade.sellerId, new Date('2026-08-22T00:01:00Z')));

  const compensation = createCompensation({ id:'comp1', buyerId:trade.buyerId, refundId:refund.id, debtId:debt.id, confirmedAmount:refund.gasLiability.buyerGasCompensationClaim, recoveredAmount:offset.offsetAmount });
  assert.equal(compensation.currentlyPayableAmount, 0.01);
  confirmCompensation(compensation, trade.buyerId);
  const { batch } = createMockPayoutBatch([compensation], { id:'payout1', adminId:'admin1' });
  assert.equal(batch.totalAmount, 0.01);
  assert.equal(batch.platformGasFee, 0.01);
  assert.equal(compensation.status, 'mock_paid');
});
