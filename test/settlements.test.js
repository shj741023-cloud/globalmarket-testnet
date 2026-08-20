'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { completeMockSettlement } = require('../lib/settlements');

test('구매확정된 Testnet 택배 거래의 모의정산을 기록한다', () => {
  const trade = { id: 'trade', type: 'parcel_testnet', status: 'purchase_confirmed', settlementHold: false, amount: 100 };
  const settlements = [];
  const result = completeMockSettlement(trade, settlements, { id: 'settlement' }, new Date('2026-08-20T00:00:00Z'));
  assert.equal(result.settlement.netAmount, 99);
  assert.equal(result.settlement.status, 'mock_completed');
  assert.equal(settlements.length, 1);
  assert.equal(completeMockSettlement(trade, settlements, { id: 'second' }).idempotent, true);
});

test('분쟁 보류 또는 구매확정 전에는 모의정산하지 않는다', () => {
  assert.throws(() => completeMockSettlement({ id: 't', type: 'parcel_testnet', status: 'delivered', settlementHold: false, amount: 1 }, [], { id: 's' }), /Purchase confirmation/);
  assert.throws(() => completeMockSettlement({ id: 't', type: 'parcel_testnet', status: 'purchase_confirmed', settlementHold: true, amount: 1 }, [], { id: 's' }), /held by a dispute/);
});

test('부분환불 뒤에는 판매자에게 남은 금액만 정산한다', () => {
  const trade = { id: 'trade', type: 'parcel_testnet', status: 'purchase_confirmed', settlementHold: false, amount: 0.01 };
  const result = completeMockSettlement(trade, [], { id: 'settlement', grossAmount: 0.005 });
  assert.equal(result.settlement.grossAmount, 0.005);
  assert.equal(result.settlement.sellerFee, 0.00005);
  assert.equal(result.settlement.netAmount, 0.00495);
});
