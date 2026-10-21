'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { roomUnreadCount, markRoomRead } = require('../lib/chat-notifications');

test('상대방이 보낸 읽지 않은 메시지만 채팅방 숫자에 포함한다', () => {
  const messages = [
    { roomId: 'r1', senderId: 'other', readAt: null },
    { roomId: 'r1', senderId: 'me', readAt: null },
    { roomId: 'r1', senderId: 'other', readAt: '2026-01-01' },
    { roomId: 'r2', senderId: 'other', readAt: null }
  ];
  assert.equal(roomUnreadCount(messages, 'r1', 'me'), 1);
});

test('채팅방을 열면 메시지와 해당 채팅 알림을 함께 읽음 처리한다', () => {
  const messages = [{ roomId: 'r1', senderId: 'other', readAt: null }, { roomId: 'r1', senderId: 'me', readAt: null }];
  const notifications = [
    { userId: 'me', type: 'chat_message', relatedId: 'r1', readAt: null },
    { userId: 'me', type: 'price_proposal', relatedId: 'r1', readAt: null },
    { userId: 'other', type: 'chat_message', relatedId: 'r1', readAt: null }
  ];
  const result = markRoomRead(messages, notifications, 'r1', 'me', new Date('2026-10-19T00:00:00.000Z'));
  assert.deepEqual({ messageCount: result.messageCount, notificationCount: result.notificationCount }, { messageCount: 1, notificationCount: 1 });
  assert.ok(messages[0].readAt);
  assert.equal(messages[1].readAt, null);
  assert.equal(notifications[1].readAt, null);
});
