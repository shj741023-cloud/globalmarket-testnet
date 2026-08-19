'use strict';

function adminAuditSummaries(state, query = {}) {
  const action = String(query.action || '').trim().toUpperCase();
  const targetType = String(query.targetType || '').trim().toLowerCase();
  return (state.auditLogs || [])
    .filter((item) => !action || item.action === action)
    .filter((item) => !targetType || item.targetType === targetType)
    .slice(-500)
    .reverse()
    .map((item) => ({
      id: item.id,
      adminId: item.adminId,
      action: item.action,
      targetType: item.targetType,
      targetId: item.targetId,
      reason: item.reason,
      createdAt: item.createdAt
    }));
}

module.exports = { adminAuditSummaries };
