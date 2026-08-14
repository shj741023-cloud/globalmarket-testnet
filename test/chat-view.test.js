'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { listUserRooms } = require('../lib/chat-view');

test('본인이 참여한 채팅방만 최신순으로 역할과 함께 표시한다', () => {
  const rooms = [
    { id: 'buy', buyerId: 'me', sellerId: 'a', createdAt: '2026-01-01' },
    { id: 'sell', buyerId: 'b', sellerId: 'me', createdAt: '2026-02-01' },
    { id: 'other', buyerId: 'x', sellerId: 'y', createdAt: '2026-03-01' }
  ];
  const result = listUserRooms(rooms, 'me');
  assert.deepEqual(result.map((item) => item.id), ['sell', 'buy']);
  assert.deepEqual(result.map((item) => item.myRole), ['seller', 'buyer']);
});
