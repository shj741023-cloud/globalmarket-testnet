'use strict';

function listUserRooms(rooms, userId) {
  return rooms.filter((room) => [room.buyerId, room.sellerId].includes(userId))
    .map((room) => ({ ...room, myRole: room.buyerId === userId ? 'buyer' : 'seller' }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

module.exports = { listUserRooms };
