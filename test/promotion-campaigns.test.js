'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { campaignStatus, syncCampaignStatus, createCampaign, endCampaign, recordCampaignEvent } = require('../lib/promotion-campaigns');
test('관리자가 광고·협찬 계약 기간을 등록하고 종료한다', () => {
  const campaign = createCampaign({ id:'c1', productId:'p1', sponsorName:'협력사', type:'sponsorship', placement:'home_banner', startAt:'2026-09-01', endAt:'2026-09-10', adminId:'admin' });
  assert.equal(campaign.status, 'scheduled');
  assert.equal(campaign.placement, 'home_banner');
  endCampaign(campaign, 'admin', '계약 종료'); assert.equal(campaign.status, 'ended');
});
test('잘못된 노출 기간을 차단한다', () => assert.throws(() => createCampaign({ productId:'p1', sponsorName:'광고주', startAt:'2026-09-10', endAt:'2026-09-01' }), /올바른 노출 기간/));

test('노출 위치별 고정 시험 기간으로 종료 시각을 계산한다', () => {
  const banner = createCampaign({ id:'c2', productId:'p1', sponsorName:'광고주', type:'advertising', placement:'home_banner', startAt:'2026-10-23T00:00:00Z', durationDays:1, adminId:'admin' });
  assert.equal(banner.endAt, '2026-10-24T00:00:00.000Z');
  assert.equal(banner.billingMode, 'testnet_free_trial');
  assert.equal(banner.priceStatus, 'not_set');
  assert.throws(() => createCampaign({ productId:'p1', sponsorName:'광고주', placement:'home_banner', startAt:'2026-10-23', durationDays:3 }), /지원하는 기간/);
});

test('시작·종료 시각에 맞춰 예약·노출·기간종료 상태를 자동 계산한다', () => {
  const campaign = createCampaign({ id:'c3', productId:'p1', sponsorName:'협력사', type:'sponsorship', placement:'home_featured', startAt:'2026-10-23T00:00:00Z', durationDays:3, adminId:'admin' });
  assert.equal(campaignStatus(campaign, new Date('2026-10-22T23:00:00Z')), 'scheduled');
  assert.equal(campaignStatus(campaign, new Date('2026-10-24T00:00:00Z')), 'active');
  syncCampaignStatus(campaign, new Date('2026-10-27T00:00:00Z'));
  assert.equal(campaign.status, 'expired');
});

test('진행 중 광고의 노출·클릭·채팅 시작을 분리 집계한다', () => {
  const now = Date.now();
  const campaign = createCampaign({ id:'c4', productId:'p1', sponsorName:'광고주', type:'advertising', placement:'search_top', startAt:new Date(now - 3600000).toISOString(), endAt:new Date(now + 3600000).toISOString(), adminId:'admin' });
  recordCampaignEvent(campaign, 'impression'); recordCampaignEvent(campaign, 'click'); recordCampaignEvent(campaign, 'chat_start');
  assert.deepEqual(campaign.metrics, { impressions:1, clicks:1, chatStarts:1 });
});
