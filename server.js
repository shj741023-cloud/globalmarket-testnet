'use strict';

require('node:http');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  NETWORK,
  ASSET,
  paymentQuote,
  assertTestnetEnvironment,
  assertFinancialTradeAllowed
} = require('./lib/policy');
const { Store } = require('./lib/store');
const {
  registerShipment,
  markDelivered,
  openDispute,
  confirmPurchase,
  autoConfirmDue
} = require('./lib/workflow');
const { refundQuote, createMockRefund } = require('./lib/refunds');
const { ensureProfile, applyTrustEvent, nextLevel } = require('./lib/trust');
const { createSession, pruneSessions, enforceSessionLimit, sessionUserId, sessionUserIdFromToken, revokeSession, sessionCookie, clearSessionCookie } = require('./lib/auth');
const { CATEGORIES, validateProductInput, searchProducts, updateOwnedProduct, changeOwnedProductStatus } = require('./lib/products');
const { assertParty, createProposal, respondProposal, createOrUpdateAgreement, confirmAgreement, tradeFromAgreement } = require('./lib/agreements');
const { caseDeadlines, createReport, assignCase, decideCase, auditEntry } = require('./lib/operations');
const { createDirectRecord, updateDirectSchedule, completeDirect, cancelDirect } = require('./lib/direct');
const { preparePayment, approvePayment, completePayment, incompletePayments } = require('./lib/payments');
const { assertTradeParty, assertTradeBuyer, assertTradeSeller } = require('./lib/trade-access');
const { listUserTrades, tradeSnapshot } = require('./lib/trade-view');
const { listUserRooms } = require('./lib/chat-view');
const { checklistTrade, assertChecklistBuyer } = require('./lib/checklist');
const { userReviews, sellerReviews } = require('./lib/review-view');
const { completeMockSettlement } = require('./lib/settlements');
const { publicProduct } = require('./lib/product-view');
const { listFavoriteProductIds, addFavorite, removeFavorite } = require('./lib/favorites');
const { assertReportTarget } = require('./lib/report-target');
const { paginate } = require('./lib/pagination');
const { RateLimiter } = require('./lib/rate-limit');
const { isMutationOriginAllowed, assertActiveUser } = require('./lib/request-security');
const { deploymentRevision } = require('./lib/runtime');
const { createShutdownHandler } = require('./lib/shutdown');
const { createRequestId } = require('./lib/request-id');
const { changeUserStatus } = require('./lib/user-status');
const { adminUserSummaries } = require('./lib/admin-users');
const { adminAuditSummaries } = require('./lib/admin-audit');
const { adminDisputeSummary, adminRefundSummary, adminDisputeSummaries } = require('./lib/admin-disputes');
const { moderationQueue, moderateProduct } = require('./lib/product-moderation');
const { adminDashboardSummary } = require('./lib/admin-dashboard');
const { adminKeyMatches, requestIdentity } = require('./lib/admin-auth');
const { adminReportSummary, adminReportSummaries } = require('./lib/admin-reports');
const { securityHeaders } = require('./lib/security-headers');
const { createCompensation, confirmCompensation, appealCompensation } = require('./lib/gas-compensation');
const { createMockPayoutBatch } = require('./lib/compensation-payouts');
const { offsetDebts } = require('./lib/debt-offset');
const { assertTradingAllowed, createGasDebt, appealGasDebt, mockPayGasDebt, decideGasDebtAppeal } = require('./lib/trading-restrictions');

assertTestnetEnvironment();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const store = new Store(path.join(__dirname, 'data', 'testnet-db.json'));
const rateLimiter = new RateLimiter();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...securityHeaders()
  });
  res.end(JSON.stringify(data));
}

function apiError(res, status, code, message, details) {
  sendJson(res, status, { ok: false, error: { code, message, details, requestId: res.getHeader('X-Request-Id') } });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw Object.assign(new Error('Request too large'), { code: 'REQUEST_TOO_LARGE' });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function currentUserId(req) {
  const cookieUserId = sessionUserId(store.state, req.headers.cookie || '');
  if (cookieUserId) return cookieUserId;
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return sessionUserIdFromToken(store.state, token);
}

function allowApiRequest(req, res, pathname) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const identity = currentUserId(req) || forwarded || req.socket.remoteAddress || 'unknown';
  let bucket = 'write'; let limit = 120; let windowMs = 60_000;
  if (pathname === '/api/v1/auth/pi') { bucket = 'auth'; limit = 10; windowMs = 5 * 60_000; }
  else if (/\/messages$/.test(pathname)) { bucket = 'message'; limit = 30; }
  const result = rateLimiter.consume(`${bucket}:${identity}`, limit, windowMs);
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (result.allowed) return true;
  res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
  apiError(res, 429, 'RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
  return false;
}

function requireUserId(req, res) {
  const userId = currentUserId(req);
  if (!userId) {
    apiError(res, 401, 'AUTH_REQUIRED', 'Pi Testnet login is required');
    return null;
  }
  const user = store.state.users.find((item) => item.id === userId);
  if (!user || user.status !== 'active') {
    apiError(res, 403, 'USER_NOT_ACTIVE', '사용할 수 없는 계정입니다.');
    return null;
  }
  return userId;
}

function requireTradingAllowed(userId, res) {
  try { assertTradingAllowed(store.state.gasDebts, userId); return true; }
  catch (error) { apiError(res, 403, error.code || 'TRADING_BLOCKED', error.message); return false; }
}

function requireTestAdmin(req, res) {
  const expected = process.env.TEST_ADMIN_KEY;
  if (!expected) {
    apiError(res, 503, 'TEST_ADMIN_DISABLED', 'Set TEST_ADMIN_KEY to enable Testnet admin decisions');
    return false;
  }
  if (!adminKeyMatches(req.headers['x-test-admin-key'], expected)) {
    const failed = rateLimiter.consume(`admin-auth-failure:${requestIdentity(req)}`, 10, 15 * 60_000);
    res.setHeader('X-RateLimit-Remaining', String(failed.remaining));
    if (!failed.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(failed.retryAfterMs / 1000)));
      apiError(res, 429, 'ADMIN_AUTH_RATE_LIMITED', '관리자 확인 실패가 너무 많습니다. 잠시 후 다시 시도하세요.');
      return false;
    }
    apiError(res, 403, 'ADMIN_REQUIRED', 'Valid Testnet admin key is required');
    return false;
  }
  return true;
}

function testAdminId(req) {
  return String(req.headers['x-test-admin-id'] || 'test-admin');
}

function notify(userId, type, title, body, relatedId = null) {
  const item = { id: store.id('notification'), userId, type, title, body, relatedId, readAt: null, createdAt: new Date().toISOString() };
  store.state.notifications.push(item);
  return item;
}

function recordAudit(req, action, targetType, targetId, reason, before, after) {
  const entry = auditEntry({ id: store.id('audit'), adminId: testAdminId(req), action, targetType, targetId, reason, before, after });
  store.state.auditLogs.push(entry);
  return entry;
}

function findOr404(res, item, type) {
  if (item) return true;
  apiError(res, 404, `${type.toUpperCase()}_NOT_FOUND`, `${type} not found`);
  return false;
}

