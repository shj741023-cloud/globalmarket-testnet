'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('정책 문서는 Testnet 저장소와 현재 가스비 정책을 일치시킨다', () => {
  const privacy = fs.readFileSync(path.join(__dirname, '..', 'public', 'privacy.html'), 'utf8');
  const terms = fs.readFileSync(path.join(__dirname, '..', 'public', 'terms.html'), 'utf8');
  assert.match(privacy, /Neon PostgreSQL/);
  assert.match(privacy, /시험 데이터 조회·정정·삭제/);
  assert.match(privacy, /시행일: 2026년 8월 22일/);
  assert.match(terms, /상대방이나 플랫폼에 가스비 보상을 청구하지 않습니다/);
  assert.match(terms, /기업 판매를 지원하지 않습니다/);
  assert.match(terms, /시행일: 2026년 8월 22일/);
});
