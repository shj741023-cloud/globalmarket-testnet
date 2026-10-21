'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { enableChatDirectTrade, getConfirmedDirectWalletAddress, assertDirectWalletChangeAllowed, assertDirectWalletReady, assertDirectWalletRegistrationStage, confirmDirectWalletForStart } = require('../lib/chat-direct');
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

test('직거래 지갑주소는 양쪽이 직거래 조건을 확인한 뒤에만 반환한다', () => {
  const product = { directWalletAddress: wallet };
  const direct = { type: 'direct', buyerConfirmedAt: '2026-10-20T00:00:00.000Z', sellerConfirmedAt: '2026-10-20T00:01:00.000Z' };
  assert.equal(getConfirmedDirectWalletAddress(product, direct), wallet);
  assert.equal(getConfirmedDirectWalletAddress(product, { ...direct, buyerConfirmedAt: null }), null);
  assert.equal(getConfirmedDirectWalletAddress(product, { ...direct, sellerConfirmedAt: null }), null);
  assert.equal(getConfirmedDirectWalletAddress(product, { ...direct, type: 'parcel_testnet' }), null);
  assert.equal(getConfirmedDirectWalletAddress({}, direct), null);
});

test('거래조건 확인 후 지갑주소 바꿔치기를 차단하되 같은 주소 재등록은 허용한다', () => {
  const otherWallet = `G${'B'.repeat(55)}`;
  const product = { directWalletAddress: wallet };
  assert.equal(assertDirectWalletChangeAllowed(product, wallet.toLowerCase(), { buyerConfirmedAt: '2026-10-20T00:00:00.000Z' }), wallet);
  assert.throws(
    () => assertDirectWalletChangeAllowed(product, otherWallet, { buyerConfirmedAt: '2026-10-20T00:00:00.000Z' }),
    (error) => error.code === 'WALLET_ADDRESS_LOCKED'
  );
  assert.throws(
    () => assertDirectWalletChangeAllowed(product, otherWallet, { sellerConfirmedAt: '2026-10-20T00:00:00.000Z' }),
    (error) => error.code === 'WALLET_ADDRESS_LOCKED'
  );
  assert.equal(assertDirectWalletChangeAllowed(product, otherWallet, null), otherWallet);
});

test('판매자 지갑주소 등록 전에는 직거래 생성만 차단한다', () => {
  assert.throws(() => assertDirectWalletReady({}, 'direct'), (error) => error.code === 'DIRECT_WALLET_REQUIRED');
  assert.doesNotThrow(() => assertDirectWalletReady({ directWalletAddress: wallet }, 'direct'));
  assert.doesNotThrow(() => assertDirectWalletReady({}, 'parcel_testnet'));
});

test('양쪽이 직거래 조건을 확인한 뒤에만 판매자가 지갑주소를 등록한다', () => {
  const confirmed = { type: 'direct', buyerConfirmedAt: '2026-10-20T00:00:00.000Z', sellerConfirmedAt: '2026-10-20T00:01:00.000Z' };
  assert.doesNotThrow(() => assertDirectWalletRegistrationStage(confirmed));
  assert.throws(() => assertDirectWalletRegistrationStage({ ...confirmed, buyerConfirmedAt: null }), (error) => error.code === 'DIRECT_AGREEMENT_REQUIRED');
  assert.throws(() => assertDirectWalletRegistrationStage({ ...confirmed, type: 'parcel_testnet' }), (error) => error.code === 'DIRECT_AGREEMENT_REQUIRED');
  assert.throws(() => assertDirectWalletRegistrationStage(null), (error) => error.code === 'DIRECT_AGREEMENT_REQUIRED');
});

test('구매자가 화면에서 본 현재 지갑주소와 일치해야 직거래 시작 확인을 기록한다', () => {
  const agreement = { type: 'direct', buyerId: 'buyer' };
  const product = { directWalletAddress: wallet };
  confirmDirectWalletForStart(agreement, product, 'buyer', { walletAddressConfirmed: true, walletAddress: wallet }, new Date('2026-10-20T02:00:00.000Z'));
  assert.equal(agreement.confirmedWalletAddress, undefined);
  assert.match(agreement.confirmedWalletAddressHash, /^[a-f0-9]{64}$/);
  assert.equal(agreement.confirmedWalletAddressSuffix, wallet.slice(-6));
  assert.equal(agreement.walletAddressConfirmedAt, '2026-10-20T02:00:00.000Z');
  assert.throws(() => confirmDirectWalletForStart({ type: 'direct', buyerId: 'buyer' }, product, 'seller', { walletAddressConfirmed: true, walletAddress: wallet }), (error) => error.code === 'DIRECT_BUYER_REQUIRED');
  assert.throws(() => confirmDirectWalletForStart({ type: 'direct', buyerId: 'buyer' }, product, 'buyer', { walletAddressConfirmed: false, walletAddress: wallet }), (error) => error.code === 'DIRECT_WALLET_CONFIRMATION_REQUIRED');
  assert.throws(() => confirmDirectWalletForStart({ type: 'direct', buyerId: 'buyer' }, product, 'buyer', { walletAddressConfirmed: true, walletAddress: `G${'C'.repeat(55)}` }), (error) => error.code === 'DIRECT_WALLET_CONFIRMATION_REQUIRED');
});
