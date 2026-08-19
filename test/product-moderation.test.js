'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moderationQueue, moderateProduct } = require('../lib/product-moderation');

test('검토목록은 판매자 내부 식별값을 제외하고 보류 상품만 제공한다', () => {
  const state = { users: [{ id: 'u1', username: 'pioneer' }], products: [{ id: 'p1', sellerId: 'u1', title: '상품', status: 'under_review', methods: ['direct'], reviewReasons: ['티켓'], createdAt: '2026-08-19T00:00:00Z' }, { id: 'p2', sellerId: 'u1', status: 'available' }] };
  const [item] = moderationQueue(state);
  assert.equal(item.id, 'p1');
  assert.equal(item.sellerUsername, 'pioneer');
  assert.equal(item.sellerId, undefined);
});

test('관리자 승인과 거절은 검토 중 상품에만 적용된다', () => {
  const approved = { id: 'p1', status: 'under_review' };
  moderateProduct(approved, 'approve', '실물 중고품 확인');
  assert.equal(approved.status, 'available');
  const rejected = { id: 'p2', status: 'under_review' };
  moderateProduct(rejected, 'reject', '제한품목');
  assert.equal(rejected.status, 'rejected');
  assert.throws(() => moderateProduct(approved, 'reject', '다시 거절'), /검토 중/);
});

test('상품 검토 판정에는 사유가 필요하다', () => {
  assert.throws(() => moderateProduct({ status: 'under_review' }, 'approve', ''), /사유/);
});
