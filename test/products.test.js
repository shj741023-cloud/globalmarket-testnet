'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORIES, validateProductInput, searchProducts, updateOwnedProduct, changeOwnedProductStatus } = require('../lib/products');

const valid = {
  title: '중고 카메라',
  description: '정상 작동하는 개인 소유 중고 카메라입니다.',
  price: 25,
  categoryId: 'digital_devices',
  methods: ['direct', 'parcel_testnet'],
  directWalletAddress: `G${'A'.repeat(55)}`,
  region: '서울'
};

test('초기 카테고리는 실물 중고상품 범위만 제공한다', () => {
  assert.ok(CATEGORIES.some((item) => item.id === 'digital_devices'));
  assert.equal(CATEGORIES.some((item) => item.id === 'digital_goods'), false);
  assert.equal(CATEGORIES.some((item) => item.id === 'services'), false);
});

test('정상 실물 중고상품 입력을 허용한다', () => {
  const result = validateProductInput(valid);
  assert.equal(result.reviewRequired, false);
  assert.equal(result.value.price, 25);
});

test('필수 정보와 허용 카테고리를 검증한다', () => {
  assert.throws(() => validateProductInput({ ...valid, title: '', categoryId: 'digital_goods' }), /상품명은/);
});

test('지원하지 않는 거래방식을 차단한다', () => {
  assert.throws(() => validateProductInput({ ...valid, methods: ['mainnet'] }), /거래방식/);
});

test('직거래 상품은 유효한 Pi 지갑주소가 필요하다', () => {
  assert.throws(() => validateProductInput({ ...valid, directWalletAddress: '' }), /지갑주소/);
  assert.equal(validateProductInput({ ...valid, methods: ['parcel_testnet'], directWalletAddress: '' }).value.directWalletAddress, '');
});

test('압축된 JPEG·PNG·WebP 상품 사진만 허용한다', () => {
  const imageData = 'data:image/jpeg;base64,AA==';
  assert.deepEqual(validateProductInput({ ...valid, imageData }).value.images, [imageData]);
  assert.throws(() => validateProductInput({ ...valid, imageData: 'data:text/html;base64,AA==' }), /상품 사진/);
});

test('과도하게 큰 상품 사진을 차단한다', () => {
  const imageData = `data:image/jpeg;base64,${'A'.repeat(340_000)}`;
  assert.throws(() => validateProductInput({ ...valid, imageData }), /250KB/);
});

test('상품 사진은 최대 3장까지만 허용한다', () => {
  const imageData = 'data:image/jpeg;base64,AA==';
  assert.equal(validateProductInput({ ...valid, images: [imageData, imageData, imageData] }).value.images.length, 3);
  assert.throws(() => validateProductInput({ ...valid, images: [imageData, imageData, imageData, imageData] }), /최대 3장/);
});

test('금지·제한 품목 의심어는 자동 제재하지 않고 검토 대상으로 분류한다', () => {
  const result = validateProductInput({ ...valid, title: '미개봉 전자담배' });
  assert.equal(result.reviewRequired, true);
  assert.ok(result.reviewReasons.includes('담배'));
});

test('검색어·카테고리·가격·거래방식 필터를 함께 적용한다', () => {
  const products = [
    { ...valid, id: '1', status: 'available' },
    { ...valid, id: '2', title: '중고 의자', categoryId: 'furniture', price: 5, methods: ['direct'], status: 'available' },
    { ...valid, id: '3', title: '검토 상품', status: 'under_review' }
  ];
  const result = searchProducts(products, { q: '카메라', categoryId: 'digital_devices', minPrice: '20', maxPrice: '30', method: 'parcel_testnet' });
  assert.deepEqual(result.map((item) => item.id), ['1']);
});

test('검토중·판매완료 상품은 공개 검색에서 제외한다', () => {
  const products = [
    { ...valid, id: '1', status: 'under_review' },
    { ...valid, id: '2', status: 'sold' }
  ];
  assert.equal(searchProducts(products, {}).length, 0);
});

test('상품을 최신순·낮은 가격순·높은 가격순으로 정렬한다', () => {
  const products = [
    { ...valid, id: 'old', price: 20, status: 'available', createdAt: '2026-01-01T00:00:00.000Z' },
    { ...valid, id: 'new', price: 10, status: 'available', createdAt: '2026-01-02T00:00:00.000Z' }
  ];
  assert.deepEqual(searchProducts(products, {}).map((item) => item.id), ['new', 'old']);
  assert.deepEqual(searchProducts(products, { sort: 'price_asc' }).map((item) => item.id), ['new', 'old']);
  assert.deepEqual(searchProducts(products, { sort: 'price_desc' }).map((item) => item.id), ['old', 'new']);
});

test('판매자만 자신의 상품을 수정할 수 있다', () => {
  const product = { ...valid, sellerId: 'seller', status: 'available' };
  assert.throws(() => updateOwnedProduct(product, 'other', { price: 30 }), /본인 상품/);
  updateOwnedProduct(product, 'seller', { price: 30 });
  assert.equal(product.price, 30);
});

test('상품 수정에서 사진 순서 변경과 전체 삭제를 반영한다', () => {
  const first = 'data:image/jpeg;base64,AA==';
  const second = 'data:image/png;base64,AA==';
  const product = { ...valid, sellerId: 'seller', status: 'available', images: [first, second] };
  updateOwnedProduct(product, 'seller', { images: [second, first] });
  assert.deepEqual(product.images, [second, first]);
  updateOwnedProduct(product, 'seller', { images: [] });
  assert.deepEqual(product.images, []);
});

test('수정한 내용에 제한품목 의심어가 있으면 다시 검토중 처리한다', () => {
  const product = { ...valid, sellerId: 'seller', status: 'available' };
  updateOwnedProduct(product, 'seller', { title: '미개봉 전자담배' });
  assert.equal(product.status, 'under_review');
});

test('예약·판매완료 상품 수정을 차단한다', () => {
  const product = { ...valid, sellerId: 'seller', status: 'sold' };
  assert.throws(() => updateOwnedProduct(product, 'seller', { price: 30 }), /수정할 수 없습니다/);
});

test('판매중지와 판매재개를 지원하고 같은 요청은 중복 반영하지 않는다', () => {
  const product = { ...valid, sellerId: 'seller', status: 'available' };
  assert.equal(changeOwnedProductStatus(product, 'seller', 'paused').idempotent, false);
  assert.equal(changeOwnedProductStatus(product, 'seller', 'paused').idempotent, true);
  assert.equal(changeOwnedProductStatus(product, 'seller', 'available').product.status, 'available');
});

test('진행 중 거래나 검토 중 상품의 판매재개를 차단한다', () => {
  const product = { ...valid, sellerId: 'seller', status: 'available' };
  assert.throws(() => changeOwnedProductStatus(product, 'seller', 'paused', true), /진행 중인 거래/);
  product.status = 'under_review';
  assert.throws(() => changeOwnedProductStatus(product, 'seller', 'available'), /검토 중/);
});
