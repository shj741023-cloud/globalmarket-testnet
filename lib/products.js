'use strict';

const { normalizeWalletAddress } = require('./wallets');

const CATEGORIES = Object.freeze([
  { id: 'digital_devices', name: '디지털기기' },
  { id: 'home_appliances', name: '생활가전' },
  { id: 'furniture', name: '가구·인테리어' },
  { id: 'fashion', name: '의류·패션잡화' },
  { id: 'sports', name: '스포츠·레저' },
  { id: 'hobby', name: '취미·수집' },
  { id: 'books', name: '도서·음반' },
  { id: 'baby', name: '유아용품' },
  { id: 'vehicle_goods', name: '자동차용품' },
  { id: 'other_physical', name: '기타 실물 중고품' }
]);

const REVIEW_KEYWORDS = Object.freeze([
  '담배', '전자담배', '술', '주류', '의약품', '처방약', '마약', '총기', '도검',
  '위조품', '레플리카', '도난품', '개인정보', '헌혈증', '면세품',
  '건강기능식품', '식품', '화장품', '의료기기', '동물', '식물',
  '상품권', '티켓', '계정', '디지털 상품', '유심', '신분증',
  '암호화폐', '환전', '대출', '서비스 판매'
]);

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeImageData(value) {
  if (!value) return null;
  const imageData = String(value);
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)) {
    throw Object.assign(new Error('JPEG, PNG 또는 WebP 상품 사진만 사용할 수 있습니다.'), { code: 'INVALID_PRODUCT_IMAGE' });
  }
  if (imageData.length > 340_000) {
    throw Object.assign(new Error('상품 사진은 장당 압축 후 250KB 이하여야 합니다.'), { code: 'PRODUCT_IMAGE_TOO_LARGE' });
  }
  return imageData;
}

function normalizeImages(input) {
  const candidates = Array.isArray(input.images) ? input.images : (input.imageData ? [input.imageData] : []);
  if (candidates.length > 3) throw Object.assign(new Error('상품 사진은 최대 3장까지 등록할 수 있습니다.'), { code: 'TOO_MANY_PRODUCT_IMAGES' });
  const images = candidates.map(normalizeImageData).filter(Boolean);
  if (images.reduce((sum, image) => sum + image.length, 0) > 1_020_000) {
    throw Object.assign(new Error('상품 사진 전체 용량이 너무 큽니다.'), { code: 'PRODUCT_IMAGES_TOO_LARGE' });
  }
  return images;
}

function validateProductInput(input) {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const price = Number(input.price);
  const categoryId = String(input.categoryId || '');
  const methods = Array.isArray(input.methods) ? [...new Set(input.methods)] : [];
  let directWalletAddress = '';
  const errors = [];
  if (title.length < 2 || title.length > 80) errors.push('상품명은 2~80자여야 합니다.');
  if (description.length < 10 || description.length > 2000) errors.push('설명은 10~2000자여야 합니다.');
  if (!Number.isFinite(price) || price <= 0) errors.push('가격은 0보다 커야 합니다.');
  if (!CATEGORIES.some((item) => item.id === categoryId)) errors.push('허용된 실물상품 카테고리를 선택해야 합니다.');
  if (!methods.length || methods.some((item) => !['direct', 'parcel_testnet'].includes(item))) errors.push('직거래 또는 Testnet 택배 거래방식을 선택해야 합니다.');
  try { directWalletAddress = normalizeWalletAddress(input.directWalletAddress, { required: methods.includes('direct') }); } catch (error) { errors.push(error.message); }
  if (errors.length) throw Object.assign(new Error(errors.join(' ')), { code: 'INVALID_PRODUCT', details: errors });
  const combined = `${title} ${description}`.toLowerCase();
  const reviewReasons = REVIEW_KEYWORDS.filter((keyword) => combined.includes(keyword.toLowerCase()));
  return {
    value: { title, description, price, categoryId, methods, directWalletAddress, region: normalizeText(input.region || '미지정'), images: normalizeImages(input) },
    reviewRequired: reviewReasons.length > 0,
    reviewReasons
  };
}

