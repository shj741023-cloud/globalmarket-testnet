'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminGasDebtSummary, adminGasDebtSummaries } = require('../lib/admin-gas-debts');

test('관리자 미납 요약은 사용자 식별값과 관리자 식별값을 제외한다', () => {
  const item = adminGasDebtSummary({
    id: 'd1', userId: 'private-user', refundId: 'rf1', reason: '가스비', originalAmount: 0.03,
    outstandingAmount: 0.01, status: 'confirmed_unpaid', appealReason: '재검토',
    decision: { type: 'adjust', reason: '일부 조정', amount: 0.01, decidedBy: 'private-admin', decidedAt: '2026-08-21T00:00:00.000Z' },
    createdAt: '2026-08-20T00:00:00.000Z'
  });
  assert.equal(item.id, 'd1');
  assert.equal(item.outstandingAmount, 0.01);
  assert.equal(item.decision.type, 'adjust');
  assert.equal('userId' in item, false);
  assert.equal('decidedBy' in item.decision, false);
  assert.equal(JSON.stringify(item).includes('private-'), false);
});

test('관리자 미납 목록은 상태별로 최신순 필터링한다', () => {
  const state = { gasDebts: [{ id: 'd1', status: 'paid' }, { id: 'd2', status: 'appeal_pending' }, { id: 'd3', status: 'appeal_pending' }] };
  assert.deepEqual(adminGasDebtSummaries(state, { status: 'appeal_pending' }).map((item) => item.id), ['d3', 'd2']);
  assert.deepEqual(adminGasDebtSummaries({}, {}).map((item) => item.id), []);
});
