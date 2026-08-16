'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DIRECT_PAYMENT_METHOD, createDirectRecord, updateDirectSchedule, completeDirect, cancelDirect } = require('../lib/direct');

const directTrade = () => ({ id: 't1', type: 'direct', sellerId: 'seller', buyerId: 'buyer', status: 'meeting_agreed' });
const input = { userId: 'buyer', noticeAccepted: true, scheduledAt: '2026-08-15T03:00:00Z', place: '서울역', paymentMethod: DIRECT_PAYMENT_METHOD };

test('본인 책임 안내 확인 전에는 직거래 약속을 만들지 않는다', () => {
  assert.throws(() => createDirectRecord(directTrade(), { ...input, noticeAccepted: false }), /Own-risk notice/);
});

test('시간·장소·개인 Pi 지갑 송금을 기록한다', () => {
  const record = createDirectRecord(directTrade(), input);
  assert.equal(record.place, '서울역');
  assert.equal(record.paymentMethod, DIRECT_PAYMENT_METHOD);
});

test('직거래에서 Pi 이외의 결제방법을 차단한다', () => {
  assert.throws(() => createDirectRecord(directTrade(), { ...input, paymentMethod: 'cash' }), /only allow a personal Pi wallet/);
});

test('거래 당사자가 아니면 약속을 변경할 수 없다', () => {
  const trade = directTrade(); const record = createDirectRecord(trade, input);
  assert.throws(() => updateDirectSchedule(trade, record, { userId: 'other', place: '다른 장소' }), /party required/);
});

test('양쪽이 완료 표시해야 직거래가 완료된다', () => {
  const trade = directTrade(); const record = createDirectRecord(trade, input);
  completeDirect(trade, record, 'buyer'); assert.notEqual(trade.status, 'completed');
  completeDirect(trade, record, 'seller'); assert.equal(trade.status, 'completed');
});

test('완료 표시는 당사자별로 중복 반영하지 않는다', () => {
  const trade = directTrade(); const record = createDirectRecord(trade, input);
  completeDirect(trade, record, 'buyer');
  assert.equal(completeDirect(trade, record, 'buyer').idempotent, true);
});

test('완료 전에는 당사자가 직거래를 취소할 수 있다', () => {
  const trade = directTrade(); const record = createDirectRecord(trade, input);
  cancelDirect(trade, record, 'buyer', '일정 변경');
  assert.equal(trade.status, 'canceled');
});

test('직거래 기록에는 플랫폼 결제·정산·환불 필드가 없다', () => {
  const record = createDirectRecord(directTrade(), input);
  assert.equal(Object.hasOwn(record, 'paymentId'), false);
  assert.equal(Object.hasOwn(record, 'settlementId'), false);
  assert.equal(Object.hasOwn(record, 'refundId'), false);
});
