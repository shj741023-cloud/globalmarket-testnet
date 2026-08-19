'use strict';

function adminReportSummary(item) {
  return {
    id: item.id,
    targetType: item.targetType,
    targetId: item.targetId,
    reason: item.reason,
    status: item.status,
    assignedAdminId: item.assignedAdminId || null,
    createdAt: item.createdAt,
    assignedAt: item.assignedAt || null,
    receiptDueAt: item.receiptDueAt || null,
    firstReviewDueAt: item.firstReviewDueAt || null,
    resolutionDueAt: item.resolutionDueAt || null,
    decision: item.decision || null,
    resolvedAt: item.resolvedAt || null
  };
}

function adminReportSummaries(state, query = {}) {
  const status = String(query.status || '').trim().toLowerCase();
  return (state.reports || [])
    .filter((item) => !status || item.status === status)
    .map(adminReportSummary)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { adminReportSummary, adminReportSummaries };
