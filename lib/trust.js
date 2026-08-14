'use strict';

const EVENT_POINTS = Object.freeze({
  transaction_completed: 2,
  positive_review: 1,
  shipping_agreement_kept: 1,
  purchase_confirmed: 1,
  five_normal_trades: 2
});

function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

function levelFor(score, normalTradeCount, options = {}) {
  if (score >= 90 && normalTradeCount >= 100 && options.recentActivity !== false && options.majorViolation !== true) return 'Diamond';
  if (score >= 80 && normalTradeCount >= 30) return 'Platinum';
  if (score >= 70 && normalTradeCount >= 10) return 'Gold';
  if (score >= 60 && normalTradeCount >= 3) return 'Silver';
  return 'Bronze';
}

function nextLevel(profile) {
  const levels = [
    { level: 'Silver', score: 60, trades: 3 },
    { level: 'Gold', score: 70, trades: 10 },
    { level: 'Platinum', score: 80, trades: 30 },
    { level: 'Diamond', score: 90, trades: 100 }
  ];
  return levels.find((item) => profile.score < item.score || profile.normalTradeCount < item.trades) || null;
}

function ensureProfile(state, userId) {
  let profile = state.trustProfiles.find((item) => item.userId === userId);
  if (!profile) {
    profile = { userId, score: 50, level: 'Bronze', normalTradeCount: 0, updatedAt: new Date().toISOString() };
    state.trustProfiles.push(profile);
  }
  return profile;
}

function applyTrustEvent(state, input, now = new Date()) {
  const duplicate = state.trustEvents.find((item) => item.uniqueKey === input.uniqueKey);
  if (duplicate) return { event: duplicate, profile: ensureProfile(state, input.userId), idempotent: true };
  if (!input.uniqueKey || !input.userId) throw Object.assign(new Error('userId and uniqueKey are required'), { code: 'TRUST_EVENT_DATA_REQUIRED' });

  let change;
  if (input.type === 'confirmed_violation') {
    const penalty = Number(input.penalty);
    if (!Number.isInteger(penalty) || penalty < 3 || penalty > 20) {
      throw Object.assign(new Error('Confirmed violation penalty must be between 3 and 20'), { code: 'INVALID_TRUST_PENALTY' });
    }
    change = -penalty;
  } else {
    change = EVENT_POINTS[input.type];
    if (change === undefined) {
      throw Object.assign(new Error('Unconfirmed reports and unsupported events do not change trust score'), { code: 'TRUST_EVENT_NOT_SCORABLE' });
    }
  }

  const profile = ensureProfile(state, input.userId);
  if (input.type === 'transaction_completed') profile.normalTradeCount += 1;
  const before = profile.score;
  profile.score = clampScore(profile.score + change);
  profile.level = levelFor(profile.score, profile.normalTradeCount, input.options);
  profile.updatedAt = now.toISOString();
  const event = {
    id: input.id,
    uniqueKey: input.uniqueKey,
    userId: input.userId,
    tradeId: input.tradeId || null,
    type: input.type,
    change: profile.score - before,
    reason: String(input.reason || '').slice(0, 500),
    createdAt: now.toISOString()
  };
  state.trustEvents.push(event);
  return { event, profile, idempotent: false };
}

module.exports = { EVENT_POINTS, clampScore, levelFor, nextLevel, ensureProfile, applyTrustEvent };
