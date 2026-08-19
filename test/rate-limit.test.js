'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RateLimiter } = require('../lib/rate-limit');

test('허용 횟수 안의 요청은 통과한다', () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.consume('user', 2, 1000, 0).allowed, true);
  assert.equal(limiter.consume('user', 2, 1000, 1).allowed, true);
});

test('제한을 넘은 요청에 재시도 시간을 반환한다', () => {
  const limiter = new RateLimiter();
  limiter.consume('user', 1, 1000, 0);
  const blocked = limiter.consume('user', 1, 1000, 100);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 900);
});

test('제한 시간이 지나면 다시 요청할 수 있다', () => {
  const limiter = new RateLimiter();
  limiter.consume('user', 1, 1000, 0);
  assert.equal(limiter.consume('user', 1, 1000, 1000).allowed, true);
});
