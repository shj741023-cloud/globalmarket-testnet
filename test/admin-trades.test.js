'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adminTradeSummaries } = require('../lib/admin-trades');

test('관리자 거래 목록은 당사자 식별값 없이 거래·정산 상태만 제공한다', () => {
  const items = adminTradeSummaries({
    trades: [{ id: 't1', productId: 'p1', sellerId: 'secret-seller', buyerId: 'secret-buyer', type: 'parcel_testnet', status: 'purchase_confirmed', amount: 100, createdAt: '2026-10-19' }],
    products: [{ id: 'p1', title: '중고 카메라' }],
    settlements: [{ tradeId: 't1', status: 'mock_completed', grossAmount: 100, sellerFee: 1, netAmount: 99, completedAt: '2026-10-20' }]
  });
  assert.equal(items[0].productTitle, '중고 카메라');
  assert.equal(items[0].settlement.netAmount, 99);
  assert.equal(JSON.stringify(items).includes('secret-'), false);
});

test('관리자 거래 목록은 상태와 거래방식을 함께 필터링한다', () => {
  const state = { trades: [{ id: 'a', type: 'direct', status: 'completed' }, { id: 'b', type: 'parcel_testnet', status: 'purchase_confirmed' }], products: [], settlements: [] };
  assert.deepEqual(adminTradeSummaries(state, { type: 'parcel_testnet', status: 'purchase_confirmed' }).map((item) => item.id), ['b']);
});
