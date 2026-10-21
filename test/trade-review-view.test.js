'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('거래 상세에 작성한 후기와 체크리스트 상품명을 표시한다', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /이 거래의 후기/);
  assert.match(app, /내가 작성한 후기/);
  assert.match(app, /trade\.purpose === 'pi_checklist' \? 'Testnet 기능시험'/);
});
