'use strict';

const state = { user: null, sessionToken: null, products: [], productQuery: '', productHasMore: false, categories: [], selectedProduct: null, editingProduct: null, registerImages: [], editingImages: [], room: null, agreement: null, trade: null, payment: null, activeRoom: null };
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const safeProductImage = (value) => /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(value || '')) ? value : null;
const productImages = (product) => (Array.isArray(product?.images) ? product.images : (product?.imageData ? [product.imageData] : [])).map(safeProductImage).filter(Boolean).slice(0, 3);

async function compressProductImage(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG, PNG 또는 WebP 사진을 선택하세요.');
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('사진을 읽을 수 없습니다.')); image.src = sourceUrl; });
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 250_000) return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    }
    throw new Error('사진을 더 작은 크기로 선택하세요.');
  } finally { URL.revokeObjectURL(sourceUrl); }
}

async function compressProductImages(files) {
  const selected = [...files];
  if (selected.length > 3) throw new Error('상품 사진은 최대 3장까지 선택할 수 있습니다.');
  return Promise.all(selected.map(compressProductImage));
}

function renderImageEditor(containerId, imagesKey) {
  const images = state[imagesKey];
  const container = $(containerId);
  container.innerHTML = images.length ? images.map((image, index) => `
    <div class="image-editor-item">
      <img src="${image}" alt="상품 사진 ${index + 1}">
      <small>${index === 0 ? '대표사진' : `${index + 1}번째`}</small>
      <div><button type="button" data-image-left="${index}" ${index === 0 ? 'disabled' : ''}>←</button><button type="button" data-image-right="${index}" ${index === images.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-image-remove="${index}">삭제</button></div>
    </div>`).join('') : '<p class="empty">선택된 사진이 없습니다.</p>';
  const redraw = () => renderImageEditor(containerId, imagesKey);
  container.querySelectorAll('[data-image-remove]').forEach((button) => button.addEventListener('click', () => { images.splice(Number(button.dataset.imageRemove), 1); redraw(); }));
  container.querySelectorAll('[data-image-left]').forEach((button) => button.addEventListener('click', () => { const index = Number(button.dataset.imageLeft); [images[index - 1], images[index]] = [images[index], images[index - 1]]; redraw(); }));
  container.querySelectorAll('[data-image-right]').forEach((button) => button.addEventListener('click', () => { const index = Number(button.dataset.imageRight); [images[index], images[index + 1]] = [images[index + 1], images[index]]; redraw(); }));
}

