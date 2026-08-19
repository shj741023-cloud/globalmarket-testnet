'use strict';

const { sanitizeAuditSnapshot } = require('./audit-sanitize');

function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

function caseDeadlines(createdAt, complexity = 'normal') {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) throw Object.assign(new Error('Valid createdAt is required'), { code: 'INVALID_CASE_DATE' });
  return {
    receiptDueAt: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    firstReviewDueAt: addBusinessDays(start, 3).toISOString(),
    resolutionDueAt: addBusinessDays(start, complexity === 'complex' ? 14 : 7).toISOString(),
    evidenceDueAt: addBusinessDays(start, 3).toISOString()
  };
}

function createReport(input, now = new Date()) {
  if (!input.reporterId || !input.targetType || !input.targetId || !String(input.reason || '').trim()) {
    throw Object.assign(new Error('reporter, target and reason are required'), { code: 'INVALID_REPORT' });
  }
  return {
    id: input.id, reporterId: input.reporterId, targetType: input.targetType,
    targetId: input.targetId, reason: String(input.reason).trim().slice(0, 1000),
    status: 'received', assignedAdminId: null, createdAt: now.toISOString(),
    ...caseDeadlines(now, input.complexity)
  };
}

function assignCase(item, adminId, now = new Date()) {
  if (!item || !adminId) throw Object.assign(new Error('case and admin are required'), { code: 'ASSIGNMENT_DATA_REQUIRED' });
  if (item.status === 'closed') throw Object.assign(new Error('Closed case cannot be assigned'), { code: 'CASE_CLOSED' });
  const idempotent = item.assignedAdminId === adminId;
  item.assignedAdminId = adminId;
  item.status = 'reviewing';
  item.assignedAt ||= now.toISOString();
  return { item, idempotent };
}

function decideCase(item, input, now = new Date()) {
  if (!item || item.status === 'closed') return { item, idempotent: true };
  if (!item.assignedAdminId) throw Object.assign(new Error('Case assignment is required before decision'), { code: 'CASE_ASSIGNMENT_REQUIRED' });
  if (!String(input.reason || '').trim() || !['violation_confirmed', 'no_violation', 'insufficient_evidence'].includes(input.type)) {
    throw Object.assign(new Error('Valid decision type and reason are required'), { code: 'INVALID_CASE_DECISION' });
  }
  item.status = 'closed';
  item.decision = { type: input.type, reason: String(input.reason).trim().slice(0, 2000), decidedBy: input.adminId, decidedAt: now.toISOString() };
  item.resolvedAt = now.toISOString();
  return { item, idempotent: false };
}

function auditEntry(input, now = new Date()) {
  if (!input.adminId || !input.action || !input.targetId || !input.reason) {
    throw Object.assign(new Error('Audit entry requires admin, action, target and reason'), { code: 'INVALID_AUDIT_ENTRY' });
  }
  return {
    id: input.id, adminId: input.adminId, action: input.action,
    targetType: input.targetType, targetId: input.targetId,
    reason: String(input.reason).slice(0, 2000),
    before: sanitizeAuditSnapshot(input.before), after: sanitizeAuditSnapshot(input.after),
    createdAt: now.toISOString()
  };
}

module.exports = { addBusinessDays, caseDeadlines, createReport, assignCase, decideCase, auditEntry };
