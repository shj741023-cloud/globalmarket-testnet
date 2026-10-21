'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNickname, updateNickname, publicMember } = require('../lib/user-profile');

test('Pi 사용자명과 앱 닉네임을 분리해 저장한다', () => {
  const users = [{ id: 'u1', username: 'pi_user', status: 'active' }];
  const user = updateNickname(users, 'u1', '  글로벌   파이오니어  ', new Date('2026-10-17T00:00:00Z'));
  assert.equal(user.username, 'pi_user');
  assert.equal(user.nickname, '글로벌 파이오니어');
  assert.deepEqual(publicMember(user), { id: 'u1', piUsername: 'pi_user', nickname: '글로벌 파이오니어', status: 'active' });
});

test('빈 닉네임과 대소문자만 다른 중복 닉네임을 거부한다', () => {
  const users = [{ id: 'u1', nickname: 'Market User' }, { id: 'u2' }];
  assert.throws(() => updateNickname(users, 'u2', '  '), (error) => error.code === 'NICKNAME_REQUIRED');
  assert.throws(() => updateNickname(users, 'u2', 'market user'), (error) => error.code === 'NICKNAME_DUPLICATE');
});
