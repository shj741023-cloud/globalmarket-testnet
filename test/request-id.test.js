'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequestId, isRequestId } = require('../lib/request-id');

test('각 요청에 추적 가능한 임의 문의번호를 만든다', () => {
  const first = createRequestId();
  const second = createRequestId();
  assert.equal(isRequestId(first), true);
  assert.equal(isRequestId(second), true);
  assert.notEqual(first, second);
});

test('임의 문자열을 문의번호로 인정하지 않는다', () => {
  assert.equal(isRequestId('req_example'), false);
  assert.equal(isRequestId(''), false);
});
