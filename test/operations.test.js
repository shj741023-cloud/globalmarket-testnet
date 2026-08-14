'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addBusinessDays, caseDeadlines, createReport, assignCase, decideCase, auditEntry } = require('../lib/operations');

test('영업일 계산은 주말을 제외한다', () => {
  const friday = new Date('2026-08-14T00:00:00Z');
  assert.equal(addBusinessDays(friday, 1).toISOString(), '2026-08-17T00:00:00.000Z');
});

test('접수 24시간·1차 3영업일·일반 7영업일 목표를 계산한다', () => {
  const start = new Date('2026-08-14T00:00:00Z');
  const due = caseDeadlines(start, 'normal');
  assert.equal(due.receiptDueAt, '2026-08-15T00:00:00.000Z');
  assert.equal(due.firstReviewDueAt, '2026-08-19T00:00:00.000Z');
  assert.equal(due.resolutionDueAt, '2026-08-25T00:00:00.000Z');
});

test('복잡 사건은 14영업일 목표를 사용한다', () => {
  const due = caseDeadlines(new Date('2026-08-14T00:00:00Z'), 'complex');
  assert.equal(due.resolutionDueAt, '2026-09-03T00:00:00.000Z');
});

test('신고 접수는 신뢰점수 변경을 포함하지 않는다', () => {
  const report = createReport({ id: 'r1', reporterId: 'u1', targetType: 'user', targetId: 'u2', reason: '확인 요청' });
  assert.equal(report.status, 'received');
  assert.equal(Object.hasOwn(report, 'scoreChange'), false);
});

test('담당자 배정 전에는 판정할 수 없다', () => {
  const report = createReport({ id: 'r1', reporterId: 'u1', targetType: 'user', targetId: 'u2', reason: '확인 요청' });
  assert.throws(() => decideCase(report, { type: 'no_violation', reason: '확인', adminId: 'a1' }), /assignment/);
});

test('배정과 판정 상태를 기록한다', () => {
  const report = createReport({ id: 'r1', reporterId: 'u1', targetType: 'user', targetId: 'u2', reason: '확인 요청' });
  assignCase(report, 'a1');
  decideCase(report, { type: 'no_violation', reason: '위반 없음', adminId: 'a1' });
  assert.equal(report.status, 'closed');
  assert.equal(report.decision.decidedBy, 'a1');
});

test('감사로그에는 관리자·행동·대상·사유가 필수다', () => {
  const entry = auditEntry({ id: 'l1', adminId: 'a1', action: 'REPORT_DECIDED', targetType: 'report', targetId: 'r1', reason: '위반 없음' });
  assert.equal(entry.adminId, 'a1');
  assert.throws(() => auditEntry({ id: 'l2', adminId: 'a1', action: 'X', targetId: 'r1' }), /requires/);
});
