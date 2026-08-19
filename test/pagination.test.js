'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { paginate } = require('../lib/pagination');

test('기본 20개씩 상품을 나누고 다음 페이지 존재 여부를 반환한다', () => {
  const result = paginate(Array.from({ length: 25 }, (_, index) => index));
  assert.equal(result.items.length, 20);
  assert.equal(result.total, 25);
  assert.equal(result.hasMore, true);
});

test('시작 위치부터 다음 상품을 이어서 반환한다', () => {
  const result = paginate(['a', 'b', 'c', 'd'], { offset: '2', limit: '2' });
  assert.deepEqual(result.items, ['c', 'd']);
  assert.equal(result.hasMore, false);
});

test('한 번에 요청할 수 있는 상품을 최대 50개로 제한한다', () => {
  const result = paginate(Array.from({ length: 80 }, (_, index) => index), { limit: '999', offset: '-10' });
  assert.equal(result.limit, 50);
  assert.equal(result.offset, 0);
  assert.equal(result.items.length, 50);
});
