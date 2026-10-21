'use strict';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' https://sdk.minepi.com",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.minepi.com https://*.pinet.com",
  "frame-src https://*.minepi.com https://*.pinet.com",
  "form-action 'self'",
  'upgrade-insecure-requests'
].join('; ');

const securityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000'
});

module.exports = { CONTENT_SECURITY_POLICY, securityHeaders };
