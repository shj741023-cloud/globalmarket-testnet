'use strict';

const PROMOTION_PACKAGES = Object.freeze({
  home_banner: Object.freeze([1, 7]),
  home_featured: Object.freeze([3, 7]),
  search_top: Object.freeze([3, 7])
});

const PROMOTION_EVENTS = new Set(['impression', 'click', 'chat_start']);

function campaignStatus(campaign, now = new Date()) {
  if (campaign.status === 'ended') return 'ended';
  const time = now.getTime();
  if (time < new Date(campaign.startAt).getTime()) return 'scheduled';
  if (time >= new Date(campaign.endAt).getTime()) return 'expired';
  return 'active';
}

function syncCampaignStatus(campaign, now = new Date()) {
  const status = campaignStatus(campaign, now);
  const changed = campaign.status !== status;
  campaign.status = status;
  campaign.metrics ||= { impressions: 0, clicks: 0, chatStarts: 0 };
  campaign.billingMode ||= 'testnet_free_trial';
  campaign.priceStatus ||= 'not_set';
  return changed;
}

function createCampaign(input, now = new Date()) {
  const sponsorName = String(input.sponsorName || '').trim();
  const productId = String(input.productId || '').trim();
  const type = String(input.type || 'advertising');
  const placement = String(input.placement || 'home_featured');
  const startAt = new Date(input.startAt);
  const durationDays = Number(input.durationDays || 0);
  const supportedDurations = PROMOTION_PACKAGES[placement] || [];
  const endAt = durationDays > 0 ? new Date(startAt.getTime() + durationDays * 86400000) : new Date(input.endAt);
  if (durationDays > 0 && !supportedDurations.includes(durationDays)) {
    throw Object.assign(new Error('선택한 노출 위치에서 지원하는 기간이 아닙니다.'), { code: 'INVALID_PROMOTION_DURATION', status: 400 });
  }
  if (!sponsorName || !productId || !['advertising', 'sponsorship'].includes(type) || !['home_banner', 'home_featured', 'search_top'].includes(placement) || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw Object.assign(new Error('광고주, 대상 상품, 구분, 올바른 노출 기간이 필요합니다.'), { code: 'INVALID_PROMOTION_CAMPAIGN', status: 400 });
  }
  return {
    id: input.id, sponsorName, productId, type, placement,
    durationDays: durationDays || Math.max(1, Math.round((endAt - startAt) / 86400000)),
    startAt: startAt.toISOString(), endAt: endAt.toISOString(),
    note: String(input.note || '').trim().slice(0, 1000), status: 'scheduled',
    billingMode: 'testnet_free_trial', priceStatus: 'not_set',
    metrics: { impressions: 0, clicks: 0, chatStarts: 0 },
    createdBy: input.adminId, createdAt: now.toISOString()
  };
}

function endCampaign(campaign, adminId, reason, now = new Date()) {
  if (!campaign || !['scheduled', 'active'].includes(campaign.status)) return { campaign, idempotent: true };
  if (!String(reason || '').trim()) throw Object.assign(new Error('종료 사유가 필요합니다.'), { code: 'PROMOTION_END_REASON_REQUIRED', status: 400 });
  campaign.status = 'ended'; campaign.endedAt = now.toISOString(); campaign.endedBy = adminId; campaign.endReason = String(reason).trim().slice(0, 1000);
  return { campaign, idempotent: false };
}

function recordCampaignEvent(campaign, eventType) {
  if (!PROMOTION_EVENTS.has(eventType)) throw Object.assign(new Error('지원하지 않는 광고 측정 항목입니다.'), { code: 'INVALID_PROMOTION_EVENT', status: 400 });
  if (campaignStatus(campaign) !== 'active') throw Object.assign(new Error('진행 중인 광고만 측정할 수 있습니다.'), { code: 'PROMOTION_NOT_ACTIVE', status: 409 });
  campaign.metrics ||= { impressions: 0, clicks: 0, chatStarts: 0 };
  const key = { impression: 'impressions', click: 'clicks', chat_start: 'chatStarts' }[eventType];
  campaign.metrics[key] += 1;
  return campaign.metrics;
}

module.exports = { PROMOTION_PACKAGES, campaignStatus, syncCampaignStatus, createCampaign, endCampaign, recordCampaignEvent };
