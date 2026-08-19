'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../lib/store');

test('겹친 PostgreSQL 저장을 요청 순서대로 완료한다', async () => {
  const writes = [];
  const store = new Store('unused-test-file.json');
  store.pool = {
    query: async (_sql, values) => {
      await new Promise((resolve) => setTimeout(resolve, writes.length ? 1 : 5));
      writes.push(JSON.parse(values[1]));
    }
  };
  store.state.meta.revision = 1;
  const first = store.save();
  store.state.meta.revision = 2;
  const second = store.save();
  await Promise.all([first, second]);
  assert.deepEqual(writes.map((item) => item.meta.revision), [1, 2]);
});

test('이전 PostgreSQL 저장 실패 후 다음 저장을 계속 처리한다', async () => {
  let attempts = 0;
  const store = new Store('unused-test-file.json');
  store.pool = {
    query: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary database error');
    }
  };
  await assert.rejects(store.save(), /temporary database error/);
  await store.save();
  assert.equal(attempts, 2);
});
