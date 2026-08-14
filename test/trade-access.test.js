'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTradeParty, assertTradeBuyer, assertTradeSeller } = require('../lib/trade-access');

const trade = { id: 'trade-1', buyerId: 'buyer', sellerId: 'seller' };

test('구매자와 판매자만 거래정보에 접근한다', () => {
  assert.equal(assertTradeParty(trade, 'buyer'), trade);
  assert.equal(assertTradeParty(trade, 'seller'), trade);
  assert.throws(() => assertTradeParty(trade, 'other'), /거래 당사자/);
});

test('구매자 전용 동작을 판매자와 제3자에게 차단한다', () => {
  assert.equal(assertTradeBuyer(trade, 'buyer'), trade);
  assert.throws(() => assertTradeBuyer(trade, 'seller'), /구매자만/);
  assert.throws(() => assertTradeBuyer(trade, 'other'), /구매자만/);
});

test('판매자 전용 동작을 구매자와 제3자에게 차단한다', () => {
  assert.equal(assertTradeSeller(trade, 'seller'), trade);
  assert.throws(() => assertTradeSeller(trade, 'buyer'), /판매자만/);
  assert.throws(() => assertTradeSeller(trade, 'other'), /판매자만/);
});
