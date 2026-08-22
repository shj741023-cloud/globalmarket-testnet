'use strict';

function publicSeller(state, sellerId) {
  const user = state.users.find((item) => item.id === sellerId);
  const profile = state.trustProfiles.find((item) => item.userId === sellerId);
  return {
    username: String(user?.username || 'Pi 사용자'),
    trustLevel: String(profile?.level || 'Bronze'),
    normalTradeCount: Number(profile?.normalTradeCount || 0)
  };
}

function publicProduct(state, product) {
  const { sellerId, reviewReasons, popularPlacement, ...safeProduct } = product;
  return { ...safeProduct, seller: publicSeller(state, sellerId) };
}

module.exports = { publicSeller, publicProduct };
