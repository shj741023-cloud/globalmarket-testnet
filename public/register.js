'use strict';

const byId = (id) => document.getElementById(id);
const images = [];

function dailyToken() {
  try {
    const saved = JSON.parse(localStorage.getItem('gm_testnet_daily_session') || 'null');
    return saved?.token || '';
  } catch { return ''; }
}

async function api(path, options = {}) {
  const token = dailyToken();
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || '요청에 실패했습니다.');
  return payload;
}

async function compressImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('사진 파일을 선택하세요.');
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('사진을 읽을 수 없습니다.')); image.src = source; });
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 250000) return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    }
    throw new Error('사진 용량이 너무 큽니다.');
  } finally { URL.revokeObjectURL(source); }
}

function renderPreview() {
  byId('standalonePreview').innerHTML = images.length
    ? images.map((src, index) => `<div class="image-editor-item"><img src="${src}" alt="상품 사진 ${index + 1}"><small>${index === 0 ? '대표사진' : `${index + 1}번째 사진`}</small><button type="button" data-remove="${index}">삭제</button></div>`).join('')
    : '<p class="empty">선택된 사진이 없습니다.</p>';
  byId('standalonePreview').querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { images.splice(Number(button.dataset.remove), 1); renderPreview(); }));
}

async function addFiles(files, replace) {
  const selected = [...files];
  const nextCount = (replace ? 0 : images.length) + selected.length;
  if (nextCount > 3) throw new Error('상품 사진은 최대 3장까지 등록할 수 있습니다.');
  byId('standaloneResult').textContent = '사진을 준비하고 있습니다.';
  const prepared = await Promise.all(selected.map(compressImage));
  if (replace) images.splice(0, images.length, ...prepared); else images.push(...prepared);
  renderPreview();
  byId('standaloneResult').textContent = `${images.length}장의 사진이 준비됐습니다.`;
}

async function initialize() {
  try {
    await api('/api/v1/me');
    const { items } = await api('/api/v1/categories');
    byId('standaloneCategory').innerHTML = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
    renderPreview();
  } catch {
    alert('Pi Testnet 로그인이 필요합니다.');
    window.location.replace('/');
  }
}

byId('backToMarket').addEventListener('click', () => window.location.assign('/'));
byId('standaloneImages').addEventListener('change', async (event) => { try { await addFiles(event.target.files, true); } catch (error) { byId('standaloneResult').textContent = error.message; } event.target.value = ''; });
byId('standaloneCamera').addEventListener('change', async (event) => { try { await addFiles(event.target.files, false); } catch (error) { byId('standaloneResult').textContent = error.message; } event.target.value = ''; });
byId('standaloneProductForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const methods = [];
  if (byId('standaloneDirect').checked) methods.push('direct');
  if (byId('standaloneParcel').checked) methods.push('parcel_testnet');
  if (!methods.length) return alert('거래방식을 하나 이상 선택하세요.');
  if (methods.includes('direct') && !byId('standaloneWallet').value.trim()) return alert('직거래용 Pi 지갑주소를 입력하세요.');
  try {
    byId('standaloneResult').textContent = '상품을 등록하고 있습니다.';
    const { product } = await api('/api/v1/products', { method: 'POST', body: JSON.stringify({ title: byId('standaloneTitle').value, description: byId('standaloneDescription').value, price: Number(byId('standalonePrice').value), categoryId: byId('standaloneCategory').value, region: byId('standaloneRegion').value, directWalletAddress: byId('standaloneWallet').value, methods, images }) });
    alert(product.status === 'under_review' ? '검토 대상으로 접수됐습니다.' : '상품이 등록되었습니다.');
    window.location.assign('/');
  } catch (error) { byId('standaloneResult').textContent = error.message; }
});

initialize();
