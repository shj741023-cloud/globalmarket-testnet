'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminUserSummaries } = require('../lib/admin-users');

const state = {
  users: [
    { id: 'u1', piUid: 'private-pi-id', username: 'Pioneer', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u2', piUid: 'private-pi-id-2', username: 'Seller', status: 'suspended', createdAt: '2026-01-02T00:00:00.000Z' }
  ],
  trustProfiles: [{ userId: 'u1', score: 65, level: 'Silver', normalTradeCount: 4 }],
  products: [{ sellerId: 'u1', status: 'available' }, { sellerId: 'u1', status: 'sold' }]
};

test('관리자 목록에 필요한 상태·신뢰·상품 요약만 제공한다', () => {
  const user = adminUserSummaries(state).find((item) => item.id === 'u1');
  assert.equal(user.trust.level, 'Silver');
  assert.equal(user.productCount, 2);
  assert.equal(user.activeProductCount, 1);
  assert.equal(user.piUid, undefined);
  assert.equal(user.sessions, undefined);
});

test('사용자 상태와 사용자명으로 목록을 필터링한다', () => {
  assert.deepEqual(adminUserSummaries(state, { status: 'suspended' }).map((item) => item.id), ['u2']);
  assert.deepEqual(adminUserSummaries(state, { q: 'pioneer' }).map((item) => item.id), ['u1']);
});

test('신뢰기록이 없는 사용자는 Bronze 기본값을 표시한다', () => {
  const user = adminUserSummaries(state).find((item) => item.id === 'u2');
  assert.deepEqual(user.trust, { score: 50, level: 'Bronze', normalTradeCount: 0 });
});
