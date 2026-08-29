'use strict';

const state = { user: null, sessionToken: null, adminKey: null, adminAlertTimer: null, homeMode: true, products: [], popularProducts: [], productQuery: '', productHasMore: false, categories: [], selectedProduct: null, editingProduct: null, registerImages: [], editingImages: [], room: null, agreement: null, trade: null, payment: null, activeRoom: null };
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const shortReference = (value) => { const text = String(value || ''); return text.length > 18 ? `${text.slice(0, 11)}…${text.slice(-6)}` : text; };
const safeProductImage = (value) => /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(value || '')) ? value : null;
const productImages = (product) => (Array.isArray(product?.images) ? product.images : (product?.imageData ? [product.imageData] : [])).map(safeProductImage).filter(Boolean).slice(0, 3);
const DAILY_SESSION_KEY = 'gm_testnet_daily_session';

function koreaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function saveDailySession(token) {
  if (!token) return;
  try { localStorage.setItem(DAILY_SESSION_KEY, JSON.stringify({ token, date: koreaDateKey() })); } catch { /* Pi Browser may disable persistent storage; the server cookie remains the fallback. */ }
}

function loadDailySession() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_SESSION_KEY) || 'null');
    if (!saved?.token || saved.date !== koreaDateKey()) {
      try { localStorage.removeItem(DAILY_SESSION_KEY); } catch { /* storage unavailable */ }
      return null;
    }
    return saved.token;
  } catch {
    try { localStorage.removeItem(DAILY_SESSION_KEY); } catch { /* storage unavailable */ }
    return null;
  }
}

function clearDailySession() { try { localStorage.removeItem(DAILY_SESSION_KEY); } catch { /* storage unavailable */ } }

function closeExitConfirm() {
  $('exitConfirm').classList.add('hidden');
  state.exitConfirmOpen = false;
}

function openExitConfirm() {
  history.pushState({ gmApp: true, gmView: 'home' }, '', location.href);
  showHome(false);
  $('exitConfirm').classList.remove('hidden');
  state.exitConfirmOpen = true;
}

function pushAppHistory(entry) {
  if (state.handlingHistory) return;
  const next = { gmApp: true, ...entry };
  if (JSON.stringify(history.state) !== JSON.stringify(next)) history.pushState(next, '', location.href);
}

function initializeNavigationHistory() {
  if (!history.state?.gmApp) {
    history.replaceState({ gmApp: true, gmView: 'exitGuard' }, '', location.href);
    history.pushState({ gmApp: true, gmView: 'home' }, '', location.href);
  }
  window.addEventListener('popstate', async (event) => {
    const route = event.state;
    if (!route?.gmApp) return;
    if (route.gmView === 'exitGuard') {
      if (state.exitConfirmOpen) {
        history.pushState({ gmApp: true, gmView: 'home' }, '', location.href);
        closeExitConfirm();
      } else openExitConfirm();
      return;
    }
    state.handlingHistory = true;
    try {
      if (route.gmView === 'home') showHome(false);
      else if (route.gmView === 'search') showSearch(false);
      else if (route.gmView === 'panel' && $(route.panelId)) showFeaturePanel(route.panelId, false);
      else if (route.gmView === 'product' && route.productId) await openProductDetail(route.productId, false);
      else showHome(false);
    } finally { state.handlingHistory = false; }
  });
}

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

async function adminApi(path, options = {}) {
  if (!state.adminKey) throw new Error('관리자 키를 먼저 확인하세요.');
  return api(path, { ...options, headers: { 'x-test-admin-key': state.adminKey, 'x-test-admin-id': 'web-test-admin', ...(options.headers || {}) } });
}

function renderAdminUsers(items) {
  $('adminUsers').innerHTML = items.length ? items.map((user) => `
    <article class="management-card admin-user-card">
      <div><strong>${escapeHtml(user.username)}</strong><p class="meta">${escapeHtml(user.id)} · ${user.status === 'suspended' ? '이용 정지' : '활성'}</p></div>
      <div class="admin-user-stats"><span>${escapeHtml(user.trust.level)} ${escapeHtml(user.trust.score)}점</span><span>정상거래 ${escapeHtml(user.trust.normalTradeCount)}건</span><span>판매중 ${escapeHtml(user.activeProductCount)}/${escapeHtml(user.productCount)}</span></div>
      <button class="${user.status === 'suspended' ? 'secondary' : 'secondary danger-text'}" data-admin-user="${escapeHtml(user.id)}" data-admin-status="${user.status === 'suspended' ? 'active' : 'suspended'}">${user.status === 'suspended' ? '계정 복구' : '계정 정지'}</button>
    </article>`).join('') : '<p class="empty">조건에 맞는 회원이 없습니다.</p>';
  $('adminUsers').querySelectorAll('[data-admin-user]').forEach((button) => button.addEventListener('click', () => changeAdminUserStatus(button)));
}

async function loadAdminUsers() {
  const params = new URLSearchParams();
  const q = $('adminUserQuery').value.trim();
  const status = $('adminUserStatus').value;
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const { items } = await adminApi(`/api/v1/admin/users?${params}`);
  renderAdminUsers(items);
  $('adminResult').textContent = `회원 ${items.length}명을 확인했습니다.`;
}

