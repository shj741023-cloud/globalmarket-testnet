'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listFavoriteProductIds, addFavorite, removeFavorite } = require('../lib/favorites');

test('사용자별 찜 상품을 최신순으로 분리한다', () => {
  const favorites = [
    { userId: 'u1', productId: 'p1', createdAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'u2', productId: 'p2', createdAt: '2026-01-03T00:00:00.000Z' },
    { userId: 'u1', productId: 'p3', createdAt: '2026-01-02T00:00:00.000Z' }
  ];
  assert.deepEqual(listFavoriteProductIds(favorites, 'u1'), ['p3', 'p1']);
});

test('같은 상품 찜은 중복 저장하지 않는다', () => {
  const favorites = [];
  assert.equal(addFavorite(favorites, { id: 'f1', userId: 'u1', productId: 'p1' }).idempotent, false);
  assert.equal(addFavorite(favorites, { id: 'f2', userId: 'u1', productId: 'p1' }).idempotent, true);
  assert.equal(favorites.length, 1);
});

test('찜 해제는 반복 요청해도 안전하다', () => {
  const favorites = [{ id: 'f1', userId: 'u1', productId: 'p1', createdAt: '2026-01-01T00:00:00.000Z' }];
  assert.equal(removeFavorite(favorites, 'u1', 'p1').removed, true);
  assert.equal(removeFavorite(favorites, 'u1', 'p1').idempotent, true);
});
