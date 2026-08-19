'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertReportTarget } = require('../lib/report-target');

const state = {
  products: [{ id: 'p1', sellerId: 'seller' }],
  trades: [{ id: 't1', buyerId: 'buyer', sellerId: 'seller' }]
};

test('다른 판매자의 실제 상품만 신고할 수 있다', () => {
  assert.equal(assertReportTarget(state, 'buyer', 'product', 'p1').id, 'p1');
  assert.throws(() => assertReportTarget(state, 'seller', 'product', 'p1'), /본인 상품/);
  assert.throws(() => assertReportTarget(state, 'buyer', 'product', 'missing'), /찾을 수 없습니다/);
});

test('거래 당사자만 해당 거래를 신고할 수 있다', () => {
  assert.equal(assertReportTarget(state, 'buyer', 'trade', 't1').id, 't1');
  assert.throws(() => assertReportTarget(state, 'other', 'trade', 't1'), /당사자/);
});

test('지원하지 않는 신고 대상을 차단한다', () => {
  assert.throws(() => assertReportTarget(state, 'buyer', 'user', 'u1'), /상품 또는 거래/);
});
