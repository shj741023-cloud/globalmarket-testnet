'use strict';

function normalizeNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function updateNickname(users, userId, value, now = new Date()) {
  const user = users.find((item) => item.id === userId);
  if (!user) throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
  const nickname = normalizeNickname(value);
  if (!nickname) throw Object.assign(new Error('Nickname is required'), { code: 'NICKNAME_REQUIRED' });
  const duplicate = users.find((item) => item.id !== userId && normalizeNickname(item.nickname).toLocaleLowerCase() === nickname.toLocaleLowerCase());
  if (duplicate) throw Object.assign(new Error('Nickname is already in use'), { code: 'NICKNAME_DUPLICATE' });
  user.nickname = nickname;
  user.profileUpdatedAt = now.toISOString();
  return user;
}

function publicMember(user) {
  return { id: user.id, piUsername: String(user.username || ''), nickname: String(user.nickname || ''), status: user.status };
}

module.exports = { normalizeNickname, updateNickname, publicMember };
