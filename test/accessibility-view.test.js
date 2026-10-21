'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('상품 검색 필드는 모바일 스크린리더용 이름을 제공한다', () => {
  const labels = ['상품명 또는 설명 검색', '상품 카테고리', '거래 방식', '상품 정렬', '최저 가격', '최고 가격'];
  for (const label of labels) assert.match(html, new RegExp(`aria-label="${label}"`));
});

test('동적 상태 영역과 주요 내비게이션에 접근성 정보가 있다', () => {
  assert.match(html, /id="notificationBadge"[^>]*>0<\/span>/);
  assert.match(html, /id="paymentResult"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /class="bottom-nav"[^>]*aria-label="기본 메뉴"/);
});
