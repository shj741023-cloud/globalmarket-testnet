'use strict';

function roomUnreadCount(messages, roomId, userId) {
  return messages.filter((item) => item.roomId === roomId && item.senderId !== userId && !item.readAt).length;
}

function markRoomRead(messages, notifications, roomId, userId, now = new Date()) {
  const readAt = now.toISOString();
  let messageCount = 0;
  let notificationCount = 0;
  for (const message of messages) {
    if (message.roomId === roomId && message.senderId !== userId && !message.readAt) {
      message.readAt = readAt;
      messageCount += 1;
    }
  }
  for (const item of notifications) {
    if (item.userId === userId && item.type === 'chat_message' && item.relatedId === roomId && !item.readAt) {
      item.readAt = readAt;
      notificationCount += 1;
    }
  }
  return { messageCount, notificationCount, changed: messageCount + notificationCount > 0 };
}

module.exports = { roomUnreadCount, markRoomRead };
