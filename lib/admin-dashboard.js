'use strict';

function adminDashboardSummary(state) {
  const users = state.users || [];
  const products = state.products || [];
  const reports = state.reports || [];
  const disputes = state.disputes || [];
  const gasDebts = state.gasDebts || [];
  return {
    users: {
      total: users.length,
      active: users.filter((item) => (item.status || 'active') === 'active').length,
      suspended: users.filter((item) => item.status === 'suspended').length
    },
    products: {
      total: products.length,
      available: products.filter((item) => item.status === 'available').length,
      reviewPending: products.filter((item) => item.status === 'under_review').length
    },
    reports: {
      total: reports.length,
      open: reports.filter((item) => item.status !== 'closed').length
    },
    disputes: {
      total: disputes.length,
      open: disputes.filter((item) => item.status !== 'closed').length
    },
    gasDebts: { total: gasDebts.length, appealPending: gasDebts.filter((item) => item.status === 'appeal_pending').length }
  };
}

module.exports = { adminDashboardSummary };