function searchProducts(products, query = {}) {
  const keyword = normalizeText(query.q).toLowerCase();
  const minPrice = query.minPrice === undefined ? null : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined ? null : Number(query.maxPrice);
  const filtered = products.filter((item) => {
    if (!['available', 'reserved'].includes(item.status)) return false;
    if (keyword && !`${item.title} ${item.description}`.toLowerCase().includes(keyword)) return false;
    if (query.categoryId && item.categoryId !== query.categoryId) return false;
    if (query.region && item.region !== query.region) return false;
    if (query.method && !item.methods.includes(query.method)) return false;
    if (Number.isFinite(minPrice) && item.price < minPrice) return false;
    if (Number.isFinite(maxPrice) && item.price > maxPrice) return false;
    return true;
  });
  const sort = ['latest', 'price_asc', 'price_desc'].includes(query.sort) ? query.sort : 'latest';
  return filtered.slice().sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price;
    if (sort === 'price_desc') return b.price - a.price;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

function assertProductOwner(product, sellerId) {
  if (!product || product.sellerId !== sellerId) {
    throw Object.assign(new Error('본인 상품만 관리할 수 있습니다.'), { code: 'PRODUCT_OWNER_REQUIRED', status: 403 });
  }
}

function updateOwnedProduct(product, sellerId, input) {
  assertProductOwner(product, sellerId);
  if (['reserved', 'sold'].includes(product.status)) {
    throw Object.assign(new Error('예약 또는 판매완료 상품은 수정할 수 없습니다.'), { code: 'PRODUCT_EDIT_BLOCKED', status: 409 });
  }
  const checked = validateProductInput({
    title: input.title ?? product.title,
    description: input.description ?? product.description,
    price: input.price ?? product.price,
    categoryId: input.categoryId ?? product.categoryId,
    methods: input.methods ?? product.methods,
    directWalletAddress: input.directWalletAddress ?? product.directWalletAddress,
    region: input.region ?? product.region,
    images: input.images ?? product.images ?? (product.imageData ? [product.imageData] : [])
  });
  Object.assign(product, checked.value, {
    status: checked.reviewRequired ? 'under_review' : (product.status === 'paused' ? 'paused' : 'available'),
    reviewReasons: checked.reviewReasons,
    updatedAt: new Date().toISOString()
  });
  return product;
}

function changeOwnedProductStatus(product, sellerId, nextStatus, hasActiveTrade = false) {
  assertProductOwner(product, sellerId);
  if (!['available', 'paused'].includes(nextStatus)) {
    throw Object.assign(new Error('판매중 또는 판매중지만 직접 선택할 수 있습니다.'), { code: 'INVALID_PRODUCT_STATUS', status: 400 });
  }
  if (hasActiveTrade) {
    throw Object.assign(new Error('진행 중인 거래가 있는 상품은 상태를 변경할 수 없습니다.'), { code: 'ACTIVE_TRADE_EXISTS', status: 409 });
  }
  if (product.status === 'under_review' && nextStatus === 'available') {
    throw Object.assign(new Error('검토 중인 상품은 판매를 재개할 수 없습니다.'), { code: 'PRODUCT_UNDER_REVIEW', status: 409 });
  }
  if (['reserved', 'sold'].includes(product.status)) {
    throw Object.assign(new Error('예약 또는 판매완료 상태는 판매자가 변경할 수 없습니다.'), { code: 'PRODUCT_STATUS_LOCKED', status: 409 });
  }
  if (product.status === nextStatus) return { product, idempotent: true };
  product.status = nextStatus;
  product.updatedAt = new Date().toISOString();
  return { product, idempotent: false };
}

module.exports = {
  CATEGORIES, REVIEW_KEYWORDS, normalizeImageData, normalizeImages, validateProductInput, searchProducts,
  assertProductOwner, updateOwnedProduct, changeOwnedProductStatus
};
