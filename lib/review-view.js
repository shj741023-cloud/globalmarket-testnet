'use strict';

function userReviews(state, userId) {
  return state.reviews
    .filter((review) => review.writerId === userId || review.targetUserId === userId)
    .map((review) => {
      const trade = state.trades.find((item) => item.id === review.tradeId);
      const product = trade ? state.products.find((item) => item.id === trade.productId) : null;
      const writer = state.users.find((item) => item.id === review.writerId);
      const target = state.users.find((item) => item.id === review.targetUserId);
      return {
        id: review.id,
        tradeId: review.tradeId,
        direction: review.writerId === userId ? 'written' : 'received',
        sentiment: review.sentiment,
        comment: review.comment,
        tags: review.tags || [],
        createdAt: review.createdAt,
        productTitle: product?.title || '상품정보 없음',
        writerName: writer?.username || 'Pi 사용자',
        targetName: target?.username || 'Pi 사용자'
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { userReviews };