async function prepareSelectedImages(inputId, containerId, imagesKey, resultId) {
  try {
    if (!$(inputId).files.length) return;
    $(resultId).textContent = '사진을 준비하고 있습니다.';
    state[imagesKey] = await compressProductImages($(inputId).files);
    $(inputId).value = '';
    renderImageEditor(containerId, imagesKey);
    $(resultId).textContent = `${state[imagesKey].length}장의 사진이 준비됐습니다.`;
  } catch (error) {
    $(inputId).value = '';
    $(resultId).textContent = error.message;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(state.sessionToken ? { authorization: `Bearer ${state.sessionToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    const requestId = payload.error?.requestId ? ` (문의번호 ${payload.error.requestId})` : '';
    throw new Error(`${payload.error?.code || 'ERROR'}: ${payload.error?.message || '요청 실패'}${requestId}`);
  }
  return payload;
}

function log(message, data) {
  $('log').textContent += `${new Date().toLocaleTimeString()} ${message}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}\n`;
}

function renderQuote(quote) {
  $('quote').innerHTML = [
    ['상품금액', `${quote.productAmount} Test-Pi`], ['구매자 모의 수수료', `${quote.buyerFee} Test-Pi`],
    ['구매자 총액', `${quote.buyerTotal} Test-Pi`], ['판매자 모의 정산액', `${quote.sellerExpectedSettlement} Test-Pi`]
  ].map(([label,value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('');
}

async function loadProducts(query = '', append = false) {
  const params = new URLSearchParams(query);
  params.set('limit', '20');
  params.set('offset', append ? String(state.products.length) : '0');
  const { items, pagination } = await api(`/api/v1/products?${params.toString()}`);
  state.productQuery = query;
  state.products = append ? [...state.products, ...items] : items;
  state.productHasMore = Boolean(pagination?.hasMore);
  $('loadMoreProducts').classList.toggle('hidden', !state.productHasMore);
  $('products').innerHTML = state.products.map((item) => `
    <article class="product">
      <div class="image">${productImages(item)[0] ? `<img src="${productImages(item)[0]}" alt="${escapeHtml(item.title)} 상품 사진">` : '<span aria-hidden="true">◉</span>'}</div>
      <h3>${escapeHtml(item.title)}</h3><p class="price">${escapeHtml(item.price)} Test-Pi</p>
      <p class="meta">${escapeHtml(item.region)} · 기능시험용 가상 상품</p>
      <p class="seller-line">${escapeHtml(item.seller?.username || 'Pi 사용자')} · ${escapeHtml(item.seller?.trustLevel || 'Bronze')}</p>
      <div class="method-row">${item.methods.map((method) => `<span class="tag">${method === 'direct' ? '직거래' : 'Testnet 택배'}</span>`).join('')}</div>
      <button data-product="${item.id}">상세 보기</button>
    </article>`).join('');
  document.querySelectorAll('[data-product]').forEach((button) => button.addEventListener('click', () => openProductDetail(button.dataset.product)));
}

async function loadCategories() {
  const { items } = await api('/api/v1/categories');
  state.categories = items;
  $('productCategory').innerHTML = '<option value="">카테고리 선택</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  $('editProductCategory').innerHTML = '<option value="">카테고리 선택</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  $('searchCategory').innerHTML = '<option value="">전체 카테고리</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
}

function openProductDetail(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  state.selectedProduct = product;
  const images = productImages(product);
  $('productDetailGallery').innerHTML = images.length
    ? images.map((image, index) => `<img src="${image}" alt="${escapeHtml(product.title)} 상품 사진 ${index + 1}">`).join('')
    : '<div class="empty-image" aria-hidden="true">◉</div>';
  $('productDetailCategory').textContent = state.categories.find((item) => item.id === product.categoryId)?.name || '실물 중고상품';
  $('productDetailTitle').textContent = product.title;
  $('productDetailPrice').textContent = `${product.price} Test-Pi`;
  $('productDetailDescription').textContent = product.description;
  $('productDetailMeta').textContent = `${product.region} · Testnet 기능시험 상품`;
  $('productDetailSeller').innerHTML = `<small>판매자</small><strong>${escapeHtml(product.seller?.username || 'Pi 사용자')}</strong><span>${escapeHtml(product.seller?.trustLevel || 'Bronze')} · 정상거래 ${escapeHtml(product.seller?.normalTradeCount || 0)}건</span>`;
  $('productDetailMethods').innerHTML = product.methods.map((method) => `<span class="tag">${method === 'direct' ? '직거래' : 'Testnet 택배'}</span>`).join('');
  $('toggleFavorite').textContent = product.isFavorite ? '♥ 찜 해제' : '♡ 찜하기';
  $('productDetailPanel').classList.remove('hidden');
  $('productDetailPanel').scrollIntoView({ behavior: 'smooth' });
}

async function registerProduct(event) {
  event.preventDefault();
  if (!state.user) return alert('Pi Testnet 로그인 후 등록할 수 있습니다.');
  const methods = [];
  if ($('methodDirect').checked) methods.push('direct');
  if ($('methodParcel').checked) methods.push('parcel_testnet');
  try {
    $('registerResult').textContent = '사진과 상품 정보를 준비하고 있습니다.';
    const images = [...state.registerImages];
    const body = { title: $('productTitle').value, description: $('productDescription').value, price: Number($('productPrice').value), categoryId: $('productCategory').value, region: $('productRegion').value, methods, images };
    const { product } = await api('/api/v1/products', { method: 'POST', body: JSON.stringify(body) });
    $('registerResult').textContent = product.status === 'under_review' ? '등록 내용이 검토 대상으로 접수됐습니다. 검토 전에는 공개되지 않습니다.' : '시험 상품이 등록됐습니다.';
    $('productForm').reset(); state.registerImages = []; renderImageEditor('registerProductImages', 'registerImages'); $('methodDirect').checked = true; $('methodParcel').checked = true;
    await Promise.all([loadProducts(), loadMyProducts()]);
  } catch (error) { $('registerResult').textContent = error.message; }
}

async function chooseTrade(productId) {
  if (!state.user) { alert('Pi Testnet 로그인 후 거래조건을 제안할 수 있습니다.'); return; }
  const product = state.products.find((item) => item.id === productId);
  if (!product) throw new Error('상품 정보를 다시 불러오세요.');
  let type;
  if (product.methods.length === 1) type = product.methods[0];
  else type = confirm('확인: Testnet 택배 모의 안전거래\n취소: 직거래(플랫폼 안전결제 없음)') ? 'parcel_testnet' : 'direct';
  if (!product.methods.includes(type)) throw new Error('판매자가 허용한 거래방식만 선택할 수 있습니다.');
  const { room } = await api(`/api/v1/products/${productId}/chat-rooms`, { method: 'POST' });
  const { agreement } = await api(`/api/v1/chat-rooms/${room.id}/agreements`, {
    method: 'POST', body: JSON.stringify({ price: product.price, type })
  });
  await api(`/api/v1/agreements/${agreement.id}/confirm`, { method: 'POST' });
  state.room = room; state.agreement = agreement; state.trade = null; $('tradePanel').classList.remove('hidden');
  $('tradeTitle').textContent = type === 'direct' ? '직거래 조건 제안' : 'Testnet 택배 조건 제안';
  $('tradeNotice').textContent = type === 'direct'
    ? '직거래 결제는 당사자 간 개인 Pi 지갑 송금만 허용합니다. 플랫폼은 안전결제·보관·정산·환불을 제공하지 않습니다.'
    : 'Test-Pi 기능시험입니다. 실제 상품대금이나 판매자 지급이 아닙니다.';
  $('preparePayment').hidden = true; $('mockComplete').hidden = true; $('quote').innerHTML = '';
  log(`채팅방 생성: ${room.id}`);
  log(`거래조건 제안 및 구매자 확인 완료: ${agreement.id}\n판매자가 같은 조건을 확인한 뒤에만 거래가 생성됩니다.`);
  $('tradePanel').scrollIntoView({ behavior: 'smooth' });
}

async function loginPi() {
  if (!window.Pi) throw new Error('Pi SDK를 불러오지 못했습니다. Pi Browser 또는 네트워크를 확인하세요.');
  Pi.init({ version: '2.0', sandbox: true });
  const auth = await Pi.authenticate(['username', 'payments'], async (payment) => {
    log('미완료 Test-Pi 결제 발견', payment);
  });
  const session = await api('/api/v1/auth/pi', { method: 'POST', body: JSON.stringify({ accessToken: auth.accessToken }) });
  state.user = session.user; state.sessionToken = session.sessionToken; $('authState').textContent = `${session.user.username || session.user.id} · 서버 검증 완료`;
  $('piLogin').classList.add('hidden'); $('logout').classList.remove('hidden');
  $('checklistPayment').classList.remove('hidden');
  await loadMyMarket();
}

const statusNames = { available: '판매중', paused: '판매중지', under_review: '검토중', reserved: '예약중', sold: '판매완료', payment_pending: '결제대기', shipping_pending: '발송대기', shipping: '배송중', delivered: '배송완료', purchase_confirmed: '구매확정', completed: '거래완료', cancelled: '취소', disputed: '분쟁중', refunded: '환불' };

function openProductEdit(product) {
  state.editingProduct = product;
  $('editProductTitle').value = product.title;
  $('editProductDescription').value = product.description;
  $('editProductPrice').value = product.price;
  $('editProductCategory').value = product.categoryId;
  $('editProductRegion').value = product.region || '';
  $('editMethodDirect').checked = product.methods.includes('direct');
  $('editMethodParcel').checked = product.methods.includes('parcel_testnet');
  $('editProductImage').value = '';
  $('editProductResult').textContent = '';
  state.editingImages = [...productImages(product)];
  renderImageEditor('editProductImages', 'editingImages');
  $('editProductPanel').classList.remove('hidden');
  $('editProductPanel').scrollIntoView({ behavior: 'smooth' });
}

function closeProductEdit() {
  state.editingProduct = null;
  state.editingImages = [];
  $('editProductPanel').classList.add('hidden');
  $('editProductForm').reset();
  $('editProductImages').innerHTML = '';
}

async function saveProductEdit(event) {
  event.preventDefault();
  const product = state.editingProduct;
  if (!product) return;
  const methods = [];
  if ($('editMethodDirect').checked) methods.push('direct');
  if ($('editMethodParcel').checked) methods.push('parcel_testnet');
  try {
    $('editProductResult').textContent = '수정 내용을 확인하고 있습니다.';
    const body = {
      title: $('editProductTitle').value,
      description: $('editProductDescription').value,
      price: Number($('editProductPrice').value),
      categoryId: $('editProductCategory').value,
      region: $('editProductRegion').value,
      methods
    };
    body.images = [...state.editingImages];
    const { product: updated } = await api(`/api/v1/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    $('editProductResult').textContent = updated.status === 'under_review' ? '수정 내용이 검토 상태로 접수됐습니다.' : '상품 정보가 수정됐습니다.';
    await Promise.all([loadMyProducts(), loadProducts()]);
    setTimeout(closeProductEdit, 700);
  } catch (error) { $('editProductResult').textContent = error.message; }
}

async function loadMyProducts() {
  const { items } = await api('/api/v1/me/products');
  $('myProducts').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${escapeHtml(statusNames[item.status] || item.status)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.price)} Test-Pi · ${escapeHtml(item.region)}</p></div><div class="card-actions">${!['reserved', 'sold'].includes(item.status) ? `<button data-edit-product="${escapeHtml(item.id)}">수정</button>` : ''}${['available', 'paused'].includes(item.status) ? `<button data-product-status="${escapeHtml(item.id)}" data-next-status="${item.status === 'available' ? 'paused' : 'available'}">${item.status === 'available' ? '판매중지' : '판매재개'}</button>` : ''}</div></article>`).join('') : '<p class="empty">등록한 상품이 없습니다.</p>';
  document.querySelectorAll('[data-product-status]').forEach((button) => button.addEventListener('click', async () => {
    try { await api(`/api/v1/products/${button.dataset.productStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.nextStatus }) }); await Promise.all([loadMyProducts(), loadProducts()]); } catch (error) { alert(error.message); }
  }));
  document.querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', async () => {
    const product = items.find((item) => item.id === button.dataset.editProduct); if (!product) return;
    openProductEdit(product);
  }));
}

