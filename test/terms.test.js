'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { currentTerms, recordRequiredConsents, hasCurrentRequiredConsents } = require('../lib/terms');

test('기존 정책 문서의 시행일을 현재 약관 버전으로 제공한다', () => {
  assert.deepEqual(currentTerms().map(({ id, version }) => ({ id, version })), [
    { id: 'terms_of_service', version: '2026-08-20' },
    { id: 'privacy_policy', version: '2026-08-16' }
  ]);
});

test('현재 필수 약관을 개별 동의해야 버전과 시각을 기록한다', () => {
  const consents = [];
  const submitted = currentTerms().map((term) => ({ id: term.id, version: term.version, accepted: true }));
  const result = recordRequiredConsents(consents, 'user_1', submitted, new Date('2026-10-17T00:00:00Z'));
  assert.equal(result.created.length, 2);
  assert.equal(consents[0].acceptedAt, '2026-10-17T00:00:00.000Z');
  assert.equal(hasCurrentRequiredConsents(consents, 'user_1'), true);
  assert.equal(recordRequiredConsents(consents, 'user_1', submitted).idempotent, true);
});

test('필수 약관 일부 누락이나 과거 버전 제출을 거부한다', () => {
  assert.throws(() => recordRequiredConsents([], 'user_1', [{ id: 'terms_of_service', version: '2026-08-20', accepted: true }]), (error) => error.code === 'REQUIRED_TERMS_NOT_ACCEPTED');
  assert.throws(() => recordRequiredConsents([], 'user_1', currentTerms().map((term) => ({ id: term.id, version: 'old', accepted: true }))), (error) => error.code === 'REQUIRED_TERMS_NOT_ACCEPTED');
});
