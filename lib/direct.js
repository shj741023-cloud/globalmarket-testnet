'use strict';

const DIRECT_PAYMENT_METHOD = 'personal_pi_wallet';

function requirePiWalletMethod(paymentMethod) {
  if (paymentMethod !== DIRECT_PAYMENT_METHOD) {
    throw Object.assign(new Error('Direct trades only allow a personal Pi wallet transfer'), { code: 'PI_ONLY_DIRECT_PAYMENT_REQUIRED' });
  }
}

function requireDirectTrade(trade) {
  if (!trade || trade.type !== 'direct') throw Object.assign(new Error('Direct trade is required'), { code: 'DIRECT_TRADE_REQUIRED' });
}

function requireParty(trade, userId) {
  requireDirectTrade(trade);
  if (![trade.sellerId, trade.buyerId].includes(userId)) throw Object.assign(new Error('Direct trade party required'), { code: 'DIRECT_TRADE_PARTY_REQUIRED' });
}

function createDirectRecord(trade, input, now = new Date()) {
  requireParty(trade, input.userId);
  if (input.noticeAccepted !== true) throw Object.assign(new Error('Own-risk notice must be accepted'), { code: 'DIRECT_NOTICE_REQUIRED' });
  if (!input.scheduledAt || !String(input.place || '').trim()) {
    throw Object.assign(new Error('Time and place are required'), { code: 'DIRECT_SCHEDULE_REQUIRED' });
  }
  requirePiWalletMethod(input.paymentMethod);
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw Object.assign(new Error('Valid scheduledAt is required'), { code: 'INVALID_DIRECT_TIME' });
  return {
    tradeId: trade.id,
    scheduledAt: scheduledAt.toISOString(),
    place: String(input.place).trim().slice(0, 300),
    paymentMethod: DIRECT_PAYMENT_METHOD,
    noticeAcceptedAt: now.toISOString(),
    noticeAcceptedBy: input.userId,
    sellerCompletedAt: null,
    buyerCompletedAt: null,
    canceledAt: null,
    canceledBy: null,
    updatedAt: now.toISOString()
  };
}

function updateDirectSchedule(trade, record, input, now = new Date()) {
  requireParty(trade, input.userId);
  if (!record || record.canceledAt) throw Object.assign(new Error('Active direct record is required'), { code: 'ACTIVE_DIRECT_RECORD_REQUIRED' });
  if (input.scheduledAt) {
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw Object.assign(new Error('Valid scheduledAt is required'), { code: 'INVALID_DIRECT_TIME' });
    record.scheduledAt = scheduledAt.toISOString();
  }
  if (input.place) record.place = String(input.place).trim().slice(0, 300);
  if (input.paymentMethod) {
    requirePiWalletMethod(input.paymentMethod);
    record.paymentMethod = DIRECT_PAYMENT_METHOD;
  }
  record.updatedAt = now.toISOString();
  return record;
}

function completeDirect(trade, record, userId, now = new Date()) {
  requireParty(trade, userId);
  if (!record || record.canceledAt) throw Object.assign(new Error('Active direct record is required'), { code: 'ACTIVE_DIRECT_RECORD_REQUIRED' });
  const field = userId === trade.sellerId ? 'sellerCompletedAt' : 'buyerCompletedAt';
  const idempotent = Boolean(record[field]);
  record[field] ||= now.toISOString();
  if (record.sellerCompletedAt && record.buyerCompletedAt) {
    trade.status = 'completed';
    trade.completedAt = now.toISOString();
  }
  return { record, trade, idempotent };
}

function cancelDirect(trade, record, userId, reason, now = new Date()) {
  requireParty(trade, userId);
  if (trade.status === 'completed') throw Object.assign(new Error('Completed direct trade cannot be canceled'), { code: 'DIRECT_ALREADY_COMPLETED' });
  if (record.canceledAt) return { record, trade, idempotent: true };
  record.canceledAt = now.toISOString();
  record.canceledBy = userId;
  record.cancelReason = String(reason || '').slice(0, 500);
  trade.status = 'canceled';
  trade.canceledAt = now.toISOString();
  return { record, trade, idempotent: false };
}

module.exports = { DIRECT_PAYMENT_METHOD, requireDirectTrade, requireParty, createDirectRecord, updateDirectSchedule, completeDirect, cancelDirect };
