'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('내 마켓의 동적 작업 버튼에 영문 번역을 제공한다', () => {
  assert.match(app, /'수정': 'Edit'/);
  assert.match(app, /'판매 중지': 'Pause sale'/);
  assert.match(app, /'판매재개': 'Resume sale'/);
  assert.match(app, /'상세 ›': 'Details ›'/);
  assert.match(app, /data-edit-product=.*?>수정<\/button>/);
  assert.match(app, /'판매 중지' : '판매재개'/);
});

test('사진 입력은 번역 가능한 전용 선택 버튼을 사용한다', () => {
  assert.equal((html.match(/class="file-picker-button">사진 선택/g) || []).length, 2);
  assert.equal((html.match(/class="file-picker-input"/g) || []).length, 2);
  assert.match(app, /'사진 선택': 'Choose photos'/);
});

test('내 마켓의 사용자 작성 정보는 자동 번역하지 않는다', () => {
  assert.match(app, /<h3 data-user-content>\$\{escapeHtml\(item\.title\)\}<\/h3>/);
  assert.match(app, /<p data-user-content>\$\{escapeHtml\(item\.price\)\} Test-Pi/);
});
