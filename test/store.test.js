'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { secureDatabaseUrl } = require('../lib/store');

test('Neon 연결의 서버 인증서와 호스트 이름을 검증한다', () => {
  const secured = secureDatabaseUrl('postgresql://user:secret@example.neon.tech/db?sslmode=require');
  const url = new URL(secured);
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  assert.equal(url.password, 'secret');
});

test('이미 강화된 SSL 설정은 그대로 유지한다', () => {
  const value = 'postgresql://user:secret@example.neon.tech/db?sslmode=verify-full';
  assert.equal(secureDatabaseUrl(value), value);
});
