'use strict';

function moderationQueue(state) {
  return (state.products || [])
    .filter((item) => item.status === 'under_review')
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      methods: item.methods,
      region: item.region,
      images: (item.images || []).slice(0, 3),
      reviewReasons: item.reviewReasons || [],
      sellerUsername: (state.users || []).find((user) => user.id === item.sellerId)?.username || 'Pi 사용자',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || null
    }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function moderateProduct(product, decision, reason, now = new Date()) {
  if (!product || product.status !== 'under_review') throw Object.assign(new Error('검토 중인 상품만 판정할 수 있습니다.'), { code: 'PRODUCT_REVIEW_REQUIRED', status: 409 });
  if (!['approve', 'reject'].includes(decision) || !String(reason || '').trim()) throw Object.assign(new Error('승인 또는 거절과 판정 사유가 필요합니다.'), { code: 'INVALID_PRODUCT_DECISION', status: 400 });
  product.status = decision === 'approve' ? 'available' : 'rejected';
  product.moderation = { decision, reason: String(reason).trim().slice(0, 1000), decidedAt: now.toISOString() };
  product.updatedAt = now.toISOString();
  return product;
}

module.exports = { moderationQueue, moderateProduct };