async function loadMyTrades() {
  const { items } = await api('/api/v1/me/trades');
  $('myTrades').innerHTML = items.length ? items.map((item) => `<button class="management-card trade-card" data-trade-detail="${escapeHtml(item.id)}"><div><small>${item.myRole === 'buyer' ? '구매' : '판매'} · ${escapeHtml(statusNames[item.status] || item.status)}</small><h3>${escapeHtml(item.product?.title || '상품정보 없음')}</h3><p>${escapeHtml(item.amount)} Test-Pi · ${item.type === 'direct' ? '직거래' : 'Testnet 택배'}</p></div><span>상세 ›</span></button>`).join('') : '<p class="empty">진행한 거래가 없습니다.</p>';
  document.querySelectorAll('[data-trade-detail]').forEach((button) => button.addEventListener('click', () => openTradeDetail(button.dataset.tradeDetail).catch((error) => alert(error.message))));
}

async function loadMyFavorites() {
  const { items } = await api('/api/v1/me/favorites');
  $('myFavorites').innerHTML = items.length ? items.map((item) => `<button class="management-card trade-card" data-favorite-product="${escapeHtml(item.id)}"><div><small>${escapeHtml(item.seller?.trustLevel || 'Bronze')} 판매자</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.price)} Test-Pi · ${escapeHtml(item.region)}</p></div><span>상세 ›</span></button>`).join('') : '<p class="empty">찜한 상품이 없습니다.</p>';
  document.querySelectorAll('[data-favorite-product]').forEach((button) => button.addEventListener('click', () => {
    const product = items.find((item) => item.id === button.dataset.favoriteProduct);
    if (!product) return;
    const existing = state.products.findIndex((item) => item.id === product.id);
    if (existing >= 0) state.products[existing] = product; else state.products.push(product);
    openProductDetail(product.id);
  }));
}

