'use strict';

function allowedOrigins(extra = '', options = {}) {
  const nodeEnv = String(options.nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase();
  const defaults = [
    'https://globalmarket-testnet.onrender.com',
    'https://globalmarket2678.pinet.com'
  ];
  if (['development', 'test'].includes(nodeEnv)) defaults.push('http://localhost:3000');
  return new Set([
    ...defaults,
    ...String(extra).split(',').map((item) => item.trim()).filter(Boolean)
  ]);
}

function isMutationOriginAllowed(input) {
  if (!['POST', 'PATCH', 'DELETE'].includes(input.method)) return true;
  if (String(input.authorization || '').startsWith('Bearer ')) return true;
  if (!input.origin) return true;
  return allowedOrigins(input.extraOrigins, { nodeEnv: input.nodeEnv }).has(String(input.origin));
}

function assertActiveUser(user) {
  if (!user || user.status !== 'active') {
    throw Object.assign(new Error('사용할 수 없는 계정입니다.'), { code: 'USER_NOT_ACTIVE', status: 403 });
  }
  return user;
}

module.exports = { allowedOrigins, isMutationOriginAllowed, assertActiveUser };
