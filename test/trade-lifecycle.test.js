'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reserveProduct, releaseProduct, sellProduct, cancelPendingParcelTrade } = require('../lib/trade-lifecycle');

test('거래 생성·취소·완료에 따라 상품을 예약·판매중·판매완료로 전환한다', () => {
  const product = { status: 'available' };
  reserveProduct(product); assert.equal(product.status, 'reserved');
  releaseProduct(product); assert.equal(product.status, 'available');
  reserveProduct(product); sellProduct(product); assert.equal(product.status, 'sold');
});

test('결제 전 Testnet 택배 거래만 당사자가 취소할 수 있다', () => {
  const trade = { type: 'parcel_testnet', status: 'payment_pending', buyerId: 'buyer', sellerId: 'seller' };
  assert.throws(() => cancelPendingParcelTrade(trade, 'other', '취소'), /party/);
  const result = cancelPendingParcelTrade(trade, 'buyer', '구매 취소');
  assert.equal(result.trade.status, 'cancelled');
  assert.equal(cancelPendingParcelTrade(trade, 'buyer', '반복').idempotent, true);
});

test('결제 이후 Testnet 택배 거래 취소를 차단한다', () => {
  const trade = { type: 'parcel_testnet', status: 'shipping_pending', buyerId: 'buyer', sellerId: 'seller' };
  assert.throws(() => cancelPendingParcelTrade(trade, 'buyer', '취소'), /unpaid/);
});
