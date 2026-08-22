'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSuggestion, closeSuggestion } = require('../lib/suggestions');

test('건의사항을 접수하고 공백을 정리한다', () => {
  const item = createSuggestion({ id: 'suggestion_1', userId: 'user_1', content: '  검색 기능을 개선해주세요.  ', now: '2026-08-22T00:00:00.000Z' });
  assert.equal(item.content, '검색 기능을 개선해주세요.');
  assert.equal(item.status, 'received');
});

test('너무 짧거나 긴 건의사항을 거절한다', () => {
  assert.throws(() => createSuggestion({ id: 's', userId: 'u', content: '짧음' }), /5자 이상/);
  assert.throws(() => createSuggestion({ id: 's', userId: 'u', content: '가'.repeat(501) }), /500자 이하/);
});

test('관리자 처리 결과를 저장하고 중복 처리는 안전하다', () => {
  const item = createSuggestion({ id: 's', userId: 'u', content: '상품 검색 개선 요청', now: '2026-08-22T00:00:00.000Z' });
  assert.equal(closeSuggestion(item, '다음 배포에 반영합니다.', '2026-08-22T01:00:00.000Z').idempotent, false);
  assert.equal(item.status, 'closed');
  assert.equal(closeSuggestion(item, '다시 처리').idempotent, true);
});