async function changeAdminUserStatus(button) {
  const nextStatus = button.dataset.adminStatus;
  const action = nextStatus === 'suspended' ? '정지' : '복구';
  const reason = prompt(`계정 ${action} 사유를 입력하세요.`);
  if (!reason?.trim()) return;
  if (!confirm(`이 계정을 ${action}할까요?`)) return;
  try {
    const { revokedSessions = 0, pausedProducts = 0 } = await adminApi(`/api/v1/admin/users/${encodeURIComponent(button.dataset.adminUser)}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, reason: reason.trim() }) });
    $('adminResult').textContent = `계정을 ${action}했습니다. 종료된 로그인 ${revokedSessions}개, 중지된 상품 ${pausedProducts}개.`;
    await loadAdminUsers();
  } catch (error) { $('adminResult').textContent = error.message; }
}

const adminReportStatusNames = { received: '접수', reviewing: '검토 중', closed: '처리 완료' };
const adminDecisionNames = { violation_confirmed: '위반 확인', no_violation: '위반 없음', insufficient_evidence: '증거 부족' };
const suggestionCategoryNames = { general: '이용 문의', suggestion: '건의사항', payment: '결제', trade: '거래', report_dispute: '신고·분쟁' };

function renderAdminReports(items) {
  $('adminReports').innerHTML = items.length ? items.map((report) => `
    <article class="management-card admin-report-card">
      <div><strong>${escapeHtml(report.targetType)} 신고</strong><p class="meta">${escapeHtml(report.id)} · ${escapeHtml(adminReportStatusNames[report.status] || report.status)}</p></div>
      <p>${escapeHtml(report.reason)}</p><p class="meta">대상 ${escapeHtml(report.targetId)} · 접수 ${escapeHtml(new Date(report.createdAt).toLocaleString())}</p>
      ${report.decision ? `<p class="admin-decision"><strong>${escapeHtml(adminDecisionNames[report.decision.type] || report.decision.type)}</strong> · ${escapeHtml(report.decision.reason)}</p>` : ''}
      <div class="actions">
        ${report.status === 'received' ? `<button class="secondary" data-report-assign="${escapeHtml(report.id)}">내가 검토</button>` : ''}
        ${report.status === 'reviewing' ? `<select data-report-decision-type="${escapeHtml(report.id)}"><option value="violation_confirmed">위반 확인</option><option value="no_violation">위반 없음</option><option value="insufficient_evidence">증거 부족</option></select><button class="primary" data-report-decide="${escapeHtml(report.id)}">판정 저장</button>` : ''}
      </div>
    </article>`).join('') : '<p class="empty">접수된 신고가 없습니다.</p>';
  $('adminReports').querySelectorAll('[data-report-assign]').forEach((button) => button.addEventListener('click', () => assignAdminReport(button.dataset.reportAssign)));
  $('adminReports').querySelectorAll('[data-report-decide]').forEach((button) => button.addEventListener('click', () => decideAdminReport(button.dataset.reportDecide)));
}

async function loadAdminReports() {
  const { items } = await adminApi('/api/v1/admin/reports');
  renderAdminReports(items);
  return items.length;
}

function renderAdminSuggestions(items) {
  $('adminSuggestions').innerHTML = items.length ? items.map((item) => `
    <article class="management-card">
      <div><strong>${escapeHtml(item.title || '기존 건의사항')}</strong><p class="meta">${escapeHtml(suggestionCategoryNames[item.category] || '건의사항')} · ${escapeHtml(item.id)} · ${item.status === 'closed' ? '답변 완료' : '접수'}</p></div>
      <p>${escapeHtml(item.content)}</p><p class="meta">접수 ${escapeHtml(new Date(item.createdAt).toLocaleString())}</p>
      ${item.decision ? `<p class="admin-decision"><strong>처리 내용</strong> · ${escapeHtml(item.decision.reason)}</p>` : ''}
      ${item.status !== 'closed' ? `<button class="primary" type="button" data-suggestion-close="${escapeHtml(item.id)}">처리 완료</button>` : ''}
    </article>`).join('') : '<p class="empty">접수된 건의사항이 없습니다.</p>';
  $('adminSuggestions').querySelectorAll('[data-suggestion-close]').forEach((button) => button.addEventListener('click', () => closeAdminSuggestion(button.dataset.suggestionClose)));
}

async function loadAdminSuggestions() {
  const { items } = await adminApi('/api/v1/admin/suggestions');
  renderAdminSuggestions(items);
  return items.length;
}

function renderAdminAnnouncements(items) {
  $('adminAnnouncements').innerHTML = `<button id="createAdminAnnouncement" class="primary wide" type="button">새 운영 공지 등록</button>${items.length ? items.map((item) => `<article class="management-card"><div><strong>${escapeHtml(item.title)}</strong><p class="meta">${item.status === 'active' ? '게시 중' : '게시 종료'} · ${escapeHtml(new Date(item.createdAt).toLocaleString())}</p></div><p>${escapeHtml(item.body)}</p>${item.status === 'active' ? `<button class="secondary" type="button" data-announcement-archive="${escapeHtml(item.id)}">공지 종료</button>` : `<p class="meta">종료 사유: ${escapeHtml(item.archiveReason || '')}</p>`}</article>`).join('') : '<p class="empty">등록된 운영 공지가 없습니다.</p>'}`;
  $('createAdminAnnouncement').addEventListener('click', createAdminAnnouncement);
  $('adminAnnouncements').querySelectorAll('[data-announcement-archive]').forEach((button) => button.addEventListener('click', () => archiveAdminAnnouncement(button.dataset.announcementArchive)));
}

async function loadAdminAnnouncements() { const { items } = await adminApi('/api/v1/admin/announcements'); renderAdminAnnouncements(items); return items.filter((item) => item.status === 'active').length; }
async function createAdminAnnouncement() {
  const title = prompt('모든 고객에게 표시할 운영 공지 제목을 입력하세요.');
  if (!title?.trim()) return;
  const body = prompt('이용 주의사항 또는 편의사항을 입력하세요.');
  if (!body?.trim() || !confirm('이 내용을 모든 고객의 상단 알림종에 게시할까요?')) return;
  try {
    await adminApi('/api/v1/admin/announcements', { method: 'POST', body: JSON.stringify({ title: title.trim(), body: body.trim() }) });
    $('adminResult').textContent = '관리팀 운영 공지를 게시했습니다. 모든 고객의 알림종에 새 공지 숫자가 표시됩니다.';
    await Promise.all([loadAdminAnnouncements(), ...(state.user ? [loadAnnouncements()] : [])]);
  } catch (error) { $('adminResult').textContent = error.message; }
}
async function archiveAdminAnnouncement(id) { const reason = prompt('공지 종료 사유를 입력하세요.'); if (!reason?.trim()) return; try { await adminApi(`/api/v1/admin/announcements/${encodeURIComponent(id)}/archive`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }); $('adminResult').textContent = '운영 공지 게시를 종료했습니다.'; await loadAdminAnnouncements(); } catch (error) { $('adminResult').textContent = error.message; } }

async function closeAdminSuggestion(id) {
  const reason = prompt('처리 내용 또는 답변을 입력하세요. 사용자에게 알림으로 전달됩니다.');
  if (!reason?.trim()) return;
  try {
    await adminApi(`/api/v1/admin/suggestions/${encodeURIComponent(id)}/close`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
    $('adminResult').textContent = '건의사항을 처리 완료했습니다.';
    await Promise.all([loadAdminSuggestions(), loadAdminDashboard()]);
  } catch (error) { $('adminResult').textContent = error.message; }
}

async function assignAdminReport(reportId) {
  try {
    await adminApi(`/api/v1/admin/reports/${encodeURIComponent(reportId)}/assign`, { method: 'POST', body: JSON.stringify({ reason: '웹 관리자 검토 시작' }) });
    $('adminResult').textContent = '신고 검토를 시작했습니다. 내용을 확인하고 판정하세요.';
    await loadAdminReports();
  } catch (error) { $('adminResult').textContent = error.message; }
}

async function decideAdminReport(reportId) {
  const type = [...document.querySelectorAll('[data-report-decision-type]')].find((item) => item.dataset.reportDecisionType === reportId)?.value;
  const reason = prompt('판정 사유를 입력하세요. 신고자에게 안내됩니다.');
  if (!reason?.trim() || !type) return;
  if (!confirm(`${adminDecisionNames[type]}으로 처리할까요?`)) return;
  try {
    await adminApi(`/api/v1/admin/reports/${encodeURIComponent(reportId)}/decision`, { method: 'POST', body: JSON.stringify({ type, reason: reason.trim() }) });
    $('adminResult').textContent = '신고 판정을 저장했습니다. 이 판정만으로 계정이 자동 정지되지는 않습니다.';
    await loadAdminReports();
  } catch (error) { $('adminResult').textContent = error.message; }
}

const adminActionNames = { USER_STATUS_CHANGED: '회원 상태 변경', PRODUCT_REVIEW_DECIDED: '상품 검토 판정', REPORT_ASSIGNED: '신고 담당 지정', REPORT_DECIDED: '신고 판정', DISPUTE_DECIDED: '분쟁 판정', SUGGESTION_CLOSED: '건의사항 처리', ANNOUNCEMENT_CREATED: '운영 공지 등록', ANNOUNCEMENT_ARCHIVED: '운영 공지 종료' };

async function loadAdminAudit() {
  const { items } = await adminApi('/api/v1/admin/audit-logs');
  $('adminAudit').innerHTML = items.length ? items.map((item) => `
    <article class="management-card admin-audit-card">
      <div><strong>${escapeHtml(adminActionNames[item.action] || item.action)}</strong><p class="meta">${escapeHtml(new Date(item.createdAt).toLocaleString())} · ${escapeHtml(item.adminId)}</p></div>
      <p>${escapeHtml(item.reason)}</p><p class="meta">${escapeHtml(item.targetType)} · ${escapeHtml(item.targetId)}</p>
    </article>`).join('') : '<p class="empty">관리자 작업기록이 없습니다.</p>';
  return items.length;
}

const disputeDecisionNames = { full_refund: 'Test-Pi 전액 모의환불', partial_refund: 'Test-Pi 부분 모의환불', release_settlement: '판매자 모의정산 진행' };
const faultNames = { seller_fault: '판매자 과실', buyer_fault: '구매자 과실', shared_fault: '공동 과실', platform_fault: '플랫폼 과실' };

function renderAdminDisputes(items) {
  $('adminDisputes').innerHTML = items.length ? items.map((item) => `
    <article class="management-card admin-report-card">
      <div><strong>${escapeHtml(item.productTitle)}</strong><p class="meta">분쟁 ${escapeHtml(item.id)} · ${item.status === 'closed' ? '처리 완료' : '접수'}</p></div>
      <p>${escapeHtml(item.reason)}</p><p class="meta">거래 ${escapeHtml(item.tradeId)} · ${escapeHtml(item.amount)} Test-Pi · ${item.settlementHold ? '정산 보류 중' : '정산 보류 해제'}</p>
      ${item.decision ? `<p class="admin-decision"><strong>${escapeHtml(disputeDecisionNames[item.decision.type] || item.decision.type)}</strong> · ${escapeHtml(item.decision.reason)}</p>` : ''}
      ${item.status !== 'closed' ? `<div class="actions"><select data-dispute-type="${escapeHtml(item.id)}"><option value="full_refund">전액 모의환불</option><option value="partial_refund">부분 모의환불</option><option value="release_settlement">판매자 모의정산 진행</option></select><select data-dispute-fault="${escapeHtml(item.id)}"><option value="seller_fault">판매자 과실</option><option value="buyer_fault">구매자 과실</option><option value="shared_fault">공동 과실</option><option value="platform_fault">플랫폼 과실</option></select><button class="primary" data-dispute-decide="${escapeHtml(item.id)}">분쟁 판정</button></div>` : ''}
    </article>`).join('') : '<p class="empty">조건에 맞는 택배 안전거래 분쟁이 없습니다.</p>';
  $('adminDisputes').querySelectorAll('[data-dispute-decide]').forEach((button) => button.addEventListener('click', () => decideAdminDispute(button.dataset.disputeDecide)));
}

async function loadAdminDisputes() {
  const { items } = await adminApi('/api/v1/admin/disputes');
  renderAdminDisputes(items);
  return items.length;
}

async function decideAdminDispute(disputeId) {
  const type = [...document.querySelectorAll('[data-dispute-type]')].find((item) => item.dataset.disputeType === disputeId)?.value;
  const faultType = [...document.querySelectorAll('[data-dispute-fault]')].find((item) => item.dataset.disputeFault === disputeId)?.value;
  if (!type) return;
  const body = { type, faultType };
  if (type === 'partial_refund') {
    const retainedAmount = prompt('판매자에게 남길 Test-Pi 금액을 입력하세요.');
    if (retainedAmount === null || retainedAmount.trim() === '') return;
    body.retainedAmount = Number(retainedAmount);
    if (!Number.isFinite(body.retainedAmount) || body.retainedAmount < 0) return alert('올바른 Test-Pi 금액을 입력하세요.');
  }
  const reason = prompt('분쟁 판정 사유를 입력하세요. 신청자에게 안내됩니다.');
  if (!reason?.trim()) return;
  body.reason = reason.trim();
  if (!confirm(`${disputeDecisionNames[type]} · ${faultNames[faultType] || '과실 판정 없음'}으로 처리할까요? 과실 판정은 상품대금 처리에만 사용되며 가스비는 각자가 부담합니다. 실제 Pi가 이동하지 않는 Testnet 모의처리입니다.`)) return;
  try {
    await adminApi(`/api/v1/admin/disputes/${encodeURIComponent(disputeId)}/decision`, { method: 'POST', body: JSON.stringify(body) });
    $('adminResult').textContent = 'Testnet 분쟁 판정을 저장했습니다. 실제 Pi는 이동하지 않았습니다.';
    await Promise.all([loadAdminDisputes(), loadAdminAudit()]);
  } catch (error) { $('adminResult').textContent = error.message; }
}

function renderAdminProducts(items) {
  $('adminProducts').innerHTML = items.length ? items.map((item) => `
    <article class="management-card admin-report-card">
      ${item.images?.[0] ? `<img class="admin-review-image" src="${item.images[0]}" alt="${escapeHtml(item.title)} 검토 사진">` : ''}
      <div><strong>${escapeHtml(item.title)}</strong><p class="meta">${escapeHtml(item.sellerUsername)} · ${escapeHtml(item.price)} Test-Pi · ${escapeHtml(item.region)}</p></div>
      <p>${escapeHtml(item.description)}</p>
      <p class="meta">자동 검토 사유: ${(item.reviewReasons || []).map(escapeHtml).join(', ') || '상세 확인 필요'}</p>
      <div class="actions"><button class="primary" data-product-review="${escapeHtml(item.id)}" data-product-decision="approve">판매 승인</button><button class="secondary danger-text" data-product-review="${escapeHtml(item.id)}" data-product-decision="reject">등록 거절</button></div>
    </article>`).join('') : '<p class="empty">검토 대기 중인 상품이 없습니다.</p>';
  $('adminProducts').querySelectorAll('[data-product-review]').forEach((button) => button.addEventListener('click', () => decideAdminProduct(button)));
}

async function loadAdminGasDebts() {
  const { items } = await adminApi('/api/v1/admin/gas-debts?status=appeal_pending');
  $('adminGasDebts').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>이의신청 검토 중</small><h3>${escapeHtml(item.outstandingAmount)} Pi</h3><p>${escapeHtml(item.appealReason)} · 미납번호 ${escapeHtml(item.id)}</p></div><div class="actions"><select data-debt-decision="${escapeHtml(item.id)}"><option value="uphold">미납 확정 유지</option><option value="adjust">금액 일부 조정</option><option value="cancel">미납 전액 취소</option></select><button class="primary" data-debt-decide="${escapeHtml(item.id)}">판정</button></div></article>`).join('') : '<p class="empty">검토할 미납 이의신청이 없습니다.</p>';
  $('adminGasDebts').querySelectorAll('[data-debt-decide]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.dataset.debtDecide; const type = [...document.querySelectorAll('[data-debt-decision]')].find((item) => item.dataset.debtDecision === id)?.value;
    const body = { type }; if (type === 'adjust') { const amount = prompt('조정할 미납 Pi 금액'); if (!amount) return; body.amount = Number(amount); }
    const reason = prompt('판정 사유를 입력하세요'); if (!reason?.trim() || !confirm('이의신청 판정을 확정할까요?')) return; body.reason = reason.trim();
    try { await adminApi(`/api/v1/admin/gas-debts/${id}/decision`, { method: 'POST', body: JSON.stringify(body) }); $('adminResult').textContent = '미납 이의신청 판정을 저장했습니다.'; await Promise.all([loadAdminGasDebts(), loadAdminAudit()]); } catch (error) { $('adminResult').textContent = error.message; }
  }));
  return items.length;
}

