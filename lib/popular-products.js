'use strict';

function listPopularProducts(products) {
  return (products || [])
    .filter((item) => ['available', 'reserved'].includes(item.status) && item.popularPlacement?.selectedAt)
    .slice()
    .sort((a, b) => String(b.popularPlacement.selectedAt).localeCompare(String(a.popularPlacement.selectedAt)));
}

function setPopularProduct(product, selected, adminId, reason, now = new Date()) {
  if (!product || !['available', 'reserved'].includes(product.status)) {
    throw Object.assign(new Error('판매 중인 상품만 인기 상품으로 선정할 수 있습니다.'), { code: 'POPULAR_PRODUCT_NOT_ELIGIBLE', status: 409 });
  }
  if (typeof selected !== 'boolean' || !String(reason || '').trim()) {
    throw Object.assign(new Error('선정 여부와 관리 사유가 필요합니다.'), { code: 'INVALID_POPULAR_PRODUCT_DECISION', status: 400 });
  }
  const alreadySelected = Boolean(product.popularPlacement?.selectedAt);
  if (alreadySelected === selected) return { product, idempotent: true };
  product.popularPlacement = selected ? { selectedAt: now.toISOString(), selectedBy: adminId } : null;
  product.updatedAt = now.toISOString();
  return { product, idempotent: false };
}

module.exports = { listPopularProducts, setPopularProduct };
