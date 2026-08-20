'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { preparePayment, approvePayment, completePayment, incompletePayments } = require('../lib/payments');

const parcelTrade = () => ({ id: 't1', type: 'parcel_testnet', amount: 100, status: 'payment_pending' });

test('거래당 활성 결제를 한 건만 준비한다', () => {
  const trade = parcelTrade(); const payments = [];
  const first = preparePayment(trade, payments, { id: 'p1' }); payments.push(first.payment);
  const second = preparePayment(trade, payments, { id: 'p2' });
  assert.equal(second.idempotent, true);
  assert.equal(second.payment.id, 'p1');
});

test('직거래 결제 준비를 차단한다', () => {
  assert.throws(() => preparePayment({ ...parcelTrade(), type: 'direct' }, [], { id: 'p1' }), /not available for direct trades/);
});

test('같은 Pi 결제 ID를 다른 결제에 연결하지 않는다', () => {
  const one = { id: 'p1', status: 'prepared', providerPaymentId: null };
  const two = { id: 'p2', status: 'approved', providerPaymentId: 'pi_1' };
  assert.throws(() => approvePayment(one, [one, two], 'pi_1'), /already linked/);
});

test('내부 승인만 남은 결제는 Pi 서버 승인을 다시 요청한다', () => {
  const payment = { id: 'p1', status: 'approved', providerPaymentId: 'pi_1' };
  const result = approvePayment(payment, [payment], 'pi_1');
  assert.equal(result.idempotent, true);
  assert.equal(result.providerRetryRequired, true);
});

test('완료된 결제는 Pi 서버 승인을 다시 요청하지 않는다', () => {
  const payment = { id: 'p1', status: 'completed', providerPaymentId: 'pi_1' };
  const result = approvePayment(payment, [payment], 'pi_1');
  assert.equal(result.idempotent, true);
  assert.equal(result.providerRetryRequired, false);
});

test('서버 승인 전에는 결제를 완료하지 않는다', () => {
  const trade = parcelTrade(); const payment = { id: 'p1', status: 'prepared', providerPaymentId: null };
  assert.throws(() => completePayment(payment, [payment], trade, 'tx1'), /approval is required/);
});

test('승인된 결제 완료 시 거래를 발송대기로 바꾼다', () => {
  const trade = parcelTrade(); const payment = { id: 'p1', status: 'approved', providerPaymentId: 'pi1', txid: null };
  completePayment(payment, [payment], trade, 'tx1');
  assert.equal(payment.status, 'completed');
  assert.equal(trade.status, 'shipping_pending');
});

test('동일 완료 요청은 한 번만 반영하고 다른 txid는 거부한다', () => {
  const trade = parcelTrade(); const payment = { id: 'p1', status: 'approved', providerPaymentId: 'pi1', txid: null };
  completePayment(payment, [payment], trade, 'tx1');
  assert.equal(completePayment(payment, [payment], trade, 'tx1').idempotent, true);
  assert.throws(() => completePayment(payment, [payment], trade, 'tx2'), /different txid/);
});

test('다른 결제에서 이미 사용한 txid를 거부한다', () => {
  const trade = parcelTrade(); const one = { id: 'p1', status: 'approved', providerPaymentId: 'pi1', txid: null };
  const two = { id: 'p2', status: 'completed', providerPaymentId: 'pi2', txid: 'tx1' };
  assert.throws(() => completePayment(one, [one, two], trade, 'tx1'), /already linked/);
});

test('본인 거래의 준비·승인 상태만 미완료 목록에 표시한다', () => {
  const items = [
    { id: 'p1', tradeId: 't1', status: 'prepared' },
    { id: 'p2', tradeId: 't2', status: 'approved' },
    { id: 'p3', tradeId: 't1', status: 'completed' }
  ];
  assert.deepEqual(incompletePayments(items, ['t1']).map((item) => item.id), ['p1']);
});
