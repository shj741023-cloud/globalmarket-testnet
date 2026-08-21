'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('휴대폰 관리자 탭과 카드는 화면 폭 안에서 줄바꿈한다', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'management.css'), 'utf8');
  assert.match(css, /\.management-tabs \{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.management-card \{[^}]*min-width:\s*0/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.management-card \{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.admin-report-card select[^}]*min-width:\s*0/);
});
