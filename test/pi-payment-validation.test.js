'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertProviderPayment } = require('../lib/pi-payment-validation');

const expected = { providerPaymentId: 'pi_1', internalPaymentId: 'payment_1', tradeId: 'trade_1', piUid: 'uid_1', amount: 101, txid: 'tx_1' };
const provider = () => ({
  identifier: 'pi_1', user_uid: 'uid_1', amount: 101, direction: 'user_to_app', network: 'Pi Testnet',
  metadata: { internalPaymentId: 'payment_1', tradeId: 'trade_1' },
  status: { developer_approved: true, transaction_verified: true, developer_completed: true, cancelled: false, user_cancelled: false },
  transaction: { txid: 'tx_1', verified: true }
});

test('승인 응답의 사용자·금액·Testnet·내부 거래 연결을 검증한다', () => {
  assert.equal(assertProviderPayment(provider(), expected, 'approve').identifier, 'pi_1');
  for (const mutate of [
    (item) => { item.user_uid = 'other'; },
    (item) => { item.amount = 1; },
    (item) => { item.network = 'Pi Network'; },
    (item) => { item.metadata.tradeId = 'other'; },
    (item) => { item.direction = 'app_to_user'; }
  ]) {
    const item = provider(); mutate(item);
    assert.throws(() => assertProviderPayment(item, expected, 'approve'), /does not match|not on Pi Testnet|not user_to_app/);
  }
});

test('완료 응답은 블록체인 검증·서버 완료·txid 일치를 모두 요구한다', () => {
  assert.equal(assertProviderPayment(provider(), expected, 'complete').transaction.txid, 'tx_1');
  const unverified = provider(); unverified.status.transaction_verified = false;
  assert.throws(() => assertProviderPayment(unverified, expected, 'complete'), /not verified/);
  const incomplete = provider(); incomplete.status.developer_completed = false;
  assert.throws(() => assertProviderPayment(incomplete, expected, 'complete'), /not completed/);
  const wrongTxid = provider(); wrongTxid.transaction.txid = 'other';
  assert.throws(() => assertProviderPayment(wrongTxid, expected, 'complete'), /does not match/);
});
