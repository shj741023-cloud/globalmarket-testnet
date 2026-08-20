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
        productTitle: product?.title || (trade?.purpose === 'pi_checklist' ? 'Testnet 기능시험' : '상품정보 없음'),
        writerName: writer?.username || 'Pi 사용자',
        targetName: target?.username || 'Pi 사용자'
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function sellerReviews(state, sellerId) {
  return state.reviews
    .filter((review) => review.targetUserId === sellerId)
    .map((review) => {
      const writer = state.users.find((item) => item.id === review.writerId);
      return {
        sentiment: review.sentiment,
        comment: review.comment,
        createdAt: review.createdAt,
        writerName: writer?.username || 'Pi 사용자'
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 20);
}

module.exports = { userReviews, sellerReviews };
