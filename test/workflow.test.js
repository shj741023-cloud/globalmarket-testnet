'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  THREE_DAYS_MS,
  registerShipment,
  markDelivered,
  openDispute,
  confirmPurchase,
  autoConfirmDue
} = require('../lib/workflow');

function trade(overrides = {}) {
  return { id: 'trade_1', type: 'parcel_testnet', status: 'shipping_pending', settlementHold: false, ...overrides };
}

test('결제완료 뒤 운송장을 등록하고 배송중으로 바꾼다', () => {
  const item = trade();
  const shipment = registerShipment(item, { id: 'shipment_1', carrier: 'TEST', trackingNumber: '123' });
  assert.equal(item.status, 'shipping');
  assert.equal(shipment.status, 'shipping');
});

test('배송완료 후 정확히 3일 뒤 자동확정 시각을 계산한다', () => {
  const now = new Date('2026-08-14T00:00:00.000Z');
  const item = trade();
  const shipment = registerShipment(item, { id: 'shipment_1', carrier: 'TEST', trackingNumber: '123' }, now);
  markDelivered(item, shipment, now);
  assert.equal(new Date(shipment.autoConfirmAt).getTime() - now.getTime(), THREE_DAYS_MS);
});

test('분쟁이 접수되면 구매확정과 정산을 보류한다', () => {
  const item = trade({ status: 'delivered' });
  const dispute = openDispute(item, { id: 'dispute_1', applicantId: 'buyer', reason: '상품 상태 문제', gasFeeNoticeAccepted: true });
  assert.equal(item.settlementHold, true);
  assert.equal(dispute.settlementHold, true);
  assert.equal(dispute.gasFeeNoticeAccepted, true);
  assert.throws(() => confirmPurchase(item), /blocked by a dispute/);
});

test('가스비 안내에 동의하지 않으면 분쟁을 접수하지 않는다', () => {
  const item = trade({ status: 'delivered' });
  assert.throws(() => openDispute(item, { id: 'dispute_1', applicantId: 'buyer', reason: '상품 상태 문제' }), /Gas fee notice agreement/);
  assert.equal(item.status, 'delivered');
});

test('분쟁 없는 배송완료 거래만 기한 후 자동확정 대상이다', () => {
  const due = new Date('2026-08-17T00:00:00.000Z');
  const item = trade({ status: 'delivered' });
  const shipment = { tradeId: item.id, autoConfirmAt: due.toISOString() };
  assert.equal(autoConfirmDue(item, shipment, new Date(due.getTime() - 1)), false);
  assert.equal(autoConfirmDue(item, shipment, due), true);
  item.settlementHold = true;
  assert.equal(autoConfirmDue(item, shipment, new Date(due.getTime() + 1)), false);
});

test('구매확정은 반복 호출해도 한 번만 반영된다', () => {
  const item = trade({ status: 'delivered' });
  assert.equal(confirmPurchase(item).idempotent, false);
  assert.equal(confirmPurchase(item).idempotent, true);
});

test('직거래에는 배송 기능을 허용하지 않는다', () => {
  const item = trade({ type: 'direct' });
  assert.throws(() => registerShipment(item, { id: 'x', carrier: 'x', trackingNumber: 'x' }), /only for Testnet parcel trades/);
});
