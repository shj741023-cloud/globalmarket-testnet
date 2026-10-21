'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const render = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const checklist = fs.readFileSync(path.join(root, 'RELEASE_CHECKLIST.md'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

test('배포 예시에 Testnet 전용 환경을 명시한다', () => {
  for (const text of [envExample, render]) {
    assert.match(text, /APP_NETWORK[\s\S]*testnet/);
    assert.match(text, /PI_SANDBOX[\s\S]*true/);
  }
});

test('출시 상태는 Testnet·PostgreSQL·Pi 서버 키를 모두 확인한다', () => {
  assert.match(app, /api\/v1\/config/);
  assert.match(app, /ready\.storage === 'postgres'/);
  assert.match(app, /config\.piServerConnected === true/);
  assert.match(app, /Testnet·Pi·DB 정상/);
});

test('출시 체크리스트는 자동 완료와 외부 수동 작업을 구분한다', () => {
  assert.match(checklist, /코드 및 로컬 검증 완료/);
  assert.match(checklist, /Pi Developer Portal 및 Pi Browser 수동 확인/);
  assert.match(checklist, /실제 Test-Pi 거래, Portal 제출, 배포 및 운영환경 변경은 사용자 승인 후 수행/);
  assert.match(checklist, /Mainnet은 코드에서 차단/);
});

test('중첩된 과거 GitHub 업로드용 사본은 보존하되 Git 추적에서 제외한다', () => {
  assert.match(gitignore, /^Global Market Testnet GitHub 업로드용\/$/m);
  assert.match(checklist, /중첩된 과거 `Global Market Testnet GitHub 업로드용` 사본은 보존/);
});
