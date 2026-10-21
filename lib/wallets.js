'use strict';

const crypto = require('node:crypto');

const WALLET_PATTERN = /^G[A-Z2-7]{55}$/;

function normalizeWalletAddress(value, { required = false } = {}) {
  const address = String(value || '').trim().toUpperCase();
  if (!address && !required) return '';
  if (!WALLET_PATTERN.test(address)) {
    throw Object.assign(new Error('Pi 지갑주소는 G로 시작하는 56자리 주소여야 합니다.'), { code: 'INVALID_WALLET_ADDRESS', status: 400 });
  }
  return address;
}

function walletAddressFingerprint(value) {
  const address = normalizeWalletAddress(value, { required: true });
  return {
    hash: crypto.createHash('sha256').update(address, 'utf8').digest('hex'),
    suffix: address.slice(-6)
  };
}

module.exports = { WALLET_PATTERN, normalizeWalletAddress, walletAddressFingerprint };