async function loadAdminProducts() {
  const { items } = await adminApi('/api/v1/admin/product-reviews');
  renderAdminProducts(items);
  return items.length;
}

async function loadAdminPopularProducts() {
  const { items } = await adminApi('/api/v1/admin/popular-products');
  $('adminPopular').innerHTML = items.length ? items.map((item) => `
    <article class="management-card">
      <div><small>${item.selected ? '추천 상품 노출 중' : '일반 상품'}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.price)} Test-Pi · ${escapeHtml(item.region)}</p></div>
      <button class="${item.selected ? 'secondary danger-text' : 'primary'}" data-popular-admin="${escapeHtml(item.id)}" data-popular-selected="${item.selected ? 'false' : 'true'}">${item.selected ? '선정 해제' : '추천 상품 선정'}</button>
    </article>`).join('') : '<p class="empty">선정 가능한 판매 중 상품이 없습니다.</p>';
  $('adminPopular').querySelectorAll('[data-popular-admin]').forEach((button) => button.addEventListener('click', async () => {
    const selected = button.dataset.popularSelected === 'true';
    const reason = prompt(selected ? '추천 상품 선정 사유를 입력하세요.' : '추천 상품 선정 해제 사유를 입력하세요.');
    if (!reason?.trim() || !confirm(selected ? '이 상품을 추천 상품 영역에 표시할까요?' : '이 상품을 추천 상품 영역에서 내릴까요?')) return;
    try {
      await adminApi(`/api/v1/admin/popular-products/${encodeURIComponent(button.dataset.popularAdmin)}`, { method: 'POST', body: JSON.stringify({ selected, reason: reason.trim() }) });
      $('adminResult').textContent = selected ? '추천 상품으로 선정했습니다.' : '추천 상품 선정을 해제했습니다.';
      await Promise.all([loadAdminPopularProducts(), loadAdminAudit(), loadPopularProducts()]);
    } catch (error) { $('adminResult').textContent = error.message; }
  }));
  return items.length;
}

async function loadAdminPromotions() {
  const { items, products } = await adminApi('/api/v1/admin/promotion-campaigns');
  const placementNames = { home_banner:'홈 배너', home_featured:'홈 추천 영역', search_top:'검색 상단' };
  $('adminPromotions').innerHTML = `<button id="createPromotion" class="primary" type="button">광고·협찬 계약 등록</button>` + (items.length ? items.map((item) => `<article class="management-card"><div><small>${item.type === 'sponsorship' ? '협찬' : '광고'} · ${escapeHtml(item.status)} · ${escapeHtml(placementNames[item.placement] || '홈 추천 영역')}</small><h3>${escapeHtml(item.sponsorName)}</h3><p>${escapeHtml(products.find((product) => product.id === item.productId)?.title || item.productId)} · ${escapeHtml(new Date(item.startAt).toLocaleDateString())}~${escapeHtml(new Date(item.endAt).toLocaleDateString())}</p></div>${item.status !== 'ended' ? `<button data-promotion-end="${escapeHtml(item.id)}">계약 종료</button>` : ''}</article>`).join('') : '<p class="empty">등록된 광고·협찬 계약이 없습니다.</p>');
  $('createPromotion').addEventListener('click', async () => {
    const productId = prompt(`대상 상품 번호\n${products.map((item) => `${item.id}: ${item.title}`).join('\n')}`); if (!products.some((item) => item.id === productId)) return;
    const sponsorName = prompt('광고주 또는 협찬사 이름'); if (!sponsorName?.trim()) return;
    const type = confirm('협찬이면 확인, 광고이면 취소') ? 'sponsorship' : 'advertising'; const placement = prompt('노출 위치: home_banner / home_featured / search_top', 'home_featured'); const startAt = prompt('시작일: 2026-09-01'); const endAt = prompt('종료일: 2026-09-30'); const note = prompt('계약 메모');
    try { await adminApi('/api/v1/admin/promotion-campaigns', { method:'POST', body:JSON.stringify({ productId, sponsorName, type, placement, startAt, endAt, note }) }); await Promise.all([loadAdminPromotions(), loadAdminAudit()]); } catch(error) { $('adminResult').textContent=error.message; }
  });
  $('adminPromotions').querySelectorAll('[data-promotion-end]').forEach((button) => button.addEventListener('click', async () => { const reason=prompt('계약 종료 사유'); if(!reason?.trim() || !confirm('이 계약을 종료할까요?')) return; try { await adminApi(`/api/v1/admin/promotion-campaigns/${encodeURIComponent(button.dataset.promotionEnd)}/end`, { method:'POST', body:JSON.stringify({reason:reason.trim()}) }); await Promise.all([loadAdminPromotions(),loadAdminAudit()]); } catch(error) { $('adminResult').textContent=error.message; } }));
  return items.length;
}

