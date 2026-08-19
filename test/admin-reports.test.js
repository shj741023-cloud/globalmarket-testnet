'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminReportSummary, adminReportSummaries } = require('../lib/admin-reports');

const report = { id: 'r1', reporterId: 'private-reporter', targetType: 'product', targetId: 'p1', reason: '확인 요청', status: 'received', createdAt: '2026-08-19T00:00:00.000Z' };

test('관리자 신고 요약은 신고자 식별값을 제외한다', () => {
  const item = adminReportSummary(report);
  assert.equal(item.id, 'r1');
  assert.equal(item.reporterId, undefined);
  assert.equal(JSON.stringify(item).includes('private-reporter'), false);
});

test('관리자 신고 목록은 상태 필터를 적용한다', () => {
  const state = { reports: [report, { ...report, id: 'r2', status: 'closed', createdAt: '2026-08-20T00:00:00.000Z' }] };
  assert.deepEqual(adminReportSummaries(state).map((item) => item.id), ['r2', 'r1']);
  assert.deepEqual(adminReportSummaries(state, { status: 'received' }).map((item) => item.id), ['r1']);
});
