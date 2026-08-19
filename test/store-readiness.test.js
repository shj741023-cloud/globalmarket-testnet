'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../lib/store');

test('파일 저장소 준비상태를 정상으로 반환한다', async () => {
  const store = new Store('unused-readiness-file.json');
  assert.deepEqual(await store.readiness(), { ok: true, backend: 'file' });
});

test('PostgreSQL 준비상태는 실제 SELECT 1을 실행한다', async () => {
  let query = '';
  const store = new Store('unused-readiness-file.json');
  store.backend = 'postgres';
  store.pool = { query: async (sql) => { query = sql; } };
  assert.deepEqual(await store.readiness(), { ok: true, backend: 'postgres' });
  assert.equal(query, 'SELECT 1');
});

test('PostgreSQL 연결 실패를 준비상태 오류로 전달한다', async () => {
  const store = new Store('unused-readiness-file.json');
  store.pool = { query: async () => { throw new Error('database unavailable'); } };
  await assert.rejects(store.readiness(), /database unavailable/);
});
