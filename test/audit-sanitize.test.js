'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeAuditSnapshot, sanitizeAuditEntry } = require('../lib/audit-sanitize');
const { Store, initialState } = require('../lib/store');

test('작업기록 원문에서 인증정보와 Pi 식별값을 재귀적으로 제거한다', () => {
  const clean = sanitizeAuditSnapshot({ id: 'u1', piUid: 'pi-secret', sessions: [{ token: 'session-secret' }], nested: { accessToken: 'access-secret', status: 'active' } });
  assert.deepEqual(clean, { id: 'u1', nested: { status: 'active' } });
  assert.equal(JSON.stringify(clean).includes('secret'), false);
});

test('작업기록에서 상품 사진 원문을 제외하고 운영 상태는 유지한다', () => {
  const clean = sanitizeAuditEntry({ id: 'a1', before: { images: ['large-data'], status: 'under_review' }, after: { imageData: 'large-data', status: 'available' } });
  assert.deepEqual(clean.before, { status: 'under_review' });
  assert.deepEqual(clean.after, { status: 'available' });
});

test('저장소가 기존 작업기록을 불러올 때 민감정보를 자동 정리한다', () => {
  const state = initialState();
  state.auditLogs.push({ id: 'a1', before: { piUid: 'secret', status: 'active' }, after: { sessions: [{ token: 'secret' }], status: 'suspended' } });
  const store = new Store('unused-audit-test.json');
  store.normalizeState(state);
  assert.deepEqual(store.state.auditLogs[0].before, { status: 'active' });
  assert.deepEqual(store.state.auditLogs[0].after, { status: 'suspended' });
  assert.equal(store.auditLogsSanitized, true);
});
