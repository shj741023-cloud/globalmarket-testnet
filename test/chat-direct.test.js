'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enableChatDirectTrade } = require('../lib/chat-direct');

const wallet = `G${'A'.repeat(55)}`;

test('판매자는 거래 생성 전에 채팅에서 직거래 지갑을 등록할 수 있다', () => {
  const product = { sellerId: 'seller', methods: ['parcel_testnet'] };
  const room = { sellerId: 'seller', buyerId: 'buyer' };
  enableChatDirectTrade(product, room, 'seller', wallet, null, new Date('2026-08-31T00:00:00Z'));
  assert.equal(product.directWalletAddress, wallet);
  assert.deepEqual(product.methods, ['parcel_testnet', 'direct']);
});

test('구매자 등록과 거래 생성 후 변경을 차단한다', () => {
  const product = { sellerId: 'seller', methods: ['parcel_testnet'] };
  const room = { sellerId: 'seller', buyerId: 'buyer' };
  assert.throws(() => enableChatDirectTrade(product, room, 'buyer', wallet, null), /seller/i);
  assert.throws(() => enableChatDirectTrade(product, room, 'seller', wallet, { id: 'trade' }), /cannot change/i);
});
