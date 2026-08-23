'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWalletAddress } = require('../lib/wallets');

const valid = `G${'A'.repeat(55)}`;

test('Pi 지갑주소를 정규화한다', () => assert.equal(normalizeWalletAddress(valid.toLowerCase()), valid));
test('잘못된 지갑주소를 거절한다', () => assert.throws(() => normalizeWalletAddress('G123'), /56자리/));
test('선택 입력은 빈 지갑주소를 허용한다', () => assert.equal(normalizeWalletAddress(''), ''));
