'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listUserTrades, tradeSnapshot } = require('../lib/trade-view');

const trades = [
  { id: 'old-buy', buyerId: 'me', sellerId: 'a', type: 'direct', status: 'completed', productId: 'p1', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'new-sell', buyerId: 'b', sellerId: 'me', type: 'parcel_testnet', status: 'shipping', productId: 'p2', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'other', buyerId: 'x', sellerId: 'y', type: 'direct', status: 'completed', productId: 'p3', createdAt: '2026-03-01T00:00:00Z' }
];

test('본인이 구매자 또는 판매자인 거래만 최신순으로 표시한다', () => {
  assert.deepEqual(listUserTrades(trades, 'me').map((item) => item.id), ['new-sell', 'old-buy']);
});

test('구매·판매 역할과 상태·거래방식을 함께 필터링한다', () => {
  assert.deepEqual(listUserTrades(trades, 'me', { role: 'seller', status: 'shipping', type: 'parcel_testnet' }).map((item) => item.id), ['new-sell']);
  assert.equal(listUserTrades(trades, 'me', { role: 'buyer', status: 'shipping' }).length, 0);
});

test('거래 상세에 상품·결제·배송·분쟁 정보를 묶어 표시한다', () => {
  const trade = trades[1];
  const state = {
    products: [{ id: 'p2', title: '카메라' }], payments: [{ id: 'pay', tradeId: trade.id }],
    shipments: [{ id: 'ship', tradeId: trade.id }], directTradeRecords: [], settlements: [], refunds: [],
    disputes: [{ id: 'dispute', tradeId: trade.id }], reviews: []
  };
  const result = tradeSnapshot(state, trade, 'me');
  assert.equal(result.trade.myRole, 'seller');
  assert.equal(result.product.title, '카메라');
  assert.equal(result.payment.id, 'pay');
  assert.equal(result.shipment.id, 'ship');
  assert.equal(result.disputes.length, 1);
});

test('제3자는 거래 상세 묶음을 조회할 수 없다', () => {
  const emptyState = { products: [], payments: [], shipments: [], directTradeRecords: [], settlements: [], refunds: [], disputes: [], reviews: [] };
  assert.throws(() => tradeSnapshot(emptyState, trades[0], 'other'), /거래 당사자/);
});
