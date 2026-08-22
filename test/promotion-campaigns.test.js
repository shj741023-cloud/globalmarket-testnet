'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCampaign, endCampaign } = require('../lib/promotion-campaigns');
test('관리자가 광고·협찬 계약 기간을 등록하고 종료한다', () => {
  const campaign = createCampaign({ id:'c1', productId:'p1', sponsorName:'협력사', type:'sponsorship', placement:'home_banner', startAt:'2026-09-01', endAt:'2026-09-10', adminId:'admin' });
  assert.equal(campaign.status, 'scheduled');
  assert.equal(campaign.placement, 'home_banner');
  endCampaign(campaign, 'admin', '계약 종료'); assert.equal(campaign.status, 'ended');
});
test('잘못된 노출 기간을 차단한다', () => assert.throws(() => createCampaign({ productId:'p1', sponsorName:'광고주', startAt:'2026-09-10', endAt:'2026-09-01' }), /올바른 노출 기간/));
