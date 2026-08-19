'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deploymentRevision } = require('../lib/runtime');

test('Render Git 커밋의 앞 7자를 배포 버전으로 표시한다', () => {
  assert.equal(deploymentRevision({ RENDER_GIT_COMMIT: 'C43BD0A1234567890' }), 'c43bd0a');
});

test('배포 커밋이 없거나 형식이 이상하면 local로 표시한다', () => {
  assert.equal(deploymentRevision({}), 'local');
  assert.equal(deploymentRevision({ RENDER_GIT_COMMIT: 'not-a-commit' }), 'local');
});
