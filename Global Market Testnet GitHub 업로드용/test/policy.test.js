'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { paymentQuote, assertTestnetEnvironment, assertFinancialTradeAllowed } = require('../lib/policy');

test('100 Test-Pi에 구매자와 판매자 모의 수수료 1%를 계산한다', () => {
  const quote = paymentQuote(100, 0);
  assert.equal(quote.buyerFee, 1);
  assert.equal(quote.sellerFee, 1);
  assert.equal(quote.buyerTotal, 101);
  assert.equal(quote.sellerExpectedSettlement, 99);
  assert.equal(quote.isSimulation, true);
});

test('최소 수수료 없이 낮은 금액도 정확히 1%를 계산한다', () => {
  const quote = paymentQuote(0.1, 0);
  assert.equal(quote.buyerFee, 0.001);
  assert.equal(quote.sellerFee, 0.001);
});

test('Mainnet 설정을 차단한다', () => {
  assert.throws(() => assertTestnetEnvironment({ APP_NETWORK: 'mainnet', PI_SANDBOX: 'false' }), /Mainnet is disabled/);
});

test('직거래 금융기능을 차단한다', () => {
  assert.throws(() => assertFinancialTradeAllowed({ type: 'direct' }), /not available for direct trades/);
});

test('Testnet 택배 거래의 금융 시험만 허용한다', () => {
  assert.doesNotThrow(() => assertFinancialTradeAllowed({ type: 'parcel_testnet' }));
});
