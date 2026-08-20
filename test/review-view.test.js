'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { userReviews } = require('../lib/review-view');

test('사용자가 작성하거나 받은 후기만 최신순으로 보여준다', () => {
  const state = {
    users: [{ id: 'me', username: '나' }, { id: 'other', username: '상대방' }],
    products: [{ id: 'product', title: '중고 카메라' }],
    trades: [{ id: 'trade', productId: 'product' }],
    reviews: [
      { id: 'received', tradeId: 'trade', writerId: 'other', targetUserId: 'me', sentiment: 'positive', comment: '좋아요', createdAt: '2026-08-20T02:00:00Z' },
      { id: 'written', tradeId: 'trade', writerId: 'me', targetUserId: 'other', sentiment: 'neutral', comment: '완료', createdAt: '2026-08-20T01:00:00Z' },
      { id: 'hidden', tradeId: 'trade', writerId: 'x', targetUserId: 'y', sentiment: 'positive', comment: '숨김', createdAt: '2026-08-20T03:00:00Z' }
    ]
  };
  const items = userReviews(state, 'me');
  assert.deepEqual(items.map((item) => item.id), ['received', 'written']);
  assert.equal(items[0].direction, 'received');
  assert.equal(items[1].direction, 'written');
  assert.equal(items[0].productTitle, '중고 카메라');
});
