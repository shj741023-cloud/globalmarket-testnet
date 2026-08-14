'use strict';

function deny(message, code) {
  throw Object.assign(new Error(message), { code, status: 403 });
}

function assertTradeParty(trade, userId) {
  if (!trade || ![trade.buyerId, trade.sellerId].includes(userId)) deny('거래 당사자만 접근할 수 있습니다.', 'TRADE_PARTY_REQUIRED');
  return trade;
}

function assertTradeBuyer(trade, userId) {
  if (!trade || trade.buyerId !== userId) deny('구매자만 처리할 수 있습니다.', 'BUYER_REQUIRED');
  return trade;
}

function assertTradeSeller(trade, userId) {
  if (!trade || trade.sellerId !== userId) deny('판매자만 처리할 수 있습니다.', 'SELLER_REQUIRED');
  return trade;
}

module.exports = { assertTradeParty, assertTradeBuyer, assertTradeSeller };
