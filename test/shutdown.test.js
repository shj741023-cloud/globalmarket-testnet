'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShutdownHandler } = require('../lib/shutdown');

test('HTTP 서버 종료 뒤 저장 대기열과 PostgreSQL 연결을 닫는다', async () => {
  const order = [];
  const server = { close: (callback) => { order.push('server'); callback(); } };
  const store = { close: async () => { order.push('store'); } };
  const logger = { log() {}, error() {} };
  const shutdown = createShutdownHandler({ server, store, logger });
  const result = await shutdown('SIGTERM');
  assert.deepEqual(order, ['server', 'store']);
  assert.equal(result.idempotent, false);
});

test('정상 종료 신호를 반복해도 한 번만 처리한다', async () => {
  let closes = 0;
  const server = { close: (callback) => { closes += 1; callback(); } };
  const store = { close: async () => {} };
  const logger = { log() {}, error() {} };
  const shutdown = createShutdownHandler({ server, store, logger });
  await shutdown('SIGTERM');
  const repeated = await shutdown('SIGINT');
  assert.equal(closes, 1);
  assert.equal(repeated.idempotent, true);
});

test('서버 종료 실패를 기록하고 안전하게 반환한다', async () => {
  const errors = [];
  const server = { close: (callback) => callback(new Error('close failed')) };
  const store = { close: async () => {} };
  const logger = { log() {}, error: (...values) => errors.push(values.join(' ')) };
  const shutdown = createShutdownHandler({ server, store, logger });
  const result = await shutdown('SIGTERM');
  assert.match(result.error.message, /close failed/);
  assert.match(errors[0], /GRACEFUL_SHUTDOWN_FAILED/);
  process.exitCode = 0;
});
