'use strict';

function assertReportTarget(state, reporterId, targetType, targetId) {
  if (targetType === 'product') {
    const product = state.products.find((item) => item.id === targetId);
    if (!product) throw Object.assign(new Error('신고할 상품을 찾을 수 없습니다.'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    if (product.sellerId === reporterId) throw Object.assign(new Error('본인 상품은 신고할 수 없습니다.'), { code: 'SELF_REPORT_BLOCKED', status: 409 });
    return product;
  }
  if (targetType === 'trade') {
    const trade = state.trades.find((item) => item.id === targetId);
    if (!trade) throw Object.assign(new Error('신고할 거래를 찾을 수 없습니다.'), { code: 'TRADE_NOT_FOUND', status: 404 });
    if (![trade.buyerId, trade.sellerId].includes(reporterId)) throw Object.assign(new Error('거래 당사자만 신고할 수 있습니다.'), { code: 'TRADE_PARTY_REQUIRED', status: 403 });
    return trade;
  }
  throw Object.assign(new Error('상품 또는 거래만 신고할 수 있습니다.'), { code: 'INVALID_REPORT_TARGET', status: 400 });
}

module.exports = { assertReportTarget };