async function decideAdminProduct(button) {
  const decision = button.dataset.productDecision;
  const action = decision === 'approve' ? '판매 승인' : '등록 거절';
  const reason = prompt(`${action} 사유를 입력하세요. 판매자에게 안내됩니다.`);
  if (!reason?.trim()) return;
  if (!confirm(`이 상품을 ${action}할까요?`)) return;
  try {
    await adminApi(`/api/v1/admin/product-reviews/${encodeURIComponent(button.dataset.productReview)}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() }) });
    $('adminResult').textContent = `상품을 ${action}했습니다.`;
    await Promise.all([loadAdminProducts(), loadAdminAudit()]);
  } catch (error) { $('adminResult').textContent = error.message; }
}

async function loadAdminDashboard() {
  const { summary } = await adminApi('/api/v1/admin/dashboard');
  const alerts = [
    summary.suggestions.open > 0 ? ['suggestions', '새 건의사항 확인 필요', `미처리 건의사항 ${summary.suggestions.open}건`] : null,
    summary.reports.open > 0 ? ['reports', '새 신고 확인 필요', `미처리 신고 ${summary.reports.open}건`] : null,
    summary.disputes.open > 0 ? ['disputes', '새 분쟁 확인 필요', `미처리 분쟁 ${summary.disputes.open}건`] : null,
    summary.products.reviewPending > 0 ? ['products', '상품 검토 필요', `검토 대기 ${summary.products.reviewPending}건`] : null
  ].filter(Boolean);
  $('adminAlerts').innerHTML = alerts.length ? alerts.map(([section, title, body]) => `<div class="admin-alert"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)} · 관리자 화면을 열어둔 동안 30초마다 갱신됩니다.</small></div><button type="button" data-admin-alert-go="${section}">확인</button></div>`).join('') : '<p class="empty">새로운 관리자 알림이 없습니다.</p>';
  $('adminAlerts').querySelectorAll('[data-admin-alert-go]').forEach((button) => button.addEventListener('click', () => {
    const targets = { products: 'showAdminProducts', reports: 'showAdminReports', disputes: 'showAdminDisputes', suggestions: 'showAdminSuggestions' };
    $(targets[button.dataset.adminAlertGo]).click();
  }));
  const cards = [
    ['users', summary.users.total, `회원 · 정지 ${summary.users.suspended}`],
    ['products', summary.products.reviewPending, '상품 검토 대기'],
    ['reports', summary.reports.open, '미처리 신고'],
    ['disputes', summary.disputes.open, '미처리 분쟁'],
    ['suggestions', summary.suggestions.open, '미처리 건의사항']
  ];
  $('adminDashboard').innerHTML = cards.map(([section, count, label]) => `<button type="button" data-admin-go="${section}"><strong>${escapeHtml(count)}</strong><small>${escapeHtml(label)}</small></button>`).join('');
  $('adminDashboard').querySelectorAll('[data-admin-go]').forEach((button) => button.addEventListener('click', () => {
    const targets = { users: 'showAdminUsers', products: 'showAdminProducts', reports: 'showAdminReports', disputes: 'showAdminDisputes', suggestions: 'showAdminSuggestions', gasDebts: 'showAdminGasDebts' };
    $(targets[button.dataset.adminGo]).click();
  }));
}

function startAdminAlertPolling() {
  clearInterval(state.adminAlertTimer);
  state.adminAlertTimer = setInterval(() => {
    if (!state.adminKey || $('adminPanel').classList.contains('hidden')) return;
    loadAdminDashboard().catch((error) => { $('adminResult').textContent = error.message; });
  }, 30000);
}

function stopAdminAlertPolling() {
  clearInterval(state.adminAlertTimer);
  state.adminAlertTimer = null;
}

function showAdminSection(name) {
  const users = name === 'users';
  const products = name === 'products';
  const popular = name === 'popular';
  const promotions = name === 'promotions';
  const reports = name === 'reports';
  const disputes = name === 'disputes';
  const suggestions = name === 'suggestions';
  const announcements = name === 'announcements';
  const gasDebts = name === 'gasDebts';
  $('adminUsers').classList.toggle('hidden', !users);
  $('adminProducts').classList.toggle('hidden', !products);
  $('adminPopular').classList.toggle('hidden', !popular);
  $('adminPromotions').classList.toggle('hidden', !promotions);
  $('adminReports').classList.toggle('hidden', !reports);
  $('adminDisputes').classList.toggle('hidden', !disputes);
  $('adminSuggestions').classList.toggle('hidden', !suggestions);
  $('adminAnnouncements').classList.toggle('hidden', !announcements);
  $('adminGasDebts').classList.toggle('hidden', !gasDebts);
  $('mockPayCompensations').classList.toggle('hidden', !gasDebts);
  $('adminAudit').classList.toggle('hidden', name !== 'audit');
  $('adminSearchForm').classList.toggle('hidden', !users);
  $('showAdminUsers').classList.toggle('active', users);
  $('showAdminProducts').classList.toggle('active', products);
  $('showAdminPopular').classList.toggle('active', popular);
  $('showAdminPromotions').classList.toggle('active', promotions);
  $('showAdminReports').classList.toggle('active', reports);
  $('showAdminDisputes').classList.toggle('active', disputes);
  $('showAdminSuggestions').classList.toggle('active', suggestions);
  $('showAdminAnnouncements').classList.toggle('active', announcements);
  $('showAdminGasDebts').classList.toggle('active', gasDebts);
  $('showAdminAudit').classList.toggle('active', name === 'audit');
  if (state.adminKey) loadAdminDashboard().catch((error) => { $('adminResult').textContent = error.message; });
}

function log(message, data) {
  $('log').textContent += `${new Date().toLocaleTimeString()} ${message}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}\n`;
}

function showPaymentResult(type, message) {
  const box = $('paymentResult');
  box.className = `payment-result ${type}`;
  box.textContent = message;
}

function renderQuote(quote) {
  $('quote').innerHTML = [
    ['상품금액', `${quote.productAmount} Test-Pi`], ['구매자 모의 수수료', `${quote.buyerFee} Test-Pi`],
    ['구매자 총액', `${quote.buyerTotal} Test-Pi`], ['판매자 모의 정산액', `${quote.sellerExpectedSettlement} Test-Pi`]
  ].map(([label,value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('');
}

async function loadProducts(query = '', append = false) {
  const params = new URLSearchParams(query);
  params.set('limit', state.homeMode && !query ? '8' : '20');
  params.set('offset', append ? String(state.products.length) : '0');
  const { items, pagination } = await api(`/api/v1/products?${params.toString()}`);
  state.productQuery = query;
  state.products = append ? [...state.products, ...items] : items;
  state.productHasMore = Boolean(pagination?.hasMore);
  $('loadMoreProducts').classList.toggle('hidden', !state.productHasMore);
  $('products').classList.toggle('home-product-row', state.homeMode && !query);
  $('products').classList.toggle('category-product-grid', !$('categoryBrowseBar').classList.contains('hidden'));
  $('products').innerHTML = state.products.length ? state.products.map((item) => `
    <article class="product">
      <div class="image">${productImages(item)[0] ? `<img src="${productImages(item)[0]}" alt="${escapeHtml(item.title)} 상품 사진">` : '<span aria-hidden="true">◉</span>'}</div>
      <h3>${escapeHtml(item.title)}</h3><p class="price">${escapeHtml(item.price)} Test-Pi</p>
      <p class="meta">${escapeHtml(item.region)} · 기능시험용 가상 상품</p>
      <p class="seller-line">${escapeHtml(item.seller?.username || 'Pi 사용자')} · ${escapeHtml(item.seller?.trustLevel || 'Bronze')}</p>
      <div class="method-row">${item.methods.map((method) => `<span class="tag">${method === 'direct' ? '직거래' : 'Testnet 택배'}</span>`).join('')}</div>
      <button data-product="${item.id}">상세 보기</button>
    </article>`).join('') : '<p class="empty product-empty">조건에 맞는 상품이 없습니다. 검색조건을 바꾸거나 초기화를 눌러보세요.</p>';
  document.querySelectorAll('[data-product]').forEach((button) => button.addEventListener('click', () => openProductDetail(button.dataset.product)));
}

async function loadPopularProducts() {
  const { items } = await api('/api/v1/popular-products');
  state.popularProducts = items;
  $('popularProductsEmpty').classList.toggle('hidden', items.length > 0);
  $('popularProducts').classList.toggle('hidden', items.length === 0);
  $('popularProducts').innerHTML = items.map((item) => `
    <article class="product">
      <div class="image">${productImages(item)[0] ? `<img src="${productImages(item)[0]}" alt="${escapeHtml(item.title)} 상품 사진">` : '<span aria-hidden="true">◉</span>'}</div>
      <h3>${escapeHtml(item.title)}</h3><p class="price">${escapeHtml(item.price)} Test-Pi</p>
      <button data-popular-product="${escapeHtml(item.id)}">상세 보기</button>
    </article>`).join('');
  $('popularProducts').querySelectorAll('[data-popular-product]').forEach((button) => button.addEventListener('click', () => openProductDetail(button.dataset.popularProduct)));
}

async function loadCategories() {
  const { items } = await api('/api/v1/categories');
  state.categories = items;
  $('productCategory').innerHTML = '<option value="">카테고리 선택</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  $('editProductCategory').innerHTML = '<option value="">카테고리 선택</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  $('searchCategory').innerHTML = '<option value="">전체 카테고리</option>' + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  const icons = { digital_devices: '📱', home_appliances: '🔌', furniture: '🪑', fashion: '👕', sports: '⚽', hobby: '🎨', books: '📚', baby: '🧸', vehicle_goods: '🚗', other_physical: '📦' };
  $('categoryGrid').innerHTML = items.map((item) => `<button type="button" data-home-category="${escapeHtml(item.id)}"><span>${icons[item.id] || '📦'}</span><small>${escapeHtml(item.name)}</small></button>`).join('');
  $('categoryGrid').querySelectorAll('[data-home-category]').forEach((button) => button.addEventListener('click', () => openCategory(button.dataset.homeCategory)));
}

function hideMainPanels() {
  ['productDetailPanel', 'myPanel', 'announcementPanel', 'registerPanel', 'editProductPanel', 'chatPanel', 'tradePanel', 'adminPanel', 'suggestionPanel'].forEach((id) => $(id).classList.add('hidden'));
}

function showHome(addHistory = true) {
  if (addHistory) pushAppHistory({ gmView: 'home' });
  hideMainPanels();
  state.homeMode = true;
  $('homeNotice').classList.remove('hidden');
  $('homeHero').classList.remove('hidden');
  $('homeCategories').classList.remove('hidden');
  $('marketSection').classList.remove('hidden');
  $('searchForm').classList.add('hidden');
  $('categoryBrowseBar').classList.add('hidden');
  $('marketEyebrow').textContent = 'NEW';
  $('marketTitle').textContent = '최근 등록 상품';
  $('popularProductsSection').classList.remove('hidden');
  Promise.all([loadProducts(), loadPopularProducts()]).catch((error) => alert(error.message));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSearch(addHistory = true) {
  if (addHistory) pushAppHistory({ gmView: 'search' });
  hideMainPanels();
  state.homeMode = false;
  $('homeNotice').classList.add('hidden');
  $('homeHero').classList.add('hidden');
  $('homeCategories').classList.add('hidden');
  $('marketSection').classList.remove('hidden');
  $('searchForm').classList.remove('hidden');
  $('categoryBrowseBar').classList.add('hidden');
  $('marketEyebrow').textContent = '상품 찾기';
  $('marketTitle').textContent = '상품 검색';
  $('popularProductsSection').classList.add('hidden');
  $('marketSection').scrollIntoView({ behavior: 'smooth' });
}

async function openCategory(categoryId) {
  showSearch();
  $('searchForm').reset();
  $('searchCategory').value = categoryId;
  $('searchForm').classList.add('hidden');
  $('categoryBrowseBar').classList.remove('hidden');
  $('marketEyebrow').textContent = '카테고리 상품';
  $('marketTitle').textContent = '상품 목록';
  $('selectedCategoryName').textContent = state.categories.find((item) => item.id === categoryId)?.name || '카테고리 상품';
  await loadProducts(`categoryId=${encodeURIComponent(categoryId)}`);
}

function showFeaturePanel(panelId, addHistory = true) {
  if (addHistory) pushAppHistory({ gmView: 'panel', panelId });
  hideMainPanels();
  state.homeMode = false;
  $('homeNotice').classList.add('hidden');
  $('homeHero').classList.add('hidden');
  $('homeCategories').classList.add('hidden');
  $('marketSection').classList.add('hidden');
  $(panelId).classList.remove('hidden');
  $(panelId).scrollIntoView({ behavior: 'smooth' });
}

async function openProductDetail(productId, addHistory = true) {
  const product = state.products.find((item) => item.id === productId) || state.popularProducts.find((item) => item.id === productId);
  if (!product) return;
  if (addHistory) pushAppHistory({ gmView: 'product', productId });
  state.selectedProduct = product;
  const images = productImages(product);
  $('productDetailGallery').innerHTML = images.length
    ? images.map((image, index) => `<img src="${image}" alt="${escapeHtml(product.title)} 상품 사진 ${index + 1}">`).join('')
    : '<div class="empty-image" aria-hidden="true">◉</div>';
  $('productDetailCategory').textContent = state.categories.find((item) => item.id === product.categoryId)?.name || '실물 상품';
  $('productDetailTitle').textContent = product.title;
  $('productDetailPrice').textContent = `${product.price} Test-Pi`;
  $('productDetailDescription').textContent = product.description;
  $('productDetailMeta').textContent = `${product.region} · Testnet 기능시험 상품`;
  $('productDetailSeller').innerHTML = `<small>판매자</small><strong>${escapeHtml(product.seller?.username || 'Pi 사용자')}</strong><span>${escapeHtml(product.seller?.trustLevel || 'Bronze')} · 정상거래 ${escapeHtml(product.seller?.normalTradeCount || 0)}건</span>`;
  $('productDetailMethods').innerHTML = product.methods.map((method) => `<span class="tag">${method === 'direct' ? '직거래' : 'Testnet 택배'}</span>`).join('');
  const walletActions = [];
  if (product.methods.includes('direct')) walletActions.push(product.directWalletAvailable
    ? '<button class="secondary" data-wallet-qr="direct">판매자 지갑 QR</button>'
    : '<p class="form-notice">판매자가 직거래 지갑을 아직 등록하지 않았습니다.</p>');
  if (product.methods.includes('parcel_testnet')) walletActions.push('<button class="secondary" data-wallet-qr="safe">안전거래 사업지갑 QR</button>');
  $('productWalletPayment').innerHTML = walletActions.join('');
  document.querySelectorAll('[data-wallet-qr]').forEach((button) => button.addEventListener('click', () => showWalletQr(button.dataset.walletQr)));
  $('productDetailReviews').innerHTML = '<p class="empty">후기를 불러오는 중입니다.</p>';
  $('toggleFavorite').textContent = product.isFavorite ? '♥ 찜 해제' : '♡ 찜하기';
  $('productDetailPanel').classList.remove('hidden');
  $('productDetailPanel').scrollIntoView({ behavior: 'smooth' });
  try {
    const { items } = await api(`/api/v1/products/${encodeURIComponent(product.id)}/reviews`);
    const sentimentNames = { positive: '긍정', neutral: '보통', negative: '아쉬움' };
    $('productDetailReviews').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${escapeHtml(sentimentNames[item.sentiment] || item.sentiment)} · ${escapeHtml(item.writerName)}</small><p>${escapeHtml(item.comment || '내용 없음')}</p></div></article>`).join('') : '<p class="empty">아직 등록된 판매자 후기가 없습니다.</p>';
  } catch (error) { $('productDetailReviews').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`; }
}

async function showWalletQr(mode) {
  const product = state.selectedProduct;
  if (!product) return;
  try {
    const result = await api(`/api/v1/products/${encodeURIComponent(product.id)}/wallet-qr?mode=${encodeURIComponent(mode)}`);
    const direct = mode === 'direct';
    $('productWalletPayment').innerHTML = `<article class="management-card"><div><small>${direct ? '직거래 개인지갑' : 'Testnet 안전거래 사업지갑'}</small><h3>${escapeHtml(result.amount)} Test-Pi</h3><div class="wallet-qr">${result.qrSvg}</div><p class="wallet-address">${escapeHtml(result.address)}</p><p class="form-notice">${direct ? '판매자 개인 지갑으로 직접 송금합니다. 플랫폼 보호·정산·환불이 적용되지 않습니다.' : 'Global Market Testnet 사업지갑입니다. 입금 확인과 환불·판매자 정산은 관리자가 수동 처리합니다.'}</p><button type="button" data-copy-wallet>지갑주소 복사</button></div></article>`;
    document.querySelector('[data-copy-wallet]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(result.address); alert('지갑주소를 복사했습니다.'); }
      catch { prompt('지갑주소를 길게 눌러 복사하세요.', result.address); }
    });
  } catch (error) { alert(error.message); }
}

async function registerProduct(event) {
  event.preventDefault();
  if (!state.user) return alert('Pi Testnet 로그인 후 등록할 수 있습니다.');
  const methods = [];
  if ($('methodDirect').checked) methods.push('direct');
  if ($('methodParcel').checked) methods.push('parcel_testnet');
  if (methods.includes('direct') && !$('productDirectWallet').value.trim()) return alert('직거래용 Pi 지갑주소를 입력하세요.');
  try {
    $('registerResult').textContent = '사진과 상품 정보를 준비하고 있습니다.';
    const images = [...state.registerImages];
    const body = { title: $('productTitle').value, description: $('productDescription').value, price: Number($('productPrice').value), categoryId: $('productCategory').value, region: $('productRegion').value, methods, images, directWalletAddress: $('productDirectWallet').value };
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
  state.sessionToken = session.sessionToken;
  saveDailySession(session.sessionToken);
  applyAuthenticatedUser(session.user, '서버 검증 완료');
  await Promise.all([loadMyMarket(), loadMySuggestions(), loadAnnouncements()]);
}

function applyAuthenticatedUser(user, message = '로그인 유지 중') {
  state.user = user;
  $('authState').textContent = `${user.username || user.id} · ${message} · 오늘 로그인 유지`;
  $('piLogin').classList.add('hidden');
  $('logout').classList.remove('hidden');
  $('checklistPayment').classList.remove('hidden');
}

async function restoreSession() {
  $('authState').textContent = '로그인 상태 확인 중';
  try {
    state.sessionToken ||= loadDailySession();
    const { user } = await api('/api/v1/me');
    applyAuthenticatedUser(user);
    await Promise.all([loadMyMarket(), loadMySuggestions(), loadAnnouncements()]);
  } catch {
    state.user = null;
    state.sessionToken = null;
    clearDailySession();
    $('authState').textContent = '로그인 전 · Pi Testnet 로그인이 필요합니다.';
    $('piLogin').classList.remove('hidden');
    $('logout').classList.add('hidden');
    $('checklistPayment').classList.add('hidden');
  }
}

const statusNames = { available: '판매중', paused: '판매중지', under_review: '검토중', rejected: '등록거절', reserved: '예약중', sold: '판매완료', payment_pending: '결제대기', shipping_pending: '발송대기', shipping: '배송중', delivered: '배송완료', purchase_confirmed: '구매확정', completed: '거래완료', cancelled: '취소', disputed: '분쟁중', refunded: '환불', mock_refunded: 'Testnet 전액환불' };

function openProductEdit(product) {
  state.editingProduct = product;
  $('editProductTitle').value = product.title;
  $('editProductDescription').value = product.description;
  $('editProductPrice').value = product.price;
  $('editProductCategory').value = product.categoryId;
  $('editProductRegion').value = product.region || '';
  $('editMethodDirect').checked = product.methods.includes('direct');
  $('editMethodParcel').checked = product.methods.includes('parcel_testnet');
  $('editProductDirectWallet').value = product.directWalletAddress || '';
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
  if (methods.includes('direct') && !$('editProductDirectWallet').value.trim()) return alert('직거래용 Pi 지갑주소를 입력하세요.');
  try {
    $('editProductResult').textContent = '수정 내용을 확인하고 있습니다.';
    const body = {
      title: $('editProductTitle').value,
      description: $('editProductDescription').value,
      price: Number($('editProductPrice').value),
      categoryId: $('editProductCategory').value,
      region: $('editProductRegion').value,
      methods,
      directWalletAddress: $('editProductDirectWallet').value
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
  $('myTrades').innerHTML = items.length ? items.map((item) => `<button class="management-card trade-card" data-trade-detail="${escapeHtml(item.id)}"><div><small>${item.myRole === 'buyer' ? '구매' : '판매'} · ${escapeHtml(statusNames[item.status] || item.status)}</small><h3>${escapeHtml(item.product?.title || (item.purpose === 'pi_checklist' ? 'Testnet 기능시험' : '상품정보 없음'))}</h3><p>${escapeHtml(item.amount)} Test-Pi · ${item.type === 'direct' ? '직거래' : 'Testnet 택배'}</p></div><span>상세 ›</span></button>`).join('') : '<p class="empty">진행한 거래가 없습니다.</p>';
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
  const tradeTitle = detail.product?.title || (trade.purpose === 'pi_checklist' ? 'Testnet 기능시험' : '상품정보 없음');
  const sentimentNames = { positive: '긍정', neutral: '보통', negative: '아쉬움' };
  const reviewSection = detail.reviews.length
    ? `<div class="section-title"><div><p class="eyebrow">TRADE REVIEWS</p><h3>이 거래의 후기</h3></div></div><div class="management-list">${detail.reviews.map((item) => `<article class="management-card"><div><small>${item.writerId === state.user.id ? '내가 작성한 후기' : '받은 후기'} · ${escapeHtml(sentimentNames[item.sentiment] || item.sentiment)}</small><p>${escapeHtml(item.comment || '내용 없음')}</p></div></article>`).join('')}</div>`
    : '';
  const settlementSection = detail.settlement ? `<div class="detail-grid"><p><small>Testnet 정산상태</small><strong>${detail.settlement.status === 'mock_pending_batch' ? '최소 정산금액 대기' : '모의정산 완료'}</strong></p><p><small>${detail.settlement.status === 'mock_pending_batch' ? '판매자 정산 대기 잔액' : '판매자 모의정산액'}</small><strong>${escapeHtml(detail.settlement.status === 'mock_pending_batch' ? detail.settlement.pendingAmount : detail.settlement.netAmount)} Test-Pi</strong></p></div>${detail.settlement.status === 'mock_pending_batch' ? '<p class="form-notice">정산액이 송금 가스비보다 작아 소멸시키지 않고 보관합니다. 다른 판매대금과 합산해 최소 정산금액을 충족하면 일괄 송금합니다.</p>' : ''}` : '';
  const liability = detail.refund?.gasLiability;
  const currentGasPolicy = liability?.gasPolicy === 'each_party_bears_own_fee';
  const expectedSellerBalance = Math.round((Number(detail.refund?.retainedAmount || 0) * 0.99 + Number.EPSILON) * 10000000) / 10000000;
  const refundSection = detail.refund ? `<div class="detail-grid"><p><small>Testnet 환불상태</small><strong>${detail.refund.type === 'partial' ? '부분 모의환불 완료' : '전액 모의환불 완료'}</strong></p><p><small>관리자 과실 판정</small><strong>${escapeHtml(faultNames[liability?.faultType] || '정책 판정 필요')}</strong></p><p><small>구매자 환불 예정액</small><strong>${escapeHtml(currentGasPolicy ? (liability?.buyerFinalRefund ?? detail.refund.totalBuyerRefund) : detail.refund.totalBuyerRefund)} Test-Pi</strong></p>${detail.refund.type === 'partial' ? `<p><small>판매자 정산 대기 잔액</small><strong>${escapeHtml(detail.settlement?.pendingAmount ?? expectedSellerBalance)} Test-Pi</strong></p>` : ''}${currentGasPolicy ? `<p><small>구매자 환불 송금 가스비</small><strong>${escapeHtml(detail.refund.refundTransferGasFee ?? 0)} Pi</strong></p><p><small>판매자 정산 송금 가스비</small><strong>${escapeHtml(detail.refund.settlementTransferGasFee ?? 0)} Pi</strong></p>` : ''}</div><p class="form-notice"><strong>${currentGasPolicy ? '현재 가스비 정책' : '이전 시험 정책 기록'}:</strong> ${currentGasPolicy ? '환불·정산 송금 가스비는 각 수령자가 부담하며, 소액 판매대금은 정산 대기 잔액으로 보관합니다.' : '과거의 가스비 보상·미납 계산값은 현재 정책에 사용하지 않습니다. 판매자 부담 0.03 Pi 표시는 폐기되었습니다.'}</p>` : '';
  $('tradeDetailContent').innerHTML = `<p class="eyebrow">${trade.myRole === 'buyer' ? '구매 거래' : '판매 거래'}</p><h3>${escapeHtml(tradeTitle)}</h3><div class="detail-grid"><p><small>거래상태</small><strong>${escapeHtml(statusNames[trade.status] || trade.status)}</strong></p><p><small>거래금액</small><strong>${escapeHtml(trade.amount)} Test-Pi</strong></p><p><small>거래방식</small><strong>${trade.type === 'direct' ? '직거래' : 'Testnet 택배'}</strong></p><p><small>정산보류</small><strong>${trade.settlementHold ? '보류중' : '없음'}</strong></p></div>${settlementSection}${refundSection}${reviewSection}`;
  const actions = [];
  if (trade.type === 'parcel_testnet' && trade.myRole === 'buyer' && trade.status === 'payment_pending') actions.push(['actionPay', 'Test-Pi 결제', 'primary']);
  if (trade.purpose === 'pi_checklist' && trade.myRole === 'buyer' && trade.status === 'shipping_pending') actions.push(['actionChecklistShip', 'Testnet 발송 처리', 'primary']);
  if (trade.purpose === 'pi_checklist' && trade.myRole === 'buyer' && trade.status === 'shipping') actions.push(['actionChecklistDeliver', 'Testnet 배송완료 처리', 'primary']);
  if (trade.purpose === 'pi_checklist' && trade.myRole === 'buyer' && trade.status === 'purchase_confirmed' && !detail.settlement) actions.push(['actionChecklistSettle', 'Testnet 정산 처리', 'primary']);
  if (trade.type === 'parcel_testnet' && trade.myRole === 'seller' && trade.status === 'shipping_pending') actions.push(['actionShip', '운송장 등록', 'primary']);
  if (trade.type === 'parcel_testnet' && trade.myRole === 'buyer' && trade.status === 'delivered') actions.push(['actionConfirm', '구매확정', 'primary']);
  if (trade.type === 'parcel_testnet' && !['completed', 'cancelled', 'refunded', 'mock_refunded', 'disputed'].includes(trade.status)) actions.push(['actionDispute', '분쟁 접수', 'secondary']);
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
  $('actionChecklistShip')?.addEventListener('click', async () => { if (!confirm('체크리스트 시험 거래를 Testnet 발송 처리할까요? 실제 택배는 발송되지 않습니다.')) return; try { await api(`/api/v1/testnet/checklist-trades/${trade.id}/shipment`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionChecklistDeliver')?.addEventListener('click', async () => { if (!confirm('체크리스트 시험 거래를 Testnet 배송완료 처리할까요?')) return; try { await api(`/api/v1/testnet/checklist-trades/${trade.id}/delivery`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionChecklistSettle')?.addEventListener('click', async () => { if (!confirm(detail.settlement ? 'Testnet 모의정산 상태를 다시 확인할까요? 현재 정책에서는 가스비 보상이나 미납금 회수를 처리하지 않습니다.' : 'Testnet 모의정산을 완료하고 거래를 최종 완료할까요? 실제 Pi는 이동하지 않습니다.')) return; try { await api(`/api/v1/testnet/checklist-trades/${trade.id}/settlement`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionShip')?.addEventListener('click', async () => { const carrier = prompt('택배사 이름'); if (!carrier) return; const trackingNumber = prompt('운송장 번호'); if (!trackingNumber) return; try { await api(`/api/v1/trades/${trade.id}/shipment`, { method: 'POST', body: JSON.stringify({ carrier, trackingNumber }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionConfirm')?.addEventListener('click', async () => { if (!confirm('상품을 확인했고 구매를 확정할까요?')) return; try { await api(`/api/v1/trades/${trade.id}/confirm-purchase`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDispute')?.addEventListener('click', async () => { if (!confirm('분쟁·환불 가스비 필수 안내\n\n• 최초 결제 가스비 0.01 Pi는 반환되지 않습니다.\n• 환불 송금 가스비는 구매자 환불액에서 차감됩니다.\n• 부분환불의 정산 송금 가스비는 판매자 정산액에서 차감됩니다.\n• 과실과 관계없이 상대방에게 가스비 보상을 청구하지 않습니다.\n• 가스비 미납금이나 가스비로 인한 거래 제한은 없습니다.\n\n동의해야 분쟁 접수가 가능합니다. 동의합니까?')) return; const reason = prompt('분쟁 사유를 입력하세요'); if (!reason) return; try { await api(`/api/v1/trades/${trade.id}/disputes`, { method: 'POST', body: JSON.stringify({ reason, gasFeeNoticeAccepted: true }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectPlan')?.addEventListener('click', async () => { if (!confirm('직거래 결제는 당사자 간 개인 Pi 지갑 송금만 허용하며, 플랫폼 안전거래 없이 모든 확인과 송금은 당사자 책임입니다. 동의합니까?')) return; const scheduledAt = prompt('약속 일시(예: 2026-08-20 15:00)'); const place = prompt('약속 장소'); if (!scheduledAt || !place) return; try { await api(`/api/v1/trades/${trade.id}/direct`, { method: 'POST', body: JSON.stringify({ noticeAccepted: true, scheduledAt, place, paymentMethod: 'personal_pi_wallet' }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectComplete')?.addEventListener('click', async () => { if (!confirm('직거래 완료를 표시할까요? 상대방도 완료해야 최종 완료됩니다.')) return; try { await api(`/api/v1/trades/${trade.id}/direct/complete`, { method: 'POST' }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionDirectCancel')?.addEventListener('click', async () => { const reason = prompt('취소 사유'); if (reason === null) return; try { await api(`/api/v1/trades/${trade.id}/direct/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }); await refresh(); } catch (error) { alert(error.message); } });
  $('actionReview')?.addEventListener('click', async () => { const positive = confirm('좋은 거래였나요?\n확인: 긍정 / 취소: 보통'); const comment = prompt('후기 내용을 입력하세요'); if (!comment) return; try { await api(`/api/v1/trades/${trade.id}/reviews`, { method: 'POST', body: JSON.stringify({ sentiment: positive ? 'positive' : 'neutral', comment }) }); await Promise.all([refresh(), loadTrust()]); } catch (error) { alert(error.message); } });
  $('actionReport')?.addEventListener('click', async () => { const reason = prompt('신고 사유를 입력하세요'); if (!reason) return; try { await api('/api/v1/reports', { method: 'POST', body: JSON.stringify({ targetType: 'trade', targetId: trade.id, reason }) }); alert('신고가 접수됐습니다. 접수만으로 상대방 신뢰점수는 변경되지 않습니다.'); await loadNotifications(); } catch (error) { alert(error.message); } });
}

