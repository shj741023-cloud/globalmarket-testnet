'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminDisputeSummary, adminRefundSummary, adminDisputeSummaries } = require('../lib/admin-disputes');

const state = {
  disputes: [{ id: 'd1', tradeId: 't1', applicantId: 'private-user', reason: '파손', status: 'received', settlementHold: true, createdAt: '2026-08-19T00:00:00.000Z' }],
  trades: [{ id: 't1', productId: 'p1', buyerId: 'private-buyer', sellerId: 'private-seller', amount: 25, method: 'parcel_testnet' }],
  products: [{ id: 'p1', title: '중고 카메라' }]
};

test('관리자 분쟁 요약은 거래 당사자 식별값을 제외한다', () => {
  const [item] = adminDisputeSummaries(state);
  assert.equal(item.productTitle, '중고 카메라');
  assert.equal(item.amount, 25);
  assert.equal(item.applicantId, undefined);
  assert.equal(JSON.stringify(item).includes('private-'), false);
});

test('관리자 분쟁 요약은 상태 필터를 적용한다', () => {
  assert.equal(adminDisputeSummaries(state, { status: 'received' }).length, 1);
  assert.equal(adminDisputeSummaries(state, { status: 'closed' }).length, 0);
});

test('판정 응답용 분쟁과 환불 요약도 거래 당사자 식별값을 제외한다', () => {
  const dispute = adminDisputeSummary(state, state.disputes[0]);
  const refund = adminRefundSummary({ id: 'rf1', tradeId: 't1', disputeId: 'd1', type: 'full', originalAmount: 25, totalBuyerRefund: 25, isSimulation: true, status: 'mock_completed' });
  assert.equal(dispute.applicantId, undefined);
  assert.equal(refund.tradeId, undefined);
  assert.equal(refund.disputeId, undefined);
  assert.equal(refund.isSimulation, true);
});
