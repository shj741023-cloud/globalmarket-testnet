'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { publicSeller, publicProduct } = require('../lib/product-view');

const state = {
  users: [{ id: 'seller-1', username: 'pioneer' }],
  trustProfiles: [{ userId: 'seller-1', level: 'Silver', normalTradeCount: 4 }]
};

test('판매자의 공개 사용자명과 신뢰정보만 제공한다', () => {
  assert.deepEqual(publicSeller(state, 'seller-1'), { username: 'pioneer', trustLevel: 'Silver', normalTradeCount: 4 });
});

test('공개 상품에서 내부 판매자 ID와 검토 사유를 제거한다', () => {
  const product = publicProduct(state, { id: 'p1', sellerId: 'seller-1', title: '카메라', reviewReasons: ['내부 검토'] });
  assert.equal(product.sellerId, undefined);
  assert.equal(product.reviewReasons, undefined);
  assert.equal(product.seller.username, 'pioneer');
});

test('신규 판매자는 기본 Bronze 공개정보를 사용한다', () => {
  assert.deepEqual(publicSeller({ users: [], trustProfiles: [] }, 'missing'), { username: 'Pi 사용자', trustLevel: 'Bronze', normalTradeCount: 0 });
});