const legacyGasNotificationTypes = new Set([
  'gas_compensation_paid',
  'gas_debt_confirmed',
  'gas_debt_paid',
  'gas_debt_appealed',
  'gas_debt_appeal_decided',
  'settlement_debt_offset'
]);

function notificationView(item) {
  if (!legacyGasNotificationTypes.has(item.type)) return item;
  return {
    ...item,
    statusLabel: '과거 Testnet 기능시험 기록',
    title: `[과거 기록] ${item.title}`,
    body: `${item.body} · 현재 가스비 각자 부담 정책에서는 사용하지 않는 시험 기록입니다.`
  };
}

async function loadNotifications() {
  const { items } = await api('/api/v1/notifications');
  $('notifications').innerHTML = items.length ? items.slice(0, 20).map(notificationView).map((item) => `<button class="management-card ${item.readAt ? '' : 'unread'}" data-notification="${escapeHtml(item.id)}"><div><small>${escapeHtml(item.statusLabel || (item.readAt ? '읽음' : '새 알림'))}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div></button>`).join('') : '<p class="empty">새로운 알림이 없습니다.</p>';
  document.querySelectorAll('[data-notification]').forEach((button) => button.addEventListener('click', async () => { try { await api(`/api/v1/notifications/${button.dataset.notification}/read`, { method: 'POST' }); await loadNotifications(); } catch (error) { alert(error.message); } }));
}

