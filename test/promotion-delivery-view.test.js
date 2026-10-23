'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('공개 화면은 광고·협찬을 명확히 표시하고 성과 이벤트를 연결한다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(html, /id="promotionBannerSection"/);
  assert.match(html, /id="promotedProductsSection"/);
  assert.match(app, /\/api\/v1\/promotions\/active/);
  assert.match(app, /trackPromotion\(item\.id, 'impression'\)/);
  assert.match(app, /trackPromotion\(promotionId, 'click'\)/);
  assert.match(app, /trackPromotion\(state\.selectedPromotionId, 'chat_start'\)/);
  assert.match(app, /Testnet 무료 기능시험/);
});

test('서버는 광고 공개 조회와 측정 API를 제공하고 실제 결제를 연결하지 않는다', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /pathname === '\/api\/v1\/promotions\/active'/);
  assert.match(server, /promotions\\\/\(\[\^\/\]\+\)\\\/events/);
  assert.match(server, /billingMode: 'testnet_free_trial'/);
  assert.match(server, /priceStatus: 'not_set'/);
  assert.doesNotMatch(server, /promotion.*createPayment/i);
});
