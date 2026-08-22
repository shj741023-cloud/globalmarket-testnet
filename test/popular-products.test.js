'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listPopularProducts, setPopularProduct } = require('../lib/popular-products');

test('관리자가 판매 중 상품을 추천 상품으로 선정하고 해제한다', () => {
  const product = { id: 'p1', status: 'available' };
  const selected = setPopularProduct(product, true, 'admin', '협의 완료', new Date('2026-08-22T00:00:00Z'));
  assert.equal(selected.idempotent, false);
  assert.equal(product.popularPlacement.selectedBy, 'admin');
  assert.deepEqual(listPopularProducts([product]), [product]);
  setPopularProduct(product, false, 'admin', '노출 종료', new Date('2026-08-23T00:00:00Z'));
  assert.equal(product.popularPlacement, null);
});

test('판매 중이 아니거나 사유 없는 추천 상품 선정을 차단한다', () => {
  assert.throws(() => setPopularProduct({ status: 'sold' }, true, 'admin', '선정'), /판매 중인 상품/);
  assert.throws(() => setPopularProduct({ status: 'available' }, true, 'admin', ''), /관리 사유/);
});