async function loadAnnouncements(markRead = false) {
  const { items } = await api('/api/v1/announcements');
  const unreadCount = items.filter((item) => !item.read).length;
  $('notificationBadge').textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  $('notificationBadge').classList.toggle('hidden', unreadCount === 0);
  $('announcements').innerHTML = items.length ? items.map((item) => `<article class="management-card ${item.read ? '' : 'unread'}"><div><small>${item.read ? '확인한 관리팀 알림' : '새 관리팀 알림'}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><p class="meta">${escapeHtml(new Date(item.createdAt).toLocaleString())}</p></div></article>`).join('') : '<p class="empty">현재 게시된 관리팀 알림이 없습니다.</p>';
  if (markRead && unreadCount) {
    await api('/api/v1/announcements/read-all', { method: 'POST', body: '{}' });
    $('notificationBadge').classList.add('hidden');
    $('announcements').querySelectorAll('.unread').forEach((item) => item.classList.remove('unread'));
  }
  return items.length;
}
async function loadMyReports() {
  const { items } = await api('/api/v1/me/reports');
  const names = { received: '접수', reviewing: '검토중', closed: '처리완료' };
  $('myReports').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${escapeHtml(names[item.status] || item.status)} · ${item.targetType === 'product' ? '상품' : '거래'} 신고</small><h3>${escapeHtml(item.reason)}</h3><p>접수번호 ${escapeHtml(item.id)}</p></div></article>`).join('') : '<p class="empty">접수한 신고가 없습니다.</p>';
}
async function loadTrust() { const { profile, nextLevel } = await api('/api/v1/me/trust'); $('trustSummary').innerHTML = `<div><small>신뢰등급</small><strong>${escapeHtml(profile.level)}</strong></div><div><small>신뢰점수</small><strong>${escapeHtml(profile.score)}점</strong></div><div><small>정상거래</small><strong>${escapeHtml(profile.normalTradeCount)}건</strong></div><div><small>다음등급</small><strong>${escapeHtml(nextLevel?.level || '최고등급')}</strong></div>`; }
async function loadGasDebts() {
  const { items } = await api('/api/v1/me/gas-debts');
  const names = { confirmed_unpaid: '미납', appeal_pending: '이의신청 검토 중', paid: '완납' };
  $('gasDebts').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${escapeHtml(names[item.status] || item.status)}</small><h3>${escapeHtml(item.outstandingAmount)} Pi</h3><p>${escapeHtml(item.reason)} · 이의신청 기한 ${escapeHtml(new Date(item.appealDeadline).toLocaleString())}</p></div><div class="card-actions">${item.status === 'confirmed_unpaid' && Date.now() <= new Date(item.appealDeadline).getTime() ? `<button data-debt-appeal="${escapeHtml(item.id)}">이의신청</button>` : ''}${['confirmed_unpaid', 'appeal_pending'].includes(item.status) ? `<button data-debt-pay="${escapeHtml(item.id)}">Testnet 모의납부</button>` : ''}</div></article>`).join('') : '<p class="empty">가스비 미납금이 없습니다.</p>';
  document.querySelectorAll('[data-debt-appeal]').forEach((button) => button.addEventListener('click', async () => { const reason = prompt('이의신청 사유를 입력하세요'); if (!reason?.trim()) return; try { await api(`/api/v1/gas-debts/${button.dataset.debtAppeal}/appeal`, { method: 'POST', body: JSON.stringify({ reason }) }); await Promise.all([loadGasDebts(), loadNotifications()]); } catch (error) { alert(error.message); } }));
  document.querySelectorAll('[data-debt-pay]').forEach((button) => button.addEventListener('click', async () => { if (!confirm('실제 Pi가 이동하지 않는 Testnet 모의납부를 진행할까요?')) return; try { await api(`/api/v1/testnet/gas-debts/${button.dataset.debtPay}/mock-pay`, { method: 'POST' }); await Promise.all([loadGasDebts(), loadNotifications()]); } catch (error) { alert(error.message); } }));
}
async function loadGasCompensations() {
  const { items } = await api('/api/v1/me/gas-compensations');
  $('gasCompensations').innerHTML = items.length ? items.map((item) => `<article class="management-card"><div><small>${item.status === 'appeal_pending' ? '이의신청 검토 중' : item.status === 'confirmed' ? '내용 확인 완료' : '확인 필요'}</small><h3>가스비 보상 ${escapeHtml(item.confirmedAmount)} Pi</h3><p>회수 ${escapeHtml(item.recoveredAmount)} Pi · 미회수 ${escapeHtml(item.unrecoveredAmount)} Pi · 현재 지급 가능 ${escapeHtml(item.currentlyPayableAmount)} Pi</p><p>회수된 보상금은 다른 지급과 합산하여 송금합니다.</p></div>${item.status === 'awaiting_confirmation' ? `<div class="card-actions"><button data-comp-confirm="${escapeHtml(item.id)}">내용 확인 및 지급 진행</button><button data-comp-appeal="${escapeHtml(item.id)}">이의신청</button></div>` : ''}</article>`).join('') : '<p class="empty">가스비 보상 안내가 없습니다.</p>';
  document.querySelectorAll('[data-comp-confirm]').forEach((button) => button.addEventListener('click', async () => { try { await api(`/api/v1/gas-compensations/${button.dataset.compConfirm}/confirm`, { method:'POST', body:'{}' }); await loadGasCompensations(); } catch(error) { alert(error.message); } }));
  document.querySelectorAll('[data-comp-appeal]').forEach((button) => button.addEventListener('click', async () => { const reason=prompt('보상 계산 이의신청 사유'); if(!reason?.trim()) return; try { await api(`/api/v1/gas-compensations/${button.dataset.compAppeal}/appeal`, { method:'POST', body:JSON.stringify({reason}) }); await loadGasCompensations(); } catch(error) { alert(error.message); } }));
}
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
  showPaymentResult('pending', 'Test-Pi 결제를 준비하고 있습니다. Pi Wallet 안내를 따라주세요.');
  const { payment } = await api(`/api/v1/trades/${state.trade.id}/payments`, { method: 'POST' });
  state.payment = payment; log('서버 결제 준비 완료', payment);
  if (!window.Pi || !state.user) { log('Pi 로그인 후 실제 Sandbox 창을 열 수 있습니다. 현재는 서버 모의 준비까지만 완료했습니다.'); return; }
  const callbacks = {
    onReadyForServerApproval: async (piPaymentId) => {
      try {
        await api(`/api/v1/payments/${payment.id}/approve`, { method: 'POST', body: JSON.stringify({ piPaymentId }) });
        log('Pi 서버 승인 단계 완료');
      } catch (error) {
        log(`Pi 서버 승인 실패: ${error.message}`);
        throw error;
      }
    },
    onReadyForServerCompletion: async (piPaymentId, txid) => {
      const result = await api(`/api/v1/payments/${payment.id}/complete`, { method: 'POST', body: JSON.stringify({ piPaymentId, txid }) });
      state.payment = result.payment;
      state.trade = result.trade;
      log('Test-Pi 결제 완료', result.payment);
      showPaymentResult('success', `${payment.buyerTotal} Test-Pi 결제가 완료되었습니다. 거래 상태를 새로고침했습니다.`);
      loadMyTrades().catch((error) => log(`내 거래 새로고침 실패: ${error.message}`));
    },
    onCancel: (id) => { log(`결제 취소: ${id}`); showPaymentResult('cancelled', 'Test-Pi 결제가 취소되었습니다. 자금은 이동하지 않았습니다.'); },
    onError: (error) => { log(`Pi 오류: ${error.message || error}`); showPaymentResult('error', 'Test-Pi 결제를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
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
  try {
    const [status, ready] = await Promise.all([api('/api/v1/health'), api('/api/v1/ready')]);
    $('health').textContent = status.network === 'testnet' && ready.storage === 'postgres' ? 'Testnet·DB 정상' : '설정 확인 필요';
    $('health').title = `배포 ${ready.revision}`;
  } catch (error) {
    $('health').textContent = '서버 점검 필요';
    $('health').title = error.message;
  }
}

async function logout() { await api('/api/v1/auth/logout', { method: 'POST' }); clearDailySession(); state.user = null; state.sessionToken = null; state.activeRoom = null; state.editingProduct = null; $('authState').textContent = '로그인 전'; $('logout').classList.add('hidden'); $('checklistPayment').classList.add('hidden'); $('piLogin').classList.remove('hidden'); $('notificationBadge').classList.add('hidden'); $('mySuggestions').innerHTML = '<p class="empty">Pi Testnet 로그인 후 내 문의 내역을 확인할 수 있습니다.</p>'; ['myPanel', 'chatPanel', 'registerPanel', 'editProductPanel'].forEach((id) => $(id).classList.add('hidden')); }

async function submitSuggestion(event) {
  event.preventDefault();
  if (!state.user) {
    $('suggestionResult').textContent = 'Pi Testnet 로그인 후 건의사항을 보낼 수 있습니다.';
    return;
  }
  try {
    const { suggestion } = await api('/api/v1/suggestions', { method: 'POST', body: JSON.stringify({ category: $('suggestionCategory').value, title: $('suggestionSubject').value.trim(), content: $('suggestionContent').value.trim() }) });
    $('suggestionSubject').value = '';
    $('suggestionContent').value = '';
    $('suggestionResult').textContent = `문의가 접수되었습니다. 접수번호 ${suggestion.id}`;
    await Promise.all([loadNotifications(), loadMySuggestions()]);
  } catch (error) { $('suggestionResult').textContent = error.message; }
}

async function loadMySuggestions() {
  if (!state.user) {
    $('mySuggestions').innerHTML = '<p class="empty">Pi Testnet 로그인 후 내 문의 내역을 확인할 수 있습니다.</p>';
    return 0;
  }
  const { items } = await api('/api/v1/me/suggestions');
  $('mySuggestions').innerHTML = items.length ? items.map((item) => `
    <article class="management-card">
      <div><strong>${escapeHtml(item.title || '기존 건의사항')}</strong><p class="meta">${escapeHtml(suggestionCategoryNames[item.category] || '건의사항')} · ${item.status === 'closed' ? '답변 완료' : '접수'}</p></div>
      <p>${escapeHtml(item.content)}</p>
      ${item.decision ? `<p class="admin-decision"><strong>관리자 답변</strong><br>${escapeHtml(item.decision.reason)}</p>` : '<p class="meta">관리자가 내용을 확인하고 있습니다.</p>'}
      <p class="meta qna-reference" title="${escapeHtml(item.id)}">접수번호 ${escapeHtml(shortReference(item.id))}<br>${escapeHtml(new Date(item.createdAt).toLocaleString())}</p>
    </article>`).join('') : '<p class="empty">접수한 문의가 없습니다.</p>';
  return items.length;
}

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
$('navHome').addEventListener('click', showHome);
$('navSearch').addEventListener('click', showSearch);
$('headerHome').addEventListener('click', showHome);
$('headerSearch').addEventListener('click', showSearch);
$('headerNotifications').addEventListener('click', () => {
  if (!state.user) return alert('Pi Testnet 로그인 후 관리팀 알림을 확인할 수 있습니다.');
  showFeaturePanel('announcementPanel');
  loadAnnouncements(true).catch((error) => alert(error.message));
});
$('stayInApp').addEventListener('click', closeExitConfirm);
$('agreeExit').addEventListener('click', () => { closeExitConfirm(); history.go(-2); });
$('navRegister').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 등록할 수 있습니다.'); showFeaturePanel('registerPanel'); });
$('navChat').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 이용할 수 있습니다.'); showFeaturePanel('chatPanel'); loadChats().catch((error) => alert(error.message)); });
$('navMy').addEventListener('click', () => { if (!state.user) return alert('Pi Testnet 로그인 후 이용할 수 있습니다.'); showFeaturePanel('myPanel'); loadMyMarket().catch((error) => alert(error.message)); });
$('homeRegister').addEventListener('click', () => $('navRegister').click());
$('homeMy').addEventListener('click', () => $('navMy').click());
$('homeQna').addEventListener('click', () => { showFeaturePanel('suggestionPanel'); loadMySuggestions().catch((error) => { $('suggestionResult').textContent = error.message; }); });
$('categoryFilters').addEventListener('click', () => { $('searchForm').classList.toggle('hidden'); if (!$('searchForm').classList.contains('hidden')) $('searchForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('categoryHome').addEventListener('click', showHome);
$('openAdmin').addEventListener('click', () => showFeaturePanel('adminPanel'));
$('closeAdmin').addEventListener('click', () => { stopAdminAlertPolling(); state.adminKey = null; $('adminKey').value = ''; $('adminUsers').innerHTML = ''; $('adminProducts').innerHTML = ''; $('adminPopular').innerHTML = ''; $('adminReports').innerHTML = ''; $('adminDisputes').innerHTML = ''; $('adminSuggestions').innerHTML = ''; $('adminGasDebts').innerHTML = ''; $('adminAudit').innerHTML = ''; $('adminAlerts').innerHTML = ''; $('adminResult').textContent = ''; $('adminWorkspace').classList.add('hidden'); $('adminSearchForm').classList.add('hidden'); $('adminUnlockForm').classList.remove('hidden'); $('adminPanel').classList.add('hidden'); });
$('adminUnlockForm').addEventListener('submit', async (event) => { event.preventDefault(); state.adminKey = $('adminKey').value; try { const [, reportCount] = await Promise.all([loadAdminUsers(), loadAdminReports()]); $('adminUnlockForm').classList.add('hidden'); $('adminWorkspace').classList.remove('hidden'); showAdminSection('users'); $('adminKey').value = ''; await loadAdminDashboard(); startAdminAlertPolling(); $('adminResult').textContent = `관리자 확인 완료 · 접수된 신고 ${reportCount}건`; } catch (error) { stopAdminAlertPolling(); state.adminKey = null; $('adminResult').textContent = error.message; } });
$('adminSearchForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await loadAdminUsers(); } catch (error) { $('adminResult').textContent = error.message; } });
$('clearAdminSearch').addEventListener('click', () => { $('adminUserQuery').value = ''; $('adminUserStatus').value = ''; loadAdminUsers().catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminUsers').addEventListener('click', () => showAdminSection('users'));
$('showAdminProducts').addEventListener('click', () => { showAdminSection('products'); loadAdminProducts().then((count) => { $('adminResult').textContent = `상품 검토 대기 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminPopular').addEventListener('click', () => { showAdminSection('popular'); loadAdminPopularProducts().then((count) => { $('adminResult').textContent = `선정 가능한 판매 중 상품 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminPromotions').addEventListener('click', () => { showAdminSection('promotions'); loadAdminPromotions().then((count) => { $('adminResult').textContent = `광고·협찬 계약 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminAnnouncements').addEventListener('click', () => { showAdminSection('announcements'); loadAdminAnnouncements().then((count) => { $('adminResult').textContent = `게시 중인 운영 공지 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminReports').addEventListener('click', () => { showAdminSection('reports'); loadAdminReports().catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminDisputes').addEventListener('click', () => { showAdminSection('disputes'); loadAdminDisputes().then((count) => { $('adminResult').textContent = `택배 안전거래 분쟁 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminSuggestions').addEventListener('click', () => { showAdminSection('suggestions'); loadAdminSuggestions().then((count) => { $('adminResult').textContent = `접수된 건의사항 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('showAdminGasDebts').addEventListener('click', () => { showAdminSection('gasDebts'); loadAdminGasDebts().then((count) => { $('adminResult').textContent = `미납 이의신청 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('mockPayCompensations').addEventListener('click', async()=>{if(!confirm('소비자가 확인한 보상금을 합산해 Testnet 모의지급할까요? 플랫폼 가스비 0.01 Pi가 별도 기록됩니다.'))return;try{const {batch}=await adminApi('/api/v1/admin/gas-compensation-payouts/mock-batch',{method:'POST',body:'{}'});$('adminResult').textContent=`${batch.itemCount}건 · ${batch.totalAmount} Test-Pi 모의지급 완료`;await loadAdminAudit();}catch(error){$('adminResult').textContent=error.message;}});
$('showAdminAudit').addEventListener('click', () => { showAdminSection('audit'); loadAdminAudit().then((count) => { $('adminResult').textContent = `안전하게 정리된 작업기록 ${count}건`; }).catch((error) => { $('adminResult').textContent = error.message; }); });
$('productForm').addEventListener('submit', registerProduct);
$('productImage').addEventListener('change', () => prepareSelectedImages('productImage', 'registerProductImages', 'registerImages', 'registerResult'));
$('editProductForm').addEventListener('submit', saveProductEdit);
$('editProductImage').addEventListener('change', () => prepareSelectedImages('editProductImage', 'editProductImages', 'editingImages', 'editProductResult'));
$('cancelProductEdit').addEventListener('click', closeProductEdit);
$('messageForm').addEventListener('submit', (event) => sendMessage(event).catch((error) => alert(error.message)));
$('refreshChats').addEventListener('click', () => loadChats().catch((error) => alert(error.message)));
$('suggestionForm').addEventListener('submit', submitSuggestion);
$('refreshSuggestions').addEventListener('click', () => loadMySuggestions().catch((error) => { $('suggestionResult').textContent = error.message; }));
initializeNavigationHistory(); health(); loadProducts(); loadPopularProducts(); loadCategories(); restoreSession();