async function openTradeDetail(tradeId) {
  const detail = await api(`/api/v1/trades/${tradeId}`); const trade = detail.trade; state.trade = trade;
  $('tradeDetailContent').innerHTML = `<p class="eyebrow">${trade.myRole === 'buyer' ? 'PURCHASE' : 'SALE'}</p><h3>${escapeHtml(detail.product?.title || '상품정보 없음')}</h3><div class="detail-grid"><p><small>거래상태</small><strong>${escapeHtml(statusNames[trade.status] || trade.status)}</strong></p><p><small>거래금액</small><strong>${escapeHtml(trade.amount)} Test-Pi</strong></p><p><small>거래방식</small><strong>${trade.type === 'direct' ? '직거래' : 'Testnet 택배'}</strong></p><p><small>정산보류</small><strong>${trade.settlementHold ? '보류중' : '없음'}</strong></p></div>`;
  const actions = [];
  if (trade.type === 'parcel_testnet' && trade.myRole === 'buyer' && trade.status === 'payment_pending') actions.push(['actionPay', 'Test-Pi 결제', 'primary']);
  if (trade.type === 'parcel_testnet' && trade.myRole === 'seller' && trade.status === 'shipping_pending') actions.push(['actionShip', '운송장 등록', 'primary']);
  if (trade.type === 'parcel_testnet' && trade.myRole === 'buyer' && trade.status === 'delivered') actions.push(['actionConfirm', '구매확정', 'primary']);
  if (trade.type === 'parcel_testnet' && !['completed', 'cancelled', 'refunded', 'disputed'].includes(trade.status)) actions.push(['actionDispute', '분쟁 접수', 'secondary']);
  if (trade.type === 'direct' && !detail.directRecord && trade.status !== 'completed') actions.push(['actionDirectPlan', '직거래 약속 만들기', 'primary']);
  if (trade.type === 'direct' && detail.directRecord && !detail.directRecord.canceledAt && trade.status !== 'completed') { actions.push(['actionDirectComplete', '내 거래완료 표시', 'primary']); actions.push(['actionDirectCancel', '직거래 취소', 'secondary']); }
  if (['purchase_confirmed', 'completed'].includes(trade.status) && !detail.reviews.some((item) => item.writerId === state.user.id)) actions.push(['actionReview', '후기 작성', 'secondary']);
  actions.push(['actionReport', '거래 신고', 'secondary']);
  $('tradeActions').innerHTML = actions.map(([id, label, style]) => `<button id="${id}" class="${style}">${label}</button>`).join('') || '<p class="status">현재 사용자가 처리할 다음 작업이 없습니다.</p>';
  $('tradeDetailCard').classList.remove('hidden'); bindTradeActions(detail); $('tradeDetailCard').scrollIntoView({ behavior: 'smooth' });
}

