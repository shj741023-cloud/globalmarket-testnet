'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWalletAddress, walletAddressFingerprint } = require('../lib/wallets');
const valid = `G${'A'.repeat(55)}`;
test('Pi 지갑주소를 정규화한다', () => assert.equal(normalizeWalletAddress(valid.toLowerCase()), valid));
test('잘못된 지갑주소를 거절한다', () => assert.throws(() => normalizeWalletAddress('G123'), /56자리/));
test('선택 입력은 빈 지갑주소를 허용한다', () => assert.equal(normalizeWalletAddress(''), ''));
test('지갑주소 확인 기록은 원문 대신 해시와 끝자리만 사용한다', () => {
  const fingerprint = walletAddressFingerprint(valid);
  assert.match(fingerprint.hash, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint.suffix, valid.slice(-6));
  assert.doesNotMatch(JSON.stringify(fingerprint), new RegExp(valid));
});
