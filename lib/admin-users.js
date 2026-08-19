'use strict';

function adminUserSummaries(state, query = {}) {
  const keyword = String(query.q || '').trim().toLowerCase();
  const status = ['active', 'suspended'].includes(query.status) ? query.status : '';
  return state.users
    .filter((user) => !status || user.status === status)
    .filter((user) => !keyword || String(user.username || '').toLowerCase().includes(keyword) || user.id.toLowerCase().includes(keyword))
    .map((user) => {
      const profile = state.trustProfiles.find((item) => item.userId === user.id);
      const products = state.products.filter((item) => item.sellerId === user.id);
      return {
        id: user.id,
        username: String(user.username || 'Pi 사용자'),
        status: user.status,
        createdAt: user.createdAt,
        statusUpdatedAt: user.statusUpdatedAt || null,
        trust: {
          score: Number(profile?.score ?? 50),
          level: String(profile?.level || 'Bronze'),
          normalTradeCount: Number(profile?.normalTradeCount || 0)
        },
        productCount: products.length,
        activeProductCount: products.filter((item) => item.status === 'available').length
      };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

module.exports = { adminUserSummaries };
