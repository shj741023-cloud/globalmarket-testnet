'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { changeUserStatus } = require('../lib/user-status');

function state() {
  return {
    users: [{ id: 'u1', status: 'active' }],
    sessions: [{ id: 's1', userId: 'u1', revokedAt: null }, { id: 's2', userId: 'other', revokedAt: null }],
    products: [{ id: 'p1', sellerId: 'u1', status: 'available' }, { id: 'p2', sellerId: 'u1', status: 'sold' }]
  };
}

test('사용자 정지 시 세션을 폐기하고 판매중 상품을 중지한다', () => {
  const data = state();
  const result = changeUserStatus(data, 'u1', 'suspended', '확정된 중대한 위반', new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(result.revokedSessions, 1);
  assert.equal(result.pausedProducts, 1);
  assert.equal(data.users[0].status, 'suspended');
  assert.equal(data.sessions[0].revokedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(data.products[0].status, 'paused');
  assert.equal(data.products[1].status, 'sold');
});

test('사용자 복구 시 상품을 임의로 판매재개하지 않는다', () => {
  const data = state();
  data.users[0].status = 'suspended';
  data.products[0].status = 'paused';
  const result = changeUserStatus(data, 'u1', 'active', '이의신청 인용');
  assert.equal(result.user.status, 'active');
  assert.equal(data.products[0].status, 'paused');
});

test('사유 없는 상태 변경과 허용되지 않은 상태를 차단한다', () => {
  const data = state();
  assert.throws(() => changeUserStatus(data, 'u1', 'suspended', ''), /사유/);
  assert.throws(() => changeUserStatus(data, 'u1', 'deleted', '요청'), /active 또는 suspended/);
});

test('같은 상태 요청은 중복 처리하지 않는다', () => {
  const data = state();
  assert.equal(changeUserStatus(data, 'u1', 'active', '상태 확인').idempotent, true);
});
