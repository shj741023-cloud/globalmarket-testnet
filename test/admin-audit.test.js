'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminAuditSummaries } = require('../lib/admin-audit');

const state = { auditLogs: [
  { id: 'a1', adminId: 'admin', action: 'USER_STATUS_CHANGED', targetType: 'user', targetId: 'u1', reason: '시험', before: { piUid: 'secret', sessions: [{ token: 'secret' }] }, after: { status: 'suspended' }, createdAt: '2026-08-18T00:00:00.000Z' },
  { id: 'a2', adminId: 'admin', action: 'REPORT_DECIDED', targetType: 'report', targetId: 'r1', reason: '위반 없음', before: { reporterId: 'u2' }, createdAt: '2026-08-19T00:00:00.000Z' }
] };

test('관리자 작업기록은 민감한 변경 전후 원문을 제외한다', () => {
  const [item] = adminAuditSummaries(state, { action: 'user_status_changed' });
  assert.equal(item.id, 'a1');
  assert.equal(item.reason, '시험');
  assert.equal(item.before, undefined);
  assert.equal(item.after, undefined);
  assert.equal(JSON.stringify(item).includes('secret'), false);
});

test('관리자 작업기록을 대상 종류로 필터링하고 최신순으로 제공한다', () => {
  assert.deepEqual(adminAuditSummaries(state).map((item) => item.id), ['a2', 'a1']);
  assert.deepEqual(adminAuditSummaries(state, { targetType: 'report' }).map((item) => item.id), ['a2']);
});
