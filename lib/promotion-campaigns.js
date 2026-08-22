'use strict';

function createCampaign(input, now = new Date()) {
  const sponsorName = String(input.sponsorName || '').trim();
  const productId = String(input.productId || '').trim();
  const type = String(input.type || 'advertising');
  const placement = String(input.placement || 'home_featured');
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (!sponsorName || !productId || !['advertising', 'sponsorship'].includes(type) || !['home_banner', 'home_featured', 'search_top'].includes(placement) || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw Object.assign(new Error('광고주, 대상 상품, 구분, 올바른 노출 기간이 필요합니다.'), { code: 'INVALID_PROMOTION_CAMPAIGN', status: 400 });
  }
  return { id: input.id, sponsorName, productId, type, placement, startAt: startAt.toISOString(), endAt: endAt.toISOString(), note: String(input.note || '').trim().slice(0, 1000), status: 'scheduled', createdBy: input.adminId, createdAt: now.toISOString() };
}

function endCampaign(campaign, adminId, reason, now = new Date()) {
  if (!campaign || !['scheduled', 'active'].includes(campaign.status)) return { campaign, idempotent: true };
  if (!String(reason || '').trim()) throw Object.assign(new Error('종료 사유가 필요합니다.'), { code: 'PROMOTION_END_REASON_REQUIRED', status: 400 });
  campaign.status = 'ended'; campaign.endedAt = now.toISOString(); campaign.endedBy = adminId; campaign.endReason = String(reason).trim().slice(0, 1000);
  return { campaign, idempotent: false };
}

module.exports = { createCampaign, endCampaign };
