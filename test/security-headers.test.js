'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONTENT_SECURITY_POLICY, securityHeaders } = require('../lib/security-headers');

test('콘텐츠 보안 정책은 자체 자원과 공식 Pi 도메인만 허용한다', () => {
  assert.match(CONTENT_SECURITY_POLICY, /script-src 'self' https:\/\/sdk\.minepi\.com/);
  assert.match(CONTENT_SECURITY_POLICY, /img-src 'self' data:/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /frame-ancestors/);
});

test('모든 응답에 기본 보안 헤더를 제공한다', () => {
  const headers = securityHeaders();
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
  assert.match(headers['Strict-Transport-Security'], /max-age=31536000/);
  assert.equal(headers['Content-Security-Policy'], undefined);
  assert.equal(headers['Content-Security-Policy-Report-Only'], CONTENT_SECURITY_POLICY);
});
