'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminDashboardSummary } = require('../lib/admin-dashboard');

test('관리자 현황판은 개인정보 없이 운영 건수만 집계한다', () => {
  const summary = adminDashboardSummary({
    users: [{ status: 'active', piUid: 'secret' }, { status: 'suspended' }],
    products: [{ status: 'available' }, { status: 'under_review' }],
    reports: [{ status: 'received' }, { status: 'closed' }],
    disputes: [{ status: 'received' }],
    gasDebts: [{ status: 'appeal_pending' }]
  });
  assert.deepEqual(summary.users, { total: 2, active: 1, suspended: 1 });
  assert.equal(summary.products.reviewPending, 1);
  assert.equal(summary.reports.open, 1);
  assert.equal(summary.disputes.open, 1);
  assert.equal(summary.gasDebts.appealPending, 1);
  assert.equal(JSON.stringify(summary).includes('secret'), false);
});

test('빈 상태도 모든 현황 값을 0으로 제공한다', () => {
  assert.deepEqual(adminDashboardSummary({}), {
    users: { total: 0, active: 0, suspended: 0 },
    products: { total: 0, available: 0, reviewPending: 0 },
    reports: { total: 0, open: 0 },
    disputes: { total: 0, open: 0 },
    gasDebts: { total: 0, appealPending: 0 }
  });
});
