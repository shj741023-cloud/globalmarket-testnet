'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const managementCss = fs.readFileSync(path.join(root, 'public', 'management.css'), 'utf8');

test('복구된 추천상품과 문의·건의 화면이 API에 연결된다', () => {
  for (const id of ['popularProducts', 'suggestionForm', 'mySuggestions', 'adminSuggestions', 'adminPopular', 'adminPromotions']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /\/api\/v1\/popular-products/);
  assert.match(app, /\/api\/v1\/suggestions/);
  assert.match(app, /\/api\/v1\/admin\/promotion-campaigns/);
});

test('가스비 보상 화면은 Testnet 모의지급 API만 사용한다', () => {
  assert.match(html, /id="gasCompensations"/);
  assert.match(app, /gas-compensation-payouts\/mock-batch/);
  assert.doesNotMatch(app, /mainnet/i);
  assert.match(server, /gas-compensation-payouts\/mock-batch/);
});

test('공개 상품 응답에서 개인 지갑주소 원문을 제외한다', () => {
  const view = fs.readFileSync(path.join(root, 'lib', 'product-view.js'), 'utf8');
  assert.match(view, /directWalletAddress/);
  assert.match(view, /directWalletAvailable/);
  assert.doesNotMatch(server, /product: store\.findProduct\((?:trade|room)\.productId\) \|\| null/);
});

test('직거래 지갑은 QR이나 미확인 딥링크 없이 당사자 전용 복사 흐름을 사용한다', () => {
  assert.match(html, /id="directWalletBox"/);
  assert.match(app, /지갑주소 복사/);
  assert.match(app, /https:\/\/wallet\.pinet\.com/);
  assert.match(app, /Pi Wallet 열기/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(server, /getConfirmedDirectWalletAddress/);
  assert.doesNotMatch(app, /qrcode|pi:\/\/wallet/i);
  assert.match(server, /direct_wallet_registered/);
  assert.match(app, /chatNotificationTypes/);
  assert.match(managementCss, /\.button-link/);
  assert.match(managementCss, /focus-visible/);
  assert.match(managementCss, /overflow-wrap:\s*anywhere/);
});
