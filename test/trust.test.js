'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { levelFor, nextLevel, ensureProfile, applyTrustEvent } = require('../lib/trust');

function state() { return { trustProfiles: [], trustEvents: [] }; }

test('신규 사용자는 신뢰점수 50점 Bronze로 시작한다', () => {
  const profile = ensureProfile(state(), 'user1');
  assert.equal(profile.score, 50);
  assert.equal(profile.level, 'Bronze');
});

test('정상 거래완료는 2점과 정상 거래 수 1건을 반영한다', () => {
  const data = state();
  const result = applyTrustEvent(data, { id: 'e1', uniqueKey: 'complete:t1:u1', userId: 'u1', tradeId: 't1', type: 'transaction_completed' });
  assert.equal(result.profile.score, 52);
  assert.equal(result.profile.normalTradeCount, 1);
});

test('긍정 후기는 1점을 반영한다', () => {
  const data = state();
  const result = applyTrustEvent(data, { id: 'e1', uniqueKey: 'review:r1', userId: 'u1', type: 'positive_review' });
  assert.equal(result.profile.score, 51);
});

test('같은 사건은 점수에 한 번만 반영한다', () => {
  const data = state();
  const input = { id: 'e1', uniqueKey: 'review:r1', userId: 'u1', type: 'positive_review' };
  applyTrustEvent(data, input);
  const second = applyTrustEvent(data, input);
  assert.equal(second.idempotent, true);
  assert.equal(second.profile.score, 51);
  assert.equal(data.trustEvents.length, 1);
});

test('신고 접수만으로는 감점할 수 없다', () => {
  const data = state();
  assert.throws(() => applyTrustEvent(data, { id: 'e1', uniqueKey: 'report:r1', userId: 'u1', type: 'report_received' }), /do not change trust score/);
  assert.equal(ensureProfile(data, 'u1').score, 50);
});

test('확정 위반은 3점에서 20점 사이만 감점한다', () => {
  const data = state();
  const result = applyTrustEvent(data, { id: 'e1', uniqueKey: 'violation:d1', userId: 'u1', type: 'confirmed_violation', penalty: 10 });
  assert.equal(result.profile.score, 40);
  assert.throws(() => applyTrustEvent(data, { id: 'e2', uniqueKey: 'violation:d2', userId: 'u1', type: 'confirmed_violation', penalty: 21 }), /between 3 and 20/);
});

test('점수와 정상 거래 수를 모두 충족해야 등급이 올라간다', () => {
  assert.equal(levelFor(60, 2), 'Bronze');
  assert.equal(levelFor(60, 3), 'Silver');
  assert.equal(levelFor(70, 10), 'Gold');
  assert.equal(levelFor(80, 30), 'Platinum');
  assert.equal(levelFor(90, 100), 'Diamond');
  assert.equal(levelFor(90, 100, { majorViolation: true }), 'Platinum');
});

test('다음 등급 조건을 반환한다', () => {
  assert.deepEqual(nextLevel({ score: 61, normalTradeCount: 4 }), { level: 'Gold', score: 70, trades: 10 });
});

test('신뢰점수는 0에서 100 범위를 벗어나지 않는다', () => {
  const data = state();
  const profile = ensureProfile(data, 'u1'); profile.score = 99;
  applyTrustEvent(data, { id: 'e1', uniqueKey: 'complete:t1', userId: 'u1', type: 'transaction_completed' });
  assert.equal(profile.score, 100);
});
