'use strict';

const WALLET_PATTERN = /^G[A-Z2-7]{55}$/;

function normalizeWalletAddress(value, { required = false } = {}) {
  const address = String(value || '').trim().toUpperCase();
  if (!address && !required) return '';
  if (!WALLET_PATTERN.test(address)) {
    throw Object.assign(new Error('Pi 지갑주소는 G로 시작하는 56자리 주소여야 합니다.'), { code: 'INVALID_WALLET_ADDRESS', status: 400 });
  }
  return address;
}

module.exports = { WALLET_PATTERN, normalizeWalletAddress };
