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
  const { sellerId, reviewReasons, popularPlacement, directWalletAddress, ...safeProduct } = product;
  return { ...safeProduct, directWalletAvailable: Boolean(directWalletAddress), seller: publicSeller(state, sellerId) };
}

module.exports = { publicSeller, publicProduct };
