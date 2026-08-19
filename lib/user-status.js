'use strict';

function changeUserStatus(state, userId, nextStatus, reason, now = new Date()) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw Object.assign(new Error('사용자를 찾을 수 없습니다.'), { code: 'USER_NOT_FOUND', status: 404 });
  if (!['active', 'suspended'].includes(nextStatus)) throw Object.assign(new Error('active 또는 suspended 상태만 사용할 수 있습니다.'), { code: 'INVALID_USER_STATUS', status: 400 });
  if (!String(reason || '').trim()) throw Object.assign(new Error('상태 변경 사유가 필요합니다.'), { code: 'USER_STATUS_REASON_REQUIRED', status: 400 });
  if (user.status === nextStatus) return { user, revokedSessions: 0, pausedProducts: 0, idempotent: true };

  user.status = nextStatus;
  user.statusReason = String(reason).trim().slice(0, 1000);
  user.statusUpdatedAt = now.toISOString();
  let revokedSessions = 0;
  let pausedProducts = 0;
  if (nextStatus === 'suspended') {
    for (const session of state.sessions) {
      if (session.userId === userId && !session.revokedAt) { session.revokedAt = now.toISOString(); revokedSessions += 1; }
    }
    for (const product of state.products) {
      if (product.sellerId === userId && product.status === 'available') { product.status = 'paused'; product.updatedAt = now.toISOString(); pausedProducts += 1; }
    }
  }
  return { user, revokedSessions, pausedProducts, idempotent: false };
}

module.exports = { changeUserStatus };
