'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProposal, respondProposal, cancelProposal, createOrUpdateAgreement, confirmAgreement, tradeFromAgreement, assertTradeStarter } = require('../lib/agreements');

const room = { id: 'r1', sellerId: 'seller', buyerId: 'buyer' };
const product = { id: 'p1', methods: ['direct', 'parcel_testnet'] };

test('채팅 당사자만 가격을 제안할 수 있다', () => {
  const proposal = createProposal(room, { id: 'x', proposerId: 'buyer', price: 10 });
  assert.equal(proposal.recipientId, 'seller');
  assert.throws(() => createProposal(room, { id: 'y', proposerId: 'other', price: 10 }), /chat parties/);
});

test('가격제안 수락·거절은 상대방만 할 수 있다', () => {
  const proposal = createProposal(room, { id: 'x', proposerId: 'buyer', price: 10 });
  assert.throws(() => respondProposal(proposal, 'buyer', 'accepted'), /recipient/);
  assert.equal(respondProposal(proposal, 'seller', 'accepted').proposal.status, 'accepted');
});

test('대기 중 가격제안은 제안자만 취소할 수 있고 반복 요청은 안전하다', () => {
  const proposal = createProposal(room, { id: 'x', proposerId: 'buyer', price: 10 });
  assert.throws(() => cancelProposal(proposal, 'seller'), /proposer/);
  assert.equal(cancelProposal(proposal, 'buyer').proposal.status, 'cancelled');
  assert.equal(cancelProposal(proposal, 'buyer').idempotent, true);
});

test('거래 합의는 허용된 방식과 양수 가격만 사용한다', () => {
  assert.throws(() => createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 0, type: 'direct' }), /positive/);
  assert.throws(() => createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'mainnet' }), /not supported/);
});

test('합의 조건이 바뀌면 양쪽 확인을 모두 해제한다', () => {
  const agreement = createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'direct' });
  confirmAgreement(agreement, 'buyer'); confirmAgreement(agreement, 'seller');
  assert.equal(agreement.status, 'confirmed');
  createOrUpdateAgreement(agreement, room, product, { actorId: 'seller', price: 11, type: 'direct' });
  assert.equal(agreement.status, 'pending_confirmation');
  assert.equal(agreement.buyerConfirmedAt, null);
  assert.equal(agreement.sellerConfirmedAt, null);
  assert.equal(agreement.version, 2);
});

test('양쪽이 확인해야 합의가 확정된다', () => {
  const agreement = createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'parcel_testnet' });
  confirmAgreement(agreement, 'buyer'); assert.equal(agreement.status, 'pending_confirmation');
  confirmAgreement(agreement, 'seller'); assert.equal(agreement.status, 'confirmed');
});

test('확정 전에는 거래를 생성하지 않는다', () => {
  const agreement = createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'direct' });
  assert.throws(() => tradeFromAgreement(agreement, null, { id: 't' }), /Both parties/);
});

test('확정 합의의 가격과 방식으로 거래를 생성한다', () => {
  const agreement = createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'parcel_testnet' });
  confirmAgreement(agreement, 'buyer'); confirmAgreement(agreement, 'seller');
  const result = tradeFromAgreement(agreement, null, { id: 't' });
  assert.equal(result.trade.amount, 10);
  assert.equal(result.trade.type, 'parcel_testnet');
  assert.equal(result.trade.status, 'payment_pending');
});

test('같은 합의로 거래를 중복 생성하지 않는다', () => {
  const agreement = createOrUpdateAgreement(null, room, product, { id: 'a', actorId: 'buyer', price: 10, type: 'direct' });
  confirmAgreement(agreement, 'buyer'); confirmAgreement(agreement, 'seller');
  const first = tradeFromAgreement(agreement, null, { id: 't' }).trade;
  const second = tradeFromAgreement(agreement, first, { id: 't2' });
  assert.equal(second.idempotent, true);
  assert.equal(second.trade.id, 't');
});

test('직거래는 지갑주소를 확인할 구매자만 시작할 수 있다', () => {
  const direct = { sellerId: 'seller', buyerId: 'buyer', type: 'direct' };
  assert.doesNotThrow(() => assertTradeStarter(direct, 'buyer'));
  assert.throws(() => assertTradeStarter(direct, 'seller'), (error) => error.code === 'DIRECT_BUYER_REQUIRED');
  assert.throws(() => assertTradeStarter(direct, 'other'), (error) => error.code === 'AGREEMENT_PARTY_REQUIRED');
  assert.doesNotThrow(() => assertTradeStarter({ ...direct, type: 'parcel_testnet' }, 'seller'));
});
