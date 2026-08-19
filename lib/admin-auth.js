'use strict';

const crypto = require('node:crypto');

function adminKeyMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function requestIdentity(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

module.exports = { adminKeyMatches, requestIdentity };