async function callPi(pathname, body) {
  const key = String(process.env.PI_API_KEY || '').trim();
  if (!key) throw Object.assign(new Error('Pi Server API key is not configured'), {
    code: 'PI_API_KEY_MISSING', status: 503
  });
  const base = String(process.env.PI_API_BASE_URL || 'https://api.minepi.com').trim().replace(/\/+$/, '');
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { authorization: `Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Pi Testnet API rejected the request'), {
    code: 'PI_API_ERROR', status: response.status, details: payload
  });
  return payload;
}

async function verifyPiAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw Object.assign(new Error('Pi accessToken is required'), { code: 'PI_ACCESS_TOKEN_REQUIRED', status: 400 });
  }
  const base = process.env.PI_API_BASE_URL || 'https://api.minepi.com';
  const response = await fetch(`${base}/v2/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.uid) {
    throw Object.assign(new Error('Pi access token verification failed'), { code: 'PI_AUTH_FAILED', status: 401 });
  }
  return { uid: String(payload.uid), username: String(payload.username || '') };
}

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  let match;
  if (method === 'POST' && /^\/api\/v1\/payments\/[^/]+\/approve$/.test(pathname)) {
    const hasBearerSession = String(req.headers.authorization || '').startsWith('Bearer ');
    const originHost = (() => { try { return new URL(String(req.headers.origin || '')).host; } catch { return 'none'; } })();
    console.log('PI_PAYMENT_APPROVAL_CALLBACK_RECEIVED', `bearer=${hasBearerSession}`, `origin=${originHost}`);
  }
  if (!isMutationOriginAllowed({ method, origin: req.headers.origin, authorization: req.headers.authorization, extraOrigins: process.env.ALLOWED_ORIGINS })) {
    return apiError(res, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 사이트에서 보낸 요청입니다.');
  }
  if (!allowApiRequest(req, res, pathname)) return;

  if (method === 'GET' && pathname === '/api/v1/health') {
    return sendJson(res, 200, { ok: true, network: NETWORK, asset: ASSET, isSimulation: true, storage: store.backend, revision: deploymentRevision() });
  }
  if (method === 'GET' && pathname === '/api/v1/ready') {
    try {
      const readiness = await store.readiness();
      return sendJson(res, 200, { ok: true, storage: readiness.backend, revision: deploymentRevision() });
    } catch {
      return sendJson(res, 503, { ok: false, storage: store.backend, revision: deploymentRevision() });
    }
  }
  if (method === 'GET' && pathname === '/api/v1/config') {
    return sendJson(res, 200, {
      ok: true,
      network: NETWORK,
      asset: ASSET,
      sandbox: true,
      piServerConnected: Boolean(process.env.PI_API_KEY),
      warning: 'Test-Pi only. No real payment or seller payout.'
    });
  }
  if (method === 'POST' && pathname === '/api/v1/auth/pi') {
    const body = await readJson(req);
    const piUser = await verifyPiAccessToken(body.accessToken);
    let user = store.state.users.find((item) => item.piUid === piUser.uid);
    if (!user) {
      user = { id: store.id('user'), piUid: piUser.uid, username: piUser.username, status: 'active', createdAt: new Date().toISOString() };
      store.state.users.push(user);
    } else {
      user.username = piUser.username || user.username;
    }
    assertActiveUser(user);
    pruneSessions(store.state);
    const { token, session } = createSession(store.state, user.id);
    enforceSessionLimit(store.state, user.id);
    store.event('USER_AUTHENTICATED', user.id, { sessionId: session.id }); await store.save();
    res.setHeader('Set-Cookie', sessionCookie(token, req.headers['x-forwarded-proto'] === 'https'));
    return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username }, sessionToken: token, network: NETWORK });
  }
  if (method === 'POST' && pathname === '/api/v1/auth/demo') {
    if (String(process.env.ALLOW_DEMO_AUTH || 'false').toLowerCase() !== 'true') return apiError(res, 403, 'DEMO_AUTH_DISABLED', 'Demo auth is disabled');
    let user = store.state.users.find((item) => item.piUid === 'demo-testnet-user');
    if (!user) { user = { id: store.id('user'), piUid: 'demo-testnet-user', username: 'Testnet Demo', status: 'active', createdAt: new Date().toISOString() }; store.state.users.push(user); }
    assertActiveUser(user);
    pruneSessions(store.state);
    const { token } = createSession(store.state, user.id); enforceSessionLimit(store.state, user.id); await store.save();
    res.setHeader('Set-Cookie', sessionCookie(token, false));
    return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username }, demo: true });
  }
  if (method === 'GET' && pathname === '/api/v1/me') {
    const userId = requireUserId(req, res); if (!userId) return;
    const user = store.state.users.find((item) => item.id === userId);
    return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username, status: user.status } });
  }
  if (method === 'POST' && pathname === '/api/v1/auth/logout') {
    revokeSession(store.state, req.headers.cookie || ''); await store.save();
    res.setHeader('Set-Cookie', clearSessionCookie(req.headers['x-forwarded-proto'] === 'https'));
    return sendJson(res, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/api/v1/products') {
    const query = Object.fromEntries(url.searchParams.entries());
    const userId = currentUserId(req);
    const favoriteIds = new Set(userId ? listFavoriteProductIds(store.state.favorites, userId) : []);
    const allItems = searchProducts(store.state.products, query).map((product) => ({ ...publicProduct(store.state, product), isFavorite: favoriteIds.has(product.id) }));
    const page = paginate(allItems, query);
    return sendJson(res, 200, { ok: true, items: page.items, pagination: { total: page.total, limit: page.limit, offset: page.offset, hasMore: page.hasMore }, filters: query });
  }
  if (method === 'GET' && pathname === '/api/v1/categories') {
    return sendJson(res, 200, { ok: true, items: CATEGORIES });
  }
  match = pathname.match(/^\/api\/v1\/products\/([^/]+)\/reviews$/);
  if (method === 'GET' && match) {
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    return sendJson(res, 200, { ok: true, items: sellerReviews(store.state, product.sellerId) });
  }
  if (method === 'GET' && pathname === '/api/v1/me/products') {
    const sellerId = requireUserId(req, res); if (!sellerId) return;
    return sendJson(res, 200, { ok: true, items: store.state.products.filter((item) => item.sellerId === sellerId).slice().reverse() });
  }
  if (method === 'GET' && pathname === '/api/v1/me/favorites') {
    const userId = requireUserId(req, res); if (!userId) return;
    const favoriteIds = listFavoriteProductIds(store.state.favorites, userId);
    const items = favoriteIds.map((id) => store.findProduct(id)).filter((product) => product && ['available', 'reserved'].includes(product.status)).map((product) => ({ ...publicProduct(store.state, product), isFavorite: true }));
    return sendJson(res, 200, { ok: true, items });
  }
  match = pathname.match(/^\/api\/v1\/products\/([^/]+)\/favorite$/);
  if (match && method === 'POST') {
    const userId = requireUserId(req, res); if (!userId) return;
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    const result = addFavorite(store.state.favorites, { id: store.id('favorite'), userId, productId: product.id });
    if (!result.idempotent) await store.save();
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, favorite: result.favorite, idempotent: result.idempotent });
  }
  if (match && method === 'DELETE') {
    const userId = requireUserId(req, res); if (!userId) return;
    const result = removeFavorite(store.state.favorites, userId, match[1]);
    if (!result.idempotent) await store.save();
    return sendJson(res, 200, { ok: true, ...result });
  }
  if (method === 'GET' && pathname === '/api/v1/me/trades') {
    const userId = requireUserId(req, res); if (!userId) return;
    const query = Object.fromEntries(url.searchParams.entries());
    const items = listUserTrades(store.state.trades, userId, query).map((trade) => ({
      ...trade,
      product: store.findProduct(trade.productId) || null
    }));
    return sendJson(res, 200, { ok: true, items, filters: query });
  }
  if (method === 'GET' && pathname === '/api/v1/me/reviews') {
    const userId = requireUserId(req, res); if (!userId) return;
    return sendJson(res, 200, { ok: true, items: userReviews(store.state, userId) });
  }
  if (method === 'GET' && pathname === '/api/v1/me/chat-rooms') {
    const userId = requireUserId(req, res); if (!userId) return;
    const items = listUserRooms(store.state.chatRooms, userId).map((room) => ({
      ...room,
      product: store.findProduct(room.productId) || null,
      lastMessage: store.state.messages.filter((item) => item.roomId === room.id).at(-1) || null,
      agreement: store.state.agreements.find((item) => item.roomId === room.id) || null
    }));
    return sendJson(res, 200, { ok: true, items });
  }
  if (method === 'POST' && pathname === '/api/v1/testnet/checklist-trades') {
    const buyerId = requireUserId(req, res); if (!buyerId) return;
    if (!requireTradingAllowed(buyerId, res)) return;
    const result = checklistTrade(store.state.trades, buyerId, { id: store.id('trade') });
    if (!result.idempotent) { store.state.trades.push(result.trade); store.event('PI_CHECKLIST_TRADE_CREATED', result.trade.id); await store.save(); }
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, trade: result.trade, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/checklist-trades\/([^/]+)\/shipment$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertChecklistBuyer(trade, userId);
    const shipment = registerShipment(trade, {
      id: store.id('shipment'), carrier: 'TESTNET', trackingNumber: `CHECKLIST-${trade.id.slice(-8)}`
    });
    store.state.shipments.push(shipment);
    store.event('PI_CHECKLIST_SHIPMENT_CREATED', trade.id); await store.save();
    return sendJson(res, 201, { ok: true, trade, shipment });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/checklist-trades\/([^/]+)\/delivery$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertChecklistBuyer(trade, userId);
    const shipment = store.findShipmentByTrade(trade.id); if (!findOr404(res, shipment, 'shipment')) return;
    markDelivered(trade, shipment);
    store.event('PI_CHECKLIST_DELIVERY_COMPLETED', trade.id); await store.save();
    return sendJson(res, 200, { ok: true, trade, shipment });
  }
  if (method === 'GET' && pathname === '/api/v1/me/trust') {
    const userId = requireUserId(req, res); if (!userId) return;
    const profile = ensureProfile(store.state, userId);
    return sendJson(res, 200, {
      ok: true,
      profile,
      recentEvents: store.state.trustEvents.filter((item) => item.userId === profile.userId).slice(-20).reverse(),
      nextLevel: nextLevel(profile)
    });
  }
  if (method === 'GET' && pathname === '/api/v1/notifications') {
    const userId = requireUserId(req, res); if (!userId) return;
    return sendJson(res, 200, { ok: true, items: store.state.notifications.filter((item) => item.userId === userId).slice(-100).reverse() });
  }
  if (method === 'GET' && pathname === '/api/v1/me/gas-debts') {
    const userId = requireUserId(req, res); if (!userId) return;
    return sendJson(res, 200, { ok: true, items: store.state.gasDebts.filter((item) => item.userId === userId).slice().reverse() });
  }
  if (method === 'GET' && pathname === '/api/v1/me/gas-compensations') {
    const userId = requireUserId(req, res); if (!userId) return;
    return sendJson(res, 200, { ok: true, items: store.state.gasCompensations.filter((item) => item.buyerId === userId).slice().reverse() });
  }
  match = pathname.match(/^\/api\/v1\/gas-compensations\/([^/]+)\/(confirm|appeal)$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const item = store.state.gasCompensations.find((candidate) => candidate.id === match[1]); if (!findOr404(res, item, 'gas compensation')) return;
    const body = await readJson(req); if (match[2] === 'confirm') confirmCompensation(item, userId); else appealCompensation(item, userId, body.reason);
    await store.save(); return sendJson(res, 200, { ok: true, compensation: item });
  }
  match = pathname.match(/^\/api\/v1\/gas-debts\/([^/]+)\/appeal$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const debt = store.state.gasDebts.find((item) => item.id === match[1]); if (!findOr404(res, debt, 'gas debt')) return;
    const body = await readJson(req); appealGasDebt(debt, userId, body.reason);
    notify(userId, 'gas_debt_appealed', '가스비 미납 이의신청이 접수되었습니다', debt.appealReason, debt.id);
    await store.save(); return sendJson(res, 200, { ok: true, debt });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/gas-debts\/([^/]+)\/mock-pay$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const debt = store.state.gasDebts.find((item) => item.id === match[1]); if (!findOr404(res, debt, 'gas debt')) return;
    const result = mockPayGasDebt(debt, userId);
    if (!result.idempotent) {
      const refund = store.state.refunds.find((item) => item.id === debt.refundId); const trade = refund && store.findTrade(refund.tradeId);
      const claim = Number(refund?.gasLiability?.buyerGasCompensationClaim || 0);
      if (trade && claim > 0 && !store.state.gasCompensations.some((item) => item.debtId === debt.id)) store.state.gasCompensations.push(createCompensation({ id: store.id('gas_compensation'), buyerId: trade.buyerId, refundId: refund.id, debtId: debt.id, confirmedAmount: claim, recoveredAmount: debt.paidAmount }));
    }
    if (!result.idempotent) notify(userId, 'gas_debt_paid', 'Testnet 가스비 모의납부가 완료되었습니다', `${debt.paidAmount} Test-Pi`, debt.id);
    await store.save(); return sendJson(res, 200, { ok: true, debt, idempotent: result.idempotent });
  }
  if (method === 'GET' && pathname === '/api/v1/me/reports') {
    const userId = requireUserId(req, res); if (!userId) return;
    return sendJson(res, 200, { ok: true, items: store.state.reports.filter((item) => item.reporterId === userId).slice(-100).reverse() });
  }
  if (method === 'POST' && pathname === '/api/v1/reports') {
    const reporterId = requireUserId(req, res); if (!reporterId) return;
    const body = await readJson(req);
    assertReportTarget(store.state, reporterId, body.targetType, body.targetId);
    const report = createReport({ id: store.id('report'), reporterId, targetType: body.targetType, targetId: body.targetId, reason: body.reason, complexity: body.complexity });
    store.state.reports.push(report);
    notify(reporterId, 'report_received', '신고가 접수되었습니다', `접수번호 ${report.id}`, report.id);
    store.event('REPORT_RECEIVED', report.id); await store.save();
    return sendJson(res, 201, { ok: true, report });
  }
  if (method === 'POST' && pathname === '/api/v1/products') {
    const sellerId = requireUserId(req, res); if (!sellerId) return;
    if (!requireTradingAllowed(sellerId, res)) return;
    const body = await readJson(req);
    const checked = validateProductInput(body);
    const product = {
      id: store.id('product'), sellerId, ...checked.value,
      status: checked.reviewRequired ? 'under_review' : 'available',
      reviewReasons: checked.reviewReasons,
      createdAt: new Date().toISOString()
    };
    store.state.products.push(product);
    store.event(checked.reviewRequired ? 'PRODUCT_REVIEW_REQUESTED' : 'PRODUCT_CREATED', product.id, { reasons: checked.reviewReasons });
    await store.save();
    return sendJson(res, 201, { ok: true, product });
  }
  match = pathname.match(/^\/api\/v1\/products\/([^/]+)$/);
  if (method === 'PATCH' && match) {
    const sellerId = requireUserId(req, res); if (!sellerId) return;
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    const before = { ...product }; const body = await readJson(req);
    updateOwnedProduct(product, sellerId, body);
    store.event('PRODUCT_UPDATED', product.id, { beforeStatus: before.status, afterStatus: product.status });
    await store.save(); return sendJson(res, 200, { ok: true, product });
  }
  match = pathname.match(/^\/api\/v1\/products\/([^/]+)\/status$/);
  if (method === 'PATCH' && match) {
    const sellerId = requireUserId(req, res); if (!sellerId) return;
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    const body = await readJson(req);
    if (body.status === 'available' && !requireTradingAllowed(sellerId, res)) return;
    const hasActiveTrade = store.state.trades.some((item) => item.productId === product.id && !['completed', 'cancelled', 'refunded'].includes(item.status));
    const result = changeOwnedProductStatus(product, sellerId, body.status, hasActiveTrade);
    if (!result.idempotent) { store.event('PRODUCT_STATUS_CHANGED', product.id, { status: product.status }); await store.save(); }
    return sendJson(res, 200, { ok: true, product, idempotent: result.idempotent });
  }
  if (method === 'POST' && pathname === '/api/v1/trades') {
    if (String(process.env.ALLOW_QUICK_TRADE || 'false').toLowerCase() !== 'true') {
      return apiError(res, 410, 'AGREEMENT_FLOW_REQUIRED', 'Use chat and bilateral agreement before creating a trade');
    }
    const buyerId = requireUserId(req, res); if (!buyerId) return;
    if (!requireTradingAllowed(buyerId, res)) return;
    const body = await readJson(req);
    const product = store.findProduct(body.productId);
    if (!findOr404(res, product, 'product')) return;
    if (product.status !== 'available') return apiError(res, 409, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
    if (buyerId === product.sellerId) return apiError(res, 409, 'SELF_TRADE_BLOCKED', 'Seller cannot buy own product');
    if (!['direct', 'parcel_testnet'].includes(body.type) || !product.methods.includes(body.type)) return apiError(res, 400, 'INVALID_TRADE_TYPE', 'Use a trade type supported by this product');
    const trade = {
      id: store.id('trade'), productId: product.id, sellerId: product.sellerId,
      buyerId, type: body.type, amount: product.price,
      status: body.type === 'direct' ? 'meeting_agreed' : 'payment_pending',
      settlementHold: false, createdAt: new Date().toISOString()
    };
    store.state.trades.push(trade); store.event('TRADE_CREATED', trade.id, { type: trade.type }); await store.save();
    return sendJson(res, 201, { ok: true, trade });
  }

  match = pathname.match(/^\/api\/v1\/products\/([^/]+)\/chat-rooms$/);
  if (method === 'POST' && match) {
    const buyerId = requireUserId(req, res); if (!buyerId) return;
    if (!requireTradingAllowed(buyerId, res)) return;
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    if (!requireTradingAllowed(product.sellerId, res)) return;
    if (product.status !== 'available') return apiError(res, 409, 'PRODUCT_NOT_AVAILABLE', 'Product is not available');
    if (buyerId === product.sellerId) return apiError(res, 409, 'SELF_CHAT_BLOCKED', 'Seller cannot open a buyer chat for own product');
    let room = store.state.chatRooms.find((item) => item.productId === product.id && item.buyerId === buyerId && item.status === 'active');
    if (room) return sendJson(res, 200, { ok: true, room, idempotent: true });
    room = { id: store.id('room'), productId: product.id, sellerId: product.sellerId, buyerId, status: 'active', createdAt: new Date().toISOString() };
    store.state.chatRooms.push(room); store.event('CHAT_ROOM_CREATED', room.id); await store.save();
    return sendJson(res, 201, { ok: true, room });
  }
  match = pathname.match(/^\/api\/v1\/chat-rooms\/([^/]+)$/);
  if (method === 'GET' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const room = store.state.chatRooms.find((item) => item.id === match[1]); if (!findOr404(res, room, 'chat room')) return;
    assertParty(room, userId);
    return sendJson(res, 200, {
      ok: true, room,
      messages: store.state.messages.filter((item) => item.roomId === room.id).slice(-100),
      proposals: store.state.priceProposals.filter((item) => item.roomId === room.id),
      agreement: store.state.agreements.find((item) => item.roomId === room.id) || null
    });
  }
  match = pathname.match(/^\/api\/v1\/chat-rooms\/([^/]+)\/messages$/);
  if (method === 'POST' && match) {
    const senderId = requireUserId(req, res); if (!senderId) return;
    const room = store.state.chatRooms.find((item) => item.id === match[1]); if (!findOr404(res, room, 'chat room')) return;
    assertParty(room, senderId); const body = await readJson(req); const content = String(body.content || '').trim();
    if (!content || content.length > 1000) return apiError(res, 400, 'INVALID_MESSAGE', 'Message must be 1-1000 characters');
    const message = { id: store.id('message'), roomId: room.id, senderId, content, createdAt: new Date().toISOString() };
    store.state.messages.push(message); await store.save(); return sendJson(res, 201, { ok: true, message });
  }
  match = pathname.match(/^\/api\/v1\/chat-rooms\/([^/]+)\/price-proposals$/);
  if (method === 'POST' && match) {
    const proposerId = requireUserId(req, res); if (!proposerId) return;
    if (!requireTradingAllowed(proposerId, res)) return;
    const room = store.state.chatRooms.find((item) => item.id === match[1]); if (!findOr404(res, room, 'chat room')) return;
    const body = await readJson(req); const proposal = createProposal(room, { id: store.id('proposal'), proposerId, price: body.price });
    store.state.priceProposals.push(proposal); await store.save(); return sendJson(res, 201, { ok: true, proposal });
  }
  match = pathname.match(/^\/api\/v1\/price-proposals\/([^/]+)\/(accept|reject)$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    if (!requireTradingAllowed(userId, res)) return;
    const proposal = store.state.priceProposals.find((item) => item.id === match[1]); if (!findOr404(res, proposal, 'proposal')) return;
    const result = respondProposal(proposal, userId, match[2] === 'accept' ? 'accepted' : 'rejected'); await store.save();
    return sendJson(res, 200, { ok: true, proposal, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/chat-rooms\/([^/]+)\/agreements$/);
  if (method === 'POST' && match) {
    const actorId = requireUserId(req, res); if (!actorId) return;
    if (!requireTradingAllowed(actorId, res)) return;
    const room = store.state.chatRooms.find((item) => item.id === match[1]); if (!findOr404(res, room, 'chat room')) return;
    const product = store.findProduct(room.productId); if (!findOr404(res, product, 'product')) return;
    const body = await readJson(req); let agreement = store.state.agreements.find((item) => item.roomId === room.id);
    const isNew = !agreement;
    agreement = createOrUpdateAgreement(agreement, room, product, { id: store.id('agreement'), actorId, price: body.price, type: body.type });
    if (isNew) store.state.agreements.push(agreement); store.event('AGREEMENT_UPDATED', agreement.id, { version: agreement.version }); await store.save();
    return sendJson(res, isNew ? 201 : 200, { ok: true, agreement });
  }
  match = pathname.match(/^\/api\/v1\/agreements\/([^/]+)\/confirm$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    if (!requireTradingAllowed(userId, res)) return;
    const agreement = store.state.agreements.find((item) => item.id === match[1]); if (!findOr404(res, agreement, 'agreement')) return;
    const result = confirmAgreement(agreement, userId); await store.save();
    return sendJson(res, 200, { ok: true, agreement, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/agreements\/([^/]+)\/trades$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const agreement = store.state.agreements.find((item) => item.id === match[1]); if (!findOr404(res, agreement, 'agreement')) return;
    if (![agreement.sellerId, agreement.buyerId].includes(userId)) return apiError(res, 403, 'AGREEMENT_PARTY_REQUIRED', 'Agreement party required');
    if (!requireTradingAllowed(agreement.sellerId, res) || !requireTradingAllowed(agreement.buyerId, res)) return;
    const existing = store.state.trades.find((item) => item.agreementId === agreement.id);
    const result = tradeFromAgreement(agreement, existing, { id: store.id('trade') });
    if (!result.idempotent) { store.state.trades.push(result.trade); store.event('TRADE_CREATED', result.trade.id, { agreementId: agreement.id }); await store.save(); }
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, trade: result.trade, idempotent: result.idempotent });
  }

  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)$/);
  if (method === 'GET' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    return sendJson(res, 200, { ok: true, ...tradeSnapshot(store.state, trade, userId) });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/direct$/);
  if (method === 'GET' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    if (![trade.sellerId, trade.buyerId].includes(userId)) return apiError(res, 403, 'DIRECT_TRADE_PARTY_REQUIRED', 'Direct trade party required');
    const record = store.state.directTradeRecords.find((item) => item.tradeId === trade.id) || null;
    return sendJson(res, 200, { ok: true, trade, record, notice: '직거래는 개인 Pi 지갑 송금만 허용하며 플랫폼은 결제·보관·정산·환불을 제공하지 않습니다.' });
  }
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const existing = store.state.directTradeRecords.find((item) => item.tradeId === trade.id);
    if (existing) return sendJson(res, 200, { ok: true, record: existing, idempotent: true });
    const body = await readJson(req); const record = createDirectRecord(trade, { ...body, userId });
    store.state.directTradeRecords.push(record); store.event('DIRECT_SCHEDULE_CREATED', trade.id); await store.save();
    return sendJson(res, 201, { ok: true, record });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/direct\/schedule$/);
  if (method === 'PATCH' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const record = store.state.directTradeRecords.find((item) => item.tradeId === trade.id); if (!findOr404(res, record, 'direct record')) return;
    const body = await readJson(req); updateDirectSchedule(trade, record, { ...body, userId });
    store.event('DIRECT_SCHEDULE_UPDATED', trade.id); await store.save(); return sendJson(res, 200, { ok: true, record });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/direct\/complete$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const record = store.state.directTradeRecords.find((item) => item.tradeId === trade.id); if (!findOr404(res, record, 'direct record')) return;
    const wasCompleted = trade.status === 'completed'; const result = completeDirect(trade, record, userId);
    if (!wasCompleted && trade.status === 'completed') {
      for (const partyId of [trade.sellerId, trade.buyerId]) applyTrustEvent(store.state, {
        id: store.id('trust'), uniqueKey: `transaction_completed:${trade.id}:${partyId}`,
        userId: partyId, tradeId: trade.id, type: 'transaction_completed', reason: '직거래 양쪽 완료'
      });
    }
    store.event('DIRECT_COMPLETION_MARKED', trade.id, { userId }); await store.save();
    return sendJson(res, 200, { ok: true, trade, record, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/direct\/cancel$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const record = store.state.directTradeRecords.find((item) => item.tradeId === trade.id); if (!findOr404(res, record, 'direct record')) return;
    const body = await readJson(req); const result = cancelDirect(trade, record, userId, body.reason);
    store.event('DIRECT_CANCELED', trade.id, { userId }); await store.save();
    return sendJson(res, 200, { ok: true, trade, record, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/payment-quote$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertTradeParty(trade, userId);
    assertFinancialTradeAllowed(trade);
    return sendJson(res, 200, { ok: true, quote: paymentQuote(trade.amount, 0) });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/payments$/);
  if (method === 'POST' && match) {
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const userId = requireUserId(req, res); if (!userId) return;
    if (!requireTradingAllowed(userId, res)) return;
    if (userId !== trade.buyerId) return apiError(res, 403, 'BUYER_REQUIRED', 'Only the buyer can prepare payment');
    const result = preparePayment(trade, store.state.payments, { id: store.id('payment'), networkFee: 0 });
    if (!result.idempotent) { store.state.payments.push(result.payment); store.event('PAYMENT_PREPARED', result.payment.id); await store.save(); }
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, payment: result.payment, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/payments\/([^/]+)\/approve$/);
  if (method === 'POST' && match) {
    const payment = store.findPayment(match[1]); if (!findOr404(res, payment, 'payment')) return;
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(payment.tradeId); if (!findOr404(res, trade, 'trade')) return;
    assertTradeBuyer(trade, userId);
    const body = await readJson(req);
    if (!body.piPaymentId) return apiError(res, 400, 'PI_PAYMENT_ID_REQUIRED', 'piPaymentId is required');
    const beforeApproval = { providerPaymentId: payment.providerPaymentId, status: payment.status, approvedAt: payment.approvedAt };
    const stateResult = approvePayment(payment, store.state.payments, body.piPaymentId);
    if (stateResult.idempotent && !stateResult.providerRetryRequired) {
      return sendJson(res, 200, { ok: true, payment, idempotent: true });
    }
    let piResult;
    try {
      console.log('PI_PAYMENT_APPROVAL_REQUESTED', payment.id);
      piResult = await callPi(`/v2/payments/${encodeURIComponent(body.piPaymentId)}/approve`);
    } catch (error) {
      console.error('PI_PAYMENT_APPROVAL_FAILED', payment.id, error.status || 500, error.code || 'PI_API_ERROR');
      Object.assign(payment, beforeApproval);
      throw error;
    }
    console.log('PI_PAYMENT_APPROVAL_SUCCEEDED', payment.id);
    if (!stateResult.idempotent) {
      store.event('PAYMENT_APPROVED', payment.id, { replacedExpiredProviderPayment: Boolean(stateResult.replacedProviderPaymentId) });
      await store.save();
    }
    return sendJson(res, 200, { ok: true, payment, provider: piResult, idempotent: stateResult.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/payments\/([^/]+)\/complete$/);
  if (method === 'POST' && match) {
    const payment = store.findPayment(match[1]); if (!findOr404(res, payment, 'payment')) return;
    const userId = requireUserId(req, res); if (!userId) return;
    const paymentTrade = store.findTrade(payment.tradeId); if (!findOr404(res, paymentTrade, 'trade')) return;
    assertTradeBuyer(paymentTrade, userId);
    const body = await readJson(req);
    if (payment.status === 'completed' && payment.txid === body.txid) return sendJson(res, 200, { ok: true, payment, idempotent: true });
    if (!payment.providerPaymentId || !body.txid) return apiError(res, 400, 'PAYMENT_COMPLETION_DATA_REQUIRED', 'approved payment and txid are required');
    if (payment.status !== 'approved') return apiError(res, 409, 'PAYMENT_NOT_APPROVED', 'Server approval is required before completion');
    const duplicateTxid = store.state.payments.find((item) => item.id !== payment.id && item.txid === body.txid);
    if (duplicateTxid) return apiError(res, 409, 'DUPLICATE_TXID', 'Transaction ID is already linked');
    const piResult = await callPi(`/v2/payments/${encodeURIComponent(payment.providerPaymentId)}/complete`, { txid: body.txid });
    const trade = paymentTrade;
    completePayment(payment, store.state.payments, trade, body.txid);
    store.event('PAYMENT_COMPLETED', payment.id, { simulatedProvider: Boolean(piResult.simulated) }); await store.save();
    return sendJson(res, 200, { ok: true, payment, trade, provider: piResult });
  }
  if (method === 'GET' && pathname === '/api/v1/payments/incomplete') {
    const userId = requireUserId(req, res); if (!userId) return;
    const tradeIds = store.state.trades.filter((item) => item.buyerId === userId).map((item) => item.id);
    return sendJson(res, 200, { ok: true, items: incompletePayments(store.state.payments, tradeIds) });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/mock-settlement$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const result = completeMockSettlement(trade, store.state.settlements, { id: store.id('settlement') });
    if (!result.idempotent) {
      const offset=offsetDebts(store.state.gasDebts,trade.sellerId,result.settlement.netAmount); result.settlement.debtOffsetAmount=offset.offsetAmount; result.settlement.netAmount=offset.sellerNetAmount; result.settlement.debtAllocations=offset.allocations;
      for(const allocation of offset.allocations){const refund=store.state.refunds.find(i=>i.id===allocation.refundId);const sourceTrade=refund&&store.findTrade(refund.tradeId);const claim=Number(refund?.gasLiability?.buyerGasCompensationClaim||0);if(sourceTrade&&claim>0){let item=store.state.gasCompensations.find(i=>i.refundId===refund.id);if(!item){item=createCompensation({id:store.id('gas_compensation'),buyerId:sourceTrade.buyerId,refundId:refund.id,debtId:allocation.debtId,confirmedAmount:claim,recoveredAmount:allocation.amount});store.state.gasCompensations.push(item);}else{item.recoveredAmount=Math.min(item.confirmedAmount,item.recoveredAmount+allocation.amount);item.unrecoveredAmount=Math.max(0,item.confirmedAmount-item.recoveredAmount);item.currentlyPayableAmount=item.recoveredAmount;}}}
      notify(trade.sellerId,'settlement_debt_offset','정산금에서 미납금이 우선 차감되었습니다',`차감 ${offset.offsetAmount} Pi · 최종 정산 ${offset.sellerNetAmount} Pi`,result.settlement.id); store.event('MOCK_SETTLEMENT_COMPLETED', result.settlement.id); await store.save();
    }
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, ...result });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/checklist-trades\/([^/]+)\/settlement$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertChecklistBuyer(trade, userId);
    const partialRefund = store.state.refunds.find((item) => item.tradeId === trade.id && item.type === 'partial');
    const result = completeMockSettlement(trade, store.state.settlements, { id: store.id('settlement'), grossAmount: partialRefund?.retainedAmount });
    if (!result.idempotent) {
      trade.status = 'completed'; trade.completedAt = result.settlement.completedAt;
      store.event('PI_CHECKLIST_SETTLEMENT_COMPLETED', result.settlement.id); await store.save();
    }
    return sendJson(res, result.idempotent ? 200 : 201, { ok: true, trade, ...result });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/shipment$/);
  if (method === 'POST' && match) {
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const actor = requireUserId(req, res); if (!actor) return;
    assertTradeSeller(trade, actor);
    const existing = store.findShipmentByTrade(trade.id);
    if (existing) return sendJson(res, 200, { ok: true, shipment: existing, idempotent: true });
    const body = await readJson(req);
    const shipment = registerShipment(trade, { ...body, id: store.id('shipment') });
    store.state.shipments.push(shipment); store.event('SHIPMENT_REGISTERED', shipment.id); await store.save();
    return sendJson(res, 201, { ok: true, shipment, trade });
  }
  if (method === 'GET' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertTradeParty(trade, userId);
    const shipment = store.findShipmentByTrade(trade.id); if (!findOr404(res, shipment, 'shipment')) return;
    return sendJson(res, 200, { ok: true, shipment });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/shipment\/delivered$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const shipment = store.findShipmentByTrade(trade.id); if (!findOr404(res, shipment, 'shipment')) return;
    markDelivered(trade, shipment); store.event('SHIPMENT_DELIVERED', shipment.id, { autoConfirmAt: shipment.autoConfirmAt }); await store.save();
    return sendJson(res, 200, { ok: true, shipment, trade });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/confirm-purchase$/);
  if (method === 'POST' && match) {
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const actor = requireUserId(req, res); if (!actor) return;
    if (actor !== trade.buyerId) return apiError(res, 403, 'BUYER_REQUIRED', 'Only the buyer can confirm purchase');
    const result = confirmPurchase(trade);
    applyTrustEvent(store.state, {
      id: store.id('trust'), uniqueKey: `purchase_confirmed:${trade.id}:${trade.buyerId}`,
      userId: trade.buyerId, tradeId: trade.id, type: 'purchase_confirmed', reason: '구매자 직접 구매확정'
    });
    store.event('PURCHASE_CONFIRMED', trade.id, { mode: 'buyer' }); await store.save();
    return sendJson(res, 200, { ok: true, trade, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/disputes$/);
  if (method === 'POST' && match) {
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const actor = requireUserId(req, res); if (!actor) return;
    if (![trade.buyerId, trade.sellerId].includes(actor)) return apiError(res, 403, 'TRADE_PARTY_REQUIRED', 'Only a trade party can open a dispute');
    const existing = store.state.disputes.find((item) => item.tradeId === trade.id && item.status !== 'closed');
    if (existing) return sendJson(res, 200, { ok: true, dispute: existing, idempotent: true });
    const body = await readJson(req);
    if (!body.reason) return apiError(res, 400, 'DISPUTE_REASON_REQUIRED', 'reason is required');
    const dispute = openDispute(trade, { id: store.id('dispute'), applicantId: actor, reason: body.reason, gasFeeNoticeAccepted: body.gasFeeNoticeAccepted });
    Object.assign(dispute, caseDeadlines(dispute.createdAt, body.complexity));
    store.state.disputes.push(dispute); store.event('DISPUTE_OPENED', dispute.id); await store.save();
    return sendJson(res, 201, { ok: true, dispute, trade });
  }
  if (method === 'POST' && pathname === '/api/v1/internal/auto-confirm') {
    if (!requireTestAdmin(req, res)) return;
    const confirmed = [];
    for (const trade of store.state.trades) {
      const shipment = store.findShipmentByTrade(trade.id);
      if (autoConfirmDue(trade, shipment)) {
        confirmPurchase(trade, new Date(), 'automatic');
        applyTrustEvent(store.state, {
          id: store.id('trust'), uniqueKey: `purchase_confirmed:${trade.id}:${trade.buyerId}`,
          userId: trade.buyerId, tradeId: trade.id, type: 'purchase_confirmed', reason: '자동 구매확정'
        });
        store.event('PURCHASE_AUTO_CONFIRMED', trade.id);
        confirmed.push(trade.id);
      }
    }
    if (confirmed.length) await store.save();
    return sendJson(res, 200, { ok: true, confirmedTradeIds: confirmed });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/reviews$/);
  if (method === 'POST' && match) {
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    const writerId = requireUserId(req, res); if (!writerId) return;
    if (![trade.buyerId, trade.sellerId].includes(writerId)) return apiError(res, 403, 'TRADE_PARTY_REQUIRED', 'Only a trade party can review');
    if (!['purchase_confirmed', 'completed'].includes(trade.status)) return apiError(res, 409, 'TRADE_NOT_COMPLETED', 'Completed trade is required');
    const existing = store.state.reviews.find((item) => item.tradeId === trade.id && item.writerId === writerId);
    if (existing) return sendJson(res, 200, { ok: true, review: existing, idempotent: true });
    const body = await readJson(req);
    if (!['positive', 'neutral', 'negative'].includes(body.sentiment)) return apiError(res, 400, 'INVALID_REVIEW', 'sentiment is required');
    const targetUserId = writerId === trade.buyerId ? trade.sellerId : trade.buyerId;
    const review = {
      id: store.id('review'), tradeId: trade.id, writerId, targetUserId,
      sentiment: body.sentiment, tags: Array.isArray(body.tags) ? body.tags.slice(0, 5) : [],
      comment: String(body.comment || '').slice(0, 500), createdAt: new Date().toISOString()
    };
    store.state.reviews.push(review);
    if (body.sentiment === 'positive') {
      applyTrustEvent(store.state, {
        id: store.id('trust'), uniqueKey: `positive_review:${review.id}`,
        userId: targetUserId, tradeId: trade.id, type: 'positive_review', reason: '긍정 후기'
      });
    }
    store.event('REVIEW_CREATED', review.id); await store.save();
    return sendJson(res, 201, { ok: true, review, targetTrust: ensureProfile(store.state, targetUserId) });
  }
  match = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/trust-violations$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const body = await readJson(req);
    if (!body.decisionId || !body.reason) return apiError(res, 400, 'VIOLATION_DECISION_REQUIRED', 'decisionId and reason are required');
    const result = applyTrustEvent(store.state, {
      id: store.id('trust'), uniqueKey: `confirmed_violation:${body.decisionId}`,
      userId: match[1], type: 'confirmed_violation', penalty: body.penalty,
      reason: body.reason, options: { majorViolation: Number(body.penalty) >= 15 }
    });
    store.event('TRUST_VIOLATION_APPLIED', result.event.id); await store.save();
    return sendJson(res, 200, { ok: true, ...result });
  }
  match = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/status$/);
  if (method === 'PATCH' && match) {
    if (!requireTestAdmin(req, res)) return;
    const user = store.state.users.find((item) => item.id === match[1]); if (!findOr404(res, user, 'user')) return;
    const body = await readJson(req); const before = structuredClone(user);
    const result = changeUserStatus(store.state, user.id, body.status, body.reason);
    if (!result.idempotent) {
      recordAudit(req, 'USER_STATUS_CHANGED', 'user', user.id, body.reason, before, user);
      notify(user.id, 'user_status_changed', body.status === 'suspended' ? '계정 이용이 정지되었습니다' : '계정 이용이 복구되었습니다', body.reason, user.id);
      await store.save();
    }
    return sendJson(res, 200, { ok: true, user: { id: user.id, status: user.status }, revokedSessions: result.revokedSessions, pausedProducts: result.pausedProducts, idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/trades\/([^/]+)\/refund-quote$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertTradeParty(trade, userId);
    assertFinancialTradeAllowed(trade);
    const body = await readJson(req);
    const quote = refundQuote(trade.amount, body.retainedAmount ?? 0, body.networkFee ?? 0);
    return sendJson(res, 200, { ok: true, quote });
  }
  match = pathname.match(/^\/api\/v1\/admin\/disputes\/([^/]+)\/decision$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const dispute = store.state.disputes.find((item) => item.id === match[1]);
    if (!findOr404(res, dispute, 'dispute')) return;
    if (dispute.status === 'closed') {
      const existingRefund = store.state.refunds.find((item) => item.disputeId === dispute.id) || null;
      return sendJson(res, 200, { ok: true, dispute: adminDisputeSummary(store.state, dispute), refund: adminRefundSummary(existingRefund), idempotent: true });
    }
    const trade = store.findTrade(dispute.tradeId); if (!findOr404(res, trade, 'trade')) return;
    const body = await readJson(req);
    if (!body.reason) return apiError(res, 400, 'DECISION_REASON_REQUIRED', 'reason is required');
    const before = structuredClone(dispute);
    const result = createMockRefund(trade, dispute, body, store.id('refund'));
    const refund = result.refund;
    if (refund) {
      store.state.refunds.push(refund);
      const outstanding = Number(refund.gasLiability?.sellerOutstandingGas || 0);
      if (outstanding > 0 && trade.sellerId !== 'testnet_checklist_harness') {
        const debt = createGasDebt({ id: store.id('gas_debt'), userId: trade.sellerId, refundId: refund.id, amount: outstanding });
        store.state.gasDebts.push(debt);
        notify(trade.sellerId, 'gas_debt_confirmed', '가스비 미납금이 확정되었습니다', `${debt.outstandingAmount} Pi · 이의신청 기한 ${debt.appealDeadline}`, debt.id);
      }
    }
    recordAudit(req, 'DISPUTE_DECIDED', 'dispute', dispute.id, body.reason, before, dispute);
    notify(dispute.applicantId, 'dispute_decided', '분쟁 판정이 완료되었습니다', body.reason, dispute.id);
    store.event('DISPUTE_DECIDED', dispute.id, { type: body.type, refundId: refund?.id || null }); await store.save();
    return sendJson(res, 200, { ok: true, dispute: adminDisputeSummary(store.state, dispute), refund: adminRefundSummary(refund) });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/checklist-trades\/([^/]+)\/full-refund$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertChecklistBuyer(trade, userId);
    const existingRefund = store.state.refunds.find((item) => item.tradeId === trade.id);
    if (existingRefund) return sendJson(res, 200, { ok: true, trade, refund: existingRefund, idempotent: true });
    const dispute = store.state.disputes.find((item) => item.tradeId === trade.id && item.status !== 'closed');
    if (!findOr404(res, dispute, 'open dispute')) return;
    const result = createMockRefund(trade, dispute, { type: 'full_refund', faultType: 'seller_fault', reason: 'Testnet 체크리스트 전액 모의환불' }, store.id('refund'));
    store.state.refunds.push(result.refund);
    store.event('PI_CHECKLIST_FULL_REFUND_COMPLETED', result.refund.id); await store.save();
    return sendJson(res, 201, { ok: true, trade, dispute, refund: result.refund });
  }
  match = pathname.match(/^\/api\/v1\/testnet\/checklist-trades\/([^/]+)\/partial-refund$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const trade = store.findTrade(match[1]); if (!findOr404(res, trade, 'trade')) return;
    assertChecklistBuyer(trade, userId);
    const existingRefund = store.state.refunds.find((item) => item.tradeId === trade.id);
    if (existingRefund) return sendJson(res, 200, { ok: true, trade, refund: existingRefund, idempotent: true });
    const dispute = store.state.disputes.find((item) => item.tradeId === trade.id && item.status !== 'closed');
    if (!findOr404(res, dispute, 'open dispute')) return;
    const retainedAmount = Math.round((trade.amount / 2) * 10000000) / 10000000;
    const result = createMockRefund(trade, dispute, { type: 'partial_refund', retainedAmount, faultType: 'seller_fault', reason: 'Testnet 체크리스트 절반 부분환불' }, store.id('refund'));
    store.state.refunds.push(result.refund);
    store.event('PI_CHECKLIST_PARTIAL_REFUND_COMPLETED', result.refund.id); await store.save();
    return sendJson(res, 201, { ok: true, trade, dispute, refund: result.refund });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/disputes') {
    if (!requireTestAdmin(req, res)) return;
    const query = Object.fromEntries(url.searchParams.entries());
    return sendJson(res, 200, { ok: true, items: adminDisputeSummaries(store.state, query), filters: query });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/gas-debts') {
    if (!requireTestAdmin(req, res)) return;
    const status = url.searchParams.get('status');
    const items = store.state.gasDebts.filter((item) => !status || item.status === status).slice().reverse();
    return sendJson(res, 200, { ok: true, items });
  }
  if (method === 'POST' && pathname === '/api/v1/admin/gas-compensation-payouts/mock-batch') {
    if (!requireTestAdmin(req,res)) return;
    const result=createMockPayoutBatch(store.state.gasCompensations,{id:store.id('comp_payout'),adminId:testAdminId(req)});
    store.state.compensationPayouts.push(result.batch);
    for(const item of result.items) notify(item.buyerId,'gas_compensation_paid','Testnet 가스비 보상 지급이 완료되었습니다',`${item.currentlyPayableAmount} Test-Pi · 지급번호 ${result.batch.id}`,result.batch.id);
    recordAudit(req,'GAS_COMPENSATION_BATCH_PAID','compensation_payout',result.batch.id,'Testnet 보상금 일괄 모의지급',null,result.batch);
    await store.save(); return sendJson(res,201,{ok:true,batch:result.batch});
  }
  match = pathname.match(/^\/api\/v1\/admin\/gas-debts\/([^/]+)\/decision$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const debt = store.state.gasDebts.find((item) => item.id === match[1]); if (!findOr404(res, debt, 'gas debt')) return;
    const body = await readJson(req); const before = structuredClone(debt);
    decideGasDebtAppeal(debt, { ...body, adminId: testAdminId(req) });
    recordAudit(req, 'GAS_DEBT_APPEAL_DECIDED', 'gas_debt', debt.id, body.reason, before, debt);
    notify(debt.userId, 'gas_debt_appeal_decided', '가스비 미납 이의신청 판정이 완료되었습니다', `${body.reason} · 남은 미납금 ${debt.outstandingAmount} Pi`, debt.id);
    await store.save(); return sendJson(res, 200, { ok: true, debt });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/product-reviews') {
    if (!requireTestAdmin(req, res)) return;
    return sendJson(res, 200, { ok: true, items: moderationQueue(store.state) });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/dashboard') {
    if (!requireTestAdmin(req, res)) return;
    return sendJson(res, 200, { ok: true, summary: adminDashboardSummary(store.state) });
  }
  match = pathname.match(/^\/api\/v1\/admin\/product-reviews\/([^/]+)\/decision$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const product = store.findProduct(match[1]); if (!findOr404(res, product, 'product')) return;
    const body = await readJson(req); const before = structuredClone(product);
    moderateProduct(product, body.decision, body.reason);
    recordAudit(req, 'PRODUCT_REVIEW_DECIDED', 'product', product.id, body.reason, before, product);
    notify(product.sellerId, 'product_review_decided', body.decision === 'approve' ? '상품 검토가 승인되었습니다' : '상품 등록이 거절되었습니다', body.reason, product.id);
    store.event('PRODUCT_REVIEW_DECIDED', product.id, { decision: body.decision }); await store.save();
    return sendJson(res, 200, { ok: true, product: { id: product.id, status: product.status, moderation: product.moderation } });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/reports') {
    if (!requireTestAdmin(req, res)) return;
    const query = Object.fromEntries(url.searchParams.entries());
    return sendJson(res, 200, { ok: true, items: adminReportSummaries(store.state, query), filters: query });
  }
  match = pathname.match(/^\/api\/v1\/admin\/reports\/([^/]+)\/assign$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const report = store.state.reports.find((item) => item.id === match[1]); if (!findOr404(res, report, 'report')) return;
    const body = await readJson(req); const adminId = body.adminId || testAdminId(req); const before = structuredClone(report);
    const result = assignCase(report, adminId);
    recordAudit(req, 'REPORT_ASSIGNED', 'report', report.id, body.reason || '담당자 배정', before, report);
    await store.save(); return sendJson(res, 200, { ok: true, report: adminReportSummary(report), idempotent: result.idempotent });
  }
  match = pathname.match(/^\/api\/v1\/admin\/reports\/([^/]+)\/decision$/);
  if (method === 'POST' && match) {
    if (!requireTestAdmin(req, res)) return;
    const report = store.state.reports.find((item) => item.id === match[1]); if (!findOr404(res, report, 'report')) return;
    if (report.status === 'closed') return sendJson(res, 200, { ok: true, report: adminReportSummary(report), idempotent: true });
    const body = await readJson(req); const before = structuredClone(report);
    const result = decideCase(report, { ...body, adminId: testAdminId(req) });
    recordAudit(req, 'REPORT_DECIDED', 'report', report.id, body.reason, before, report);
    notify(report.reporterId, 'report_decided', '신고 처리결과가 등록되었습니다', body.reason, report.id);
    await store.save(); return sendJson(res, 200, { ok: true, report: adminReportSummary(report), idempotent: result.idempotent });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/audit-logs') {
    if (!requireTestAdmin(req, res)) return;
    const query = Object.fromEntries(url.searchParams.entries());
    return sendJson(res, 200, { ok: true, items: adminAuditSummaries(store.state, query), filters: query });
  }
  if (method === 'GET' && pathname === '/api/v1/admin/users') {
    if (!requireTestAdmin(req, res)) return;
    const query = Object.fromEntries(url.searchParams.entries());
    return sendJson(res, 200, { ok: true, items: adminUserSummaries(store.state, query), filters: query });
  }
  match = pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
  if (method === 'POST' && match) {
    const userId = requireUserId(req, res); if (!userId) return;
    const item = store.state.notifications.find((entry) => entry.id === match[1] && entry.userId === userId);
    if (!findOr404(res, item, 'notification')) return;
    item.readAt ||= new Date().toISOString(); await store.save(); return sendJson(res, 200, { ok: true, notification: item });
  }
  return apiError(res, 404, 'ROUTE_NOT_FOUND', 'API route not found');
}

function serveStatic(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders() }); return res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
    ...securityHeaders(),
    'Cache-Control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestId = createRequestId();
  res.setHeader('X-Request-Id', requestId);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(res, url.pathname);
  } catch (error) {
    console.error(requestId, error.code || 'SERVER_ERROR', error.message);
    return apiError(res, error.status || 400, error.code || 'BAD_REQUEST', error.message, error.details);
  }
});

if (require.main === module) {
  const host = process.env.HOST || '0.0.0.0';
  store.initialize()
    .then(({ backend }) => {
      server.listen(PORT, host, () => console.log(`Global Market Testnet (${backend}): http://${host}:${PORT}`));
      const shutdown = createShutdownHandler({ server, store });
      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((error) => {
      console.error('STORE_INITIALIZATION_FAILED', error.message);
      process.exitCode = 1;
    });
}

module.exports = { server, store };