function bindTradeActions(detail) {
  const trade = detail.trade; const refresh = () => Promise.all([openTradeDetail(trade.id), loadMyTrades()]);
  $('actionPay')?.addEventListener('click', () => preparePayment().then(refresh).catch((error) => alert(error.message)));
  $('actionShip')?.addEventListener('click', async () => { const carrier = prompt('택배사 이름'); if (!carrier) return; const trackingNumber = prompt('운송장 번호'); if (!trackingNumber) return; try { await api(`/api/v1/trades/${trade.id}/shipment`, { method: 'POST', body: JSON.stringify({ carrier, trackingNumber }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionConfirm')?.addEventListener('click', async () => { if (!confirm('상품을 확인했고 구매를 확정할까요?')) return; try { await api(`/api/v1/trades/${trade.id}/confirm-purchase`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDispute')?.addEventListener('click', async () => { const reason = prompt('분쟁 사유를 입력하세요'); if (!reason) return; try { await api(`/api/v1/trades/${trade.id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectPlan')?.addEventListener('click', async () => { if (!confirm('직거래 결제는 당사자 간 개인 Pi 지갑 송금만 허용하며, 플랫폼 안전거래 없이 모든 확인과 송금은 당사자 책임입니다. 동의합니까?')) return; const scheduledAt = prompt('약속 일시(예: 2026-08-20 15:00)'); const place = prompt('약속 장소'); if (!scheduledAt || !place) return; try { await api(`/api/v1/trades/${trade.id}/direct`, { method: 'POST', body: JSON.stringify({ noticeAccepted: true, scheduledAt, place, paymentMethod: 'personal_pi_wallet' }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectComplete')?.addEventListener('click', async () => { if (!confirm('직거래 완료를 표시할까요? 상대방도 완료해야 최종 완료됩니다.')) return; try { await api(`/api/v1/trades/${trade.id}/direct/complete`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectCancel')?.addEventListener('click', async () => { const reason = prompt('취소 사유'); if (reason === null) return; try { await api(`/api/v1/trades/${trade.id}/direct/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionReview')?.addEventListener('click', async () => { const positive = confirm('좋은 거래였나요?\n확인: 긍정 / 취소: 보통'); const comment = prompt('후기 내용을 입력하세요'); if (!comment) return; try { await api(`/api/v1/trades/${trade.id}/reviews`, { method: 'POST', body: JSON.stringify({ sentiment: positive ? 'positive' : 'neutral', comment }) }); await Promise.all([refresh(), loadTrust()]); } catch (error) { alert(error.message); } });
  $('actionReport')?.addEventListener('click', async () => { const reason = prompt('신고 사유를 입력하세요'); if (!reason) return; try { await api('/api/v1/reports', { method: 'POST', body: JSON.stringify({ targetType: 'trade', targetId: trade.id, reason }) }); alert('신고가 접수됐습니다. 접수만으로 상대방 신뢰점수는 변경되지 않습니다.'); await loadNotifications(); } catch (error) { alert(error.message); } });
}

async function loadNotifications() {
  const { items } = await api('/api/v1/notifications');
  $('notifications').innerHTML = items.length ? items.slice(0, 20).map((item) => `<button class="management-card ${item.readAt ? '' : 'unread'}" data-notification="${escapeHtml(item.id)}"><div><small>${item.readAt ? '읽음' : '새 알림'}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div></button>`).join('') : '<p class="empty">새로운 알림이 없습니다.</p>';
  document.querySelectorAll('[data-notification]').forEach((button) => button.addEventListener('click', async () => { try { await api(`/api/v1/notifications/${button.dataset.notification}/read`, { method: 'POST' }); await loadNotifications(); } catch (error) { alert(error.message); } }));
}
async function loadMyReports() {
  const { items } = await api('/api/v1/me/reports');
  const names = { received: '접수', reviewing: '검토중', closed: '처리완료' };
  $('myReports').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${escapeHtml(names[item.status] || item.status)} · ${item.targetType === 'product' ? '상품' : '거래'} 신고</small><h3>${escapeHtml(item.reason)}</h3><p>접수번호 ${escapeHtml(item.id)}</p></div></article>`).join('') : '<p class="empty">접수한 신고가 없습니다.</p>';
}
async function loadTrust() { const { profile, nextLevel } = await api('/api/v1/me/trust'); $('trustSummary').innerHTML = `<div><small>신뢰등급</small><strong>${escapeHtml(profile.level)}</strong></div><div><small>신뢰점수</small><strong>${escapeHtml(profile.score)}점</strong></div><div><small>정상거래</small><strong>${escapeHtml(profile.normalTradeCount)}건</strong></div><div><small>다음등급</small><strong>${escapeHtml(nextLevel?.level || '최고등급')}</strong></div>`; }
async function loadMyMarket() { if (state.user) await Promise.all([loadMyProducts(), loadMyFavorites(), loadMyTrades(), loadNotifications(), loadMyReports(), loadTrust()]); }
function showManagement(type) {
  for (const name of ['Products', 'Favorites', 'Trades']) {
    const active = type === name.toLowerCase();
    $(`my${name}`).classList.toggle('hidden', !active);
    $(`showMy${name}`).classList.toggle('active', active);
  }
}

async function toggleFavorite() {
  if (!state.user) return alert('Pi Testnet 로그인 후 찜할 수 있습니다.');
  const product = state.selectedProduct; if (!product) return;
  await api(`/api/v1/products/${product.id}/favorite`, { method: product.isFavorite ? 'DELETE' : 'POST' });
  product.isFavorite = !product.isFavorite;
  $('toggleFavorite').textContent = product.isFavorite ? '♥ 찜 해제' : '♡ 찜하기';
  await loadMyFavorites();
}

async function reportSelectedProduct() {
  if (!state.user) return alert('Pi Testnet 로그인 후 신고할 수 있습니다.');
  const product = state.selectedProduct; if (!product) return;
  const reason = prompt('상품 신고 사유를 입력하세요'); if (!reason) return;
  await api('/api/v1/reports', { method: 'POST', body: JSON.stringify({ targetType: 'product', targetId: product.id, reason }) });
  alert('상품 신고가 접수됐습니다. 신고만으로 판매자 신뢰점수는 변경되지 않습니다.');
  await Promise.all([loadMyReports(), loadNotifications()]);
}

async function loadChats() {
  const { items } = await api('/api/v1/me/chat-rooms');
  $('chatRooms').innerHTML = items.length ? items.map((room) => `<button class="management-card trade-card" data-room="${escapeHtml(room.id)}"><div><small>${room.myRole === 'buyer' ? '구매 문의' : '판매 문의'} · ${escapeHtml(room.status)}</small><h3>${escapeHtml(room.product?.title || '상품정보 없음')}</h3><p>${escapeHtml(room.lastMessage?.content || '새 채팅방')}</p></div><span>열기 ›</span></button>`).join('') : '<p class="empty">참여 중인 채팅이 없습니다.</p>';
  document.querySelectorAll('[data-room]').forEach((button) => button.addEventListener('click', () => openChat(button.dataset.room).catch((error) => alert(error.message))));
}

async function openChat(roomId) {
  const data = await api(`/api/v1/chat-rooms/${roomId}`); state.activeRoom = data.room; state.agreement = data.agreement;
  $('chatTitle').textContent = state.products.find((item) => item.id === data.room.productId)?.title || '거래 채팅';
  $('chatMessages').innerHTML = data.messages.length ? data.messages.map((message) => `<p class="${message.senderId === state.user.id ? 'mine' : ''}">${escapeHtml(message.content)}</p>`).join('') : '<p class="empty">첫 메시지를 보내보세요.</p>';
  const agreement = data.agreement;
  $('agreementBox').innerHTML = agreement ? `<p><strong>${escapeHtml(agreement.price)} Test-Pi · ${agreement.type === 'direct' ? '직거래' : 'Testnet 택배'}</strong></p><p>구매자 ${agreement.buyerConfirmed ? '확인' : '대기'} · 판매자 ${agreement.sellerConfirmed ? '확인' : '대기'}</p><button id="confirmAgreement" class="primary">이 조건 확인</button>${agreement.buyerConfirmed && agreement.sellerConfirmed ? '<button id="createTrade" class="secondary">거래 시작</button>' : ''}` : '<p>아직 제안된 거래조건이 없습니다.</p>';
  $('chatDetail').classList.remove('hidden');
  $('confirmAgreement')?.addEventListener('click', () => confirmCurrentAgreement().catch((error) => alert(error.message)));
  $('createTrade')?.addEventListener('click', () => createCurrentTrade().catch((error) => alert(error.message)));
  $('chatDetail').scrollIntoView({ behavior: 'smooth' });
}

async function confirmCurrentAgreement() { await api(`/api/v1/agreements/${state.agreement.id}/confirm`, { method: 'POST' }); await openChat(state.activeRoom.id); await loadChats(); }
async function createCurrentTrade() { const result = await api(`/api/v1/agreements/${state.agreement.id}/trades`, { method: 'POST' }); state.trade = result.trade; alert('거래가 생성됐습니다. 내 거래에서 진행상태를 확인하세요.'); await Promise.all([loadMyTrades(), openChat(state.activeRoom.id)]); }
async function sendMessage(event) { event.preventDefault(); if (!state.activeRoom) return; await api(`/api/v1/chat-rooms/${state.activeRoom.id}/messages`, { method: 'POST', body: JSON.stringify({ content: $('messageText').value }) }); $('messageText').value = ''; await Promise.all([openChat(state.activeRoom.id), loadChats()]); }

async function preparePayment() {
  if (!state.trade || state.trade.type !== 'parcel_testnet') return;
  const { payment } = await api(`/api/v1/trades/${state.trade.id}/payments`, { method: 'POST' });
  state.payment = payment; log('서버 결제 준비 완료', payment);
  if (!window.Pi || !state.user) { log('Pi 로그인 후 실제 Sandbox 창을 열 수 있습니다. 현재는 서버 모의 준비까지만 완료했습니다.'); return; }
  const callbacks = {
    onReadyForServerApproval: async (piPaymentId) => {
      await api(`/api/v1/payments/${payment.id}/approve`, { method: 'POST', body: JSON.stringify({ piPaymentId }) });
      log('Pi 서버 승인 단계 완료');
    },
    onReadyForServerCompletion: async (piPaymentId, txid) => {
      const result = await api(`/api/v1/payments/${payment.id}/complete`, { method: 'POST', body: JSON.stringify({ piPaymentId, txid }) });
      log('Test-Pi 결제 완료', result.payment);
    },
    onCancel: (id) => log(`결제 취소: ${id}`),
    onError: (error) => log(`Pi 오류: ${error.message || error}`)
  };
  await Pi.createPayment({ amount: payment.buyerTotal, memo: 'Global Market Testnet 기능시험', metadata: { tradeId: state.trade.id, internalPaymentId: payment.id, network: 'testnet' } }, callbacks);
}

async function runChecklistPayment() {
  if (!state.user) return alert('Pi Testnet 로그인이 필요합니다.');
  if (!confirm('Pi 체크리스트 확인용 0.01 Test-Pi 거래입니다. 실제 Pi가 아닙니다. 계속할까요?')) return;
  const { trade } = await api('/api/v1/testnet/checklist-trades', { method: 'POST' });
  state.trade = trade; await preparePayment();
}

async function health() {
  try { const data = await api('/api/v1/health'); $('health').textContent = data.network === 'testnet' ? 'Testnet 정상' : '차단 필요'; }
  catch { $('health').textContent = '서버 오류'; }
}

async function logout() { await api('/api/v1/auth/logout', { method: 'POST' }); state.user = null; state.sessionToken = null; state.activeRoom = null; state.editingProduct = null; $('authState').textContent = '로그인 전'; $('logout').classList.add('hidden'); $('checklistPayment').classList.add('hidden'); $('piLogin').classList.remove('hidden'); ['myPanel', 'chatPanel', 'registerPanel', 'editProductPanel'].forEach((id) => $(id).classList.add('hidden')); }

$('piLogin').addEventListener('click', () => loginPi().catch((error) => alert(error.message)));
$('logout').addEventListener('click', () => logout().catch((error) => alert(error.message)));
$('checklistPayment').addEventListener('click', () => runChecklistPayment().catch((error) => alert(error.message)));
$('closeProductDetail').addEventListener('click', () => { $('productDetailPanel').classList.add('hidden'); state.selectedProduct = null; });
$('startProductTrade').addEventListener('click', () => { if (state.selectedProduct) chooseTrade(state.selectedProduct.id).catch((error) => alert(error.message)); });
$('toggleFavorite').addEventListener('click', () => toggleFavorite().catch((error) => alert(error.message)));
$('reportProduct').addEventListener('click', () => reportSelectedProduct().catch((error) => alert(error.message)));
$('refresh').addEventListener('click', () => loadProducts().catch((error) => alert(error.message)));
$('loadMoreProducts').addEventListener('click', () => loadProducts(state.productQuery, true).catch((error) => alert(error.message)));
$('searchForm').addEventListener('submit', (event) => { event.preventDefault(); const params = new URLSearchParams(); [['q', 'searchKeyword'], ['categoryId', 'searchCategory'], ['method', 'searchMethod'], ['sort', 'searchSort'], ['minPrice', 'searchMin'], ['maxPrice', 'searchMax']].forEach(([key, id]) => { if ($(id).value) params.set(key, $(id).value); }); loadProducts(params.toString()).catch((error) => alert(error.message)); });
$('clearSearch').addEventListener('click', () => { $('searchForm').reset(); loadProducts().catch((error) => alert(error.message)); });
$('preparePayment').addEventListener('click', () => preparePayment().catch((error) => log(error.message)));
$('mockComplete').addEventListener('click', () => log('구매확정·모의정산은 관리자 테스트 API 단계에서 수행합니다.'));
$('refreshMy').addEventListener('click', () => loadMyMarket().catch((error) => alert(error.message)));
$('showMyProducts').addEventListener('click', () => showManagement('products'));
$('showMyFavorites').addEventListener('click', () => showManagement('favorites'));
$('showMyTrades').addEventListener('click', () => showManagement('trades'));
$('navHome').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
$('navSearch').addEventListener('click', () => $('products').scrollIntoView({ behavior: 'smooth' }));
$('navRegister').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 등록할 수 있습니다.'); $('registerPanel').classList.remove('hidden'); $('registerPanel').scrollIntoView({ behavior: 'smooth' }); });
$('navChat').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 이용할 수 있습니다.'); $('chatPanel').classList.remove('hidden'); loadChats().then(() => $('chatPanel').scrollIntoView({ behavior: 'smooth' })).catch((error) => alert(error.message)); });
$('navMy').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 이용할 수 있습니다.'); $('myPanel').classList.remove('hidden'); loadMyMarket().then(() => $('myPanel').scrollIntoView({ behavior: 'smooth' })).catch((error) => alert(error.message)); });
$('productForm').addEventListener('submit', registerProduct);
$('productImage').addEventListener('change', () => prepareSelectedImages('productImage', 'registerProductImages', 'registerImages', 'registerResult'));
$('editProductForm').addEventListener('submit', saveProductEdit);
$('editProductImage').addEventListener('change', () => prepareSelectedImages('editProductImage', 'editProductImages', 'editingImages', 'editProductResult'));
$('cancelProductEdit').addEventListener('click', closeProductEdit);
$('messageForm').addEventListener('submit', (event) => sendMessage(event).catch((error) => alert(error.message)));
$('refreshChats').addEventListener('click', () => loadChats().catch((error) => alert(error.message)));
health(); loadProducts(); loadCategories();
